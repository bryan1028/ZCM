-- Behaviour spec for the ZCM database. Each `assert` is a rule the app relies on.
-- Run through scripts/test-db.sh (migrations + seed are applied first). A failed assert aborts with its message.

create schema t;
grant usage on schema t to anon, authenticated;
create function t.uid(n int) returns uuid language sql immutable as $$ select ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;
create function t.become(n int) returns void language plpgsql as $$ begin perform set_config('app.uid', t.uid(n)::text, true); set local role authenticated; end $$;
create function t.anon() returns void language plpgsql as $$ begin perform set_config('app.uid', '', true); set local role anon; end $$;
create function t.su() returns void language plpgsql as $$ begin reset role; perform set_config('app.uid', '', true); end $$;
create function t.fails(q text) returns text language plpgsql as $$ begin execute q; return null; exception when others then return sqlerrm; end $$;
create function t.n(q text) returns bigint language plpgsql as $$ declare x bigint; begin execute 'select count(*) from (' || q || ') s' into x; return x; end $$;
grant execute on all functions in schema t to anon, authenticated;

-- ── cast of characters ─────────────────────────────────────────────────────
-- 1 alice (admin) · 2 bob (seller) · 3 carol (buyer) · 4 dave (applicant) · 5 erin (outsider) · 6 fay (future admin)
insert into auth.users (id, email) select t.uid(n), 'user' || n || '@example.test' from generate_series(1, 6) n;
update zcm.profiles set username = (array['alice','bob_s','carol','dave','erin','fay'])[right(id::text, 1)::int];
insert into zcm.memberships (community_id, user_id, unit, status, role, reviewed_at)
  select c.id, t.uid(n), 'U' || n, 'verified', case when n = 1 then 'admin' else 'resident' end, now()
  from zcm.communities c, generate_series(1, 3) n where c.slug = 'kijani-ridge';
insert into zcm.memberships (community_id, user_id, unit, status, reviewed_at)
  select c.id, t.uid(6), 'U6', 'verified', now() from zcm.communities c where c.slug = 'kijani-ridge';

-- ═══ 1. who can see what ═══
do $$ declare k uuid; begin
  select id into k from zcm.communities where slug = 'kijani-ridge';
  perform t.anon();
  assert t.fails('select * from zcm.listings') is not null, 'anonymous must have no access to listings';
  assert t.fails('select * from zcm.communities') is not null, 'anonymous must have no access to communities';
  perform t.become(5);                                                    -- signed in, not a resident
  assert t.n('select 1 from zcm.communities') = 1, 'any signed-in user can list communities (to apply)';
  assert t.n('select 1 from zcm.listings') = 0, 'a non-member sees no listings';
  assert t.n('select 1 from zcm.sellers') = 0, 'a non-member sees no sellers';
  assert t.n('select 1 from zcm.announcements') = 0, 'a non-member sees no announcements';
  assert t.n('select 1 from zcm.community_invites') = 0, 'invite codes are admin-only';
  perform t.su();
  raise notice 'ok 1 visibility';
end $$;

-- ═══ 2. joining and verification ═══
do $$ declare k uuid; begin
  select id into k from zcm.communities where slug = 'kijani-ridge';
  perform t.become(4);
  assert t.fails(format($q$insert into zcm.memberships(community_id,user_id,unit,status) values (%L,%L,'D1','verified')$q$, k, t.uid(4))) is not null, 'cannot apply as verified';
  assert t.fails(format($q$insert into zcm.memberships(community_id,user_id,unit,role) values (%L,%L,'D1','admin')$q$, k, t.uid(4))) is not null, 'cannot apply as admin';
  insert into zcm.memberships(community_id, user_id, unit, invited_by_username) values (k, t.uid(4), 'D1', 'Bob_S');
  assert (select invited_by_username from zcm.memberships where user_id = t.uid(4)) = 'bob_s', 'a real referrer is kept (case-insensitive)';
  assert t.n('select 1 from zcm.listings') = 0, 'a pending applicant sees no listings';
  update zcm.memberships set status = 'verified' where user_id = t.uid(4);
  assert (select status from zcm.memberships where user_id = t.uid(4)) = 'pending', 'an applicant cannot verify themselves';
  perform t.su();
  delete from zcm.memberships where user_id = t.uid(4);
  perform t.become(4);
  insert into zcm.memberships(community_id, user_id, unit, invited_by_username) values (k, t.uid(4), 'D1', 'ghost');
  assert (select invited_by_username from zcm.memberships where user_id = t.uid(4)) is null, 'a bogus referrer is dropped';
  perform t.become(1);
  assert t.n('select 1 from zcm.memberships where status = ''pending''') = 1, 'the admin sees the pending applicant';
  assert (select count(*) from zcm.notifications where user_id = t.uid(1) and type = 'membership') >= 1, 'the admin is notified of an applicant';
  update zcm.memberships set status = 'verified', reviewed_by = t.uid(1) where user_id = t.uid(4);
  perform t.become(4);
  assert (select count(*) from zcm.notifications where user_id = t.uid(4) and title like '%verified%') = 1, 'the applicant is told they are verified';
  perform t.become(3);
  assert t.fails(format($q$update zcm.memberships set status='suspended' where user_id=%L$q$, t.uid(2))) is null, 'banning someone else just matches no rows';
  perform t.su();
  assert (select status from zcm.memberships where user_id = t.uid(2)) = 'verified', 'a resident cannot ban another resident';
  raise notice 'ok 2 joining';
end $$;

-- ═══ 3. sellers, plans, listing limits ═══
do $$ declare k uuid; s2 uuid; l uuid; begin
  select id into k from zcm.communities where slug = 'kijani-ridge';
  perform t.become(2);
  assert t.fails(format($q$insert into zcm.sellers(community_id,user_id,display_name,plan) values (%L,%L,'Bob','pro')$q$, k, t.uid(2))) like '%platform%', 'cannot self-upgrade the plan';
  assert t.fails(format($q$insert into zcm.sellers(community_id,user_id,display_name,account_type) values (%L,%L,'Bob','business')$q$, k, t.uid(2))) is not null, 'a business needs a business name';
  insert into zcm.sellers(community_id, user_id, display_name, whatsapp) values (k, t.uid(2), 'Bob', '254700000002') returning id into s2;
  assert t.fails(format($q$update zcm.sellers set plan='pro' where id=%L$q$, s2)) like '%platform%', 'cannot upgrade later either';
  perform t.become(5);
  assert t.fails(format($q$insert into zcm.sellers(community_id,user_id,display_name) values (%L,%L,'Erin')$q$, k, t.uid(5))) is not null, 'a non-member cannot become a seller';
  perform t.su();
  update zcm.plan_limits set max_active_listings = 2, max_images = 2, max_videos = 1 where account_type = 'individual' and plan = 'free';
  perform t.become(2);
  insert into zcm.listings(seller_id, kind, category, title, price_cents, stock) values (s2, 'product', 'Baked goods', 'Cookies', 80000, 3) returning id into l;
  insert into zcm.listings(seller_id, kind, category, title) values (s2, 'service', 'Repairs', 'Fix taps');
  assert t.fails(format($q$insert into zcm.listings(seller_id,kind,category,title) values (%L,'product','Crafts','Third')$q$, s2)) like '%limit%', 'the active-listing limit is enforced';
  assert t.fails(format($q$update zcm.listings set image_urls = array['a','b','c'] where id=%L$q$, l)) like '%images%', 'the image limit is enforced';
  assert t.fails(format($q$update zcm.listings set video_urls = array['a','b'] where id=%L$q$, l)) like '%videos%', 'the video limit is enforced';
  assert t.fails(format($q$update zcm.listings set featured_until = now() + interval '1 day' where id=%L$q$, l)) like '%Pro%', 'featuring needs a Pro plan';
  perform t.become(3);
  assert t.n('select 1 from zcm.listings') = 2, 'residents see active listings';
  assert t.fails(format($q$update zcm.listings set title='hacked' where id=%L$q$, l)) is null and
         (select title from zcm.listings where id = l) = 'Cookies', 'only the owner can edit a listing';
  perform t.su();
  update zcm.plan_limits set max_active_listings = 50, max_images = 6, max_videos = 1 where account_type = 'individual' and plan = 'free';
  raise notice 'ok 3 sellers';
end $$;

-- ═══ 4. reviews ═══
do $$ declare l uuid; begin
  select id into l from zcm.listings where title = 'Cookies';
  perform t.become(2);
  assert t.fails(format($q$insert into zcm.reviews(listing_id,reviewer_id,rating) values (%L,%L,5)$q$, l, t.uid(2))) like '%own listing%', 'no reviewing your own listing';
  perform t.become(3);
  insert into zcm.reviews(listing_id, reviewer_id, rating, comment) values (l, t.uid(3), 5, 'great');
  assert t.fails(format($q$insert into zcm.reviews(listing_id,reviewer_id,rating) values (%L,%L,4)$q$, l, t.uid(3))) is not null, 'one review per listing per person';
  assert t.fails(format($q$insert into zcm.reviews(listing_id,reviewer_id,rating) values (%L,%L,4)$q$, l, t.uid(2))) is not null, 'cannot review as someone else';
  assert t.fails(format($q$insert into zcm.reviews(listing_id,reviewer_id,rating) values (%L,%L,9)$q$, l, t.uid(3))) is not null, 'rating must be 1-5';
  assert (select avg_rating from zcm.listing_ratings where listing_id = l) = 5.0, 'the rating view averages';
  perform t.become(5);
  assert t.n('select 1 from zcm.reviews') = 0, 'outsiders see no reviews';
  perform t.su();
  raise notice 'ok 4 reviews';
end $$;

-- ═══ 5. reservations, payment proof, stock ═══
do $$ declare l uuid; r uuid; r2 uuid; k uuid; begin
  select id into l from zcm.listings where title = 'Cookies';
  perform t.become(3);
  r := zcm.create_reservation(l, 2, 'pickup 5pm');
  assert t.fails(format('select zcm.create_reservation(%L, 2, null)', l)) like '%stock%', 'two buyers cannot reserve the last items';
  assert t.fails(format('select zcm.submit_payment(%L, %L, null)', r, r || '/p.png')) like '%accepted%', 'no payment proof before the seller accepts';
  assert t.fails(format($q$select zcm.transition_reservation(%L, 'accept')$q$, r)) is not null, 'a buyer cannot accept their own order';
  perform t.become(5);
  assert t.fails(format($q$select zcm.transition_reservation(%L, 'cancel')$q$, r)) is not null, 'an outsider cannot touch an order';
  assert t.n('select 1 from zcm.reservations') = 0, 'an outsider sees no orders';
  perform t.become(2);
  assert (select count(*) from zcm.notifications where user_id = t.uid(2) and title like 'New request%') = 1, 'the seller is notified of a request';
  assert zcm.transition_reservation(r, 'accept') = 'accepted';
  perform t.become(3);
  perform zcm.submit_payment(r, r || '/p.png', 'QWE123');
  assert t.fails(format('select zcm.submit_payment(%L, %L, null)', r, r || '/p2.png')) is not null, 'cannot pay twice';
  assert t.fails(format($q$select zcm.transition_reservation(%L, 'confirm')$q$, r)) is not null, 'a buyer cannot confirm their own payment';
  assert t.fails(format($q$insert into storage.objects(bucket_id,name) values ('zcm-payment-proofs', %L)$q$, r || '/ok.png')) is null, 'the buyer can upload proof';
  perform t.become(5);
  assert t.fails(format($q$insert into storage.objects(bucket_id,name) values ('zcm-payment-proofs', %L)$q$, r || '/evil.png')) is not null, 'an outsider cannot upload proof';
  assert t.n('select 1 from storage.objects where bucket_id = ''zcm-payment-proofs''') = 0, 'an outsider cannot read proof';
  perform t.become(2);
  assert t.n('select 1 from storage.objects where bucket_id = ''zcm-payment-proofs''') = 1, 'the seller can read proof';
  assert zcm.transition_reservation(r, 'reject_proof') = 'accepted';
  perform t.become(3);
  perform zcm.submit_payment(r, r || '/p3.png', 'QWE124');
  perform t.become(2);
  assert zcm.transition_reservation(r, 'confirm') = 'completed';
  assert (select stock from zcm.listings where id = l) = 1, 'stock drops only when the seller confirms';
  perform t.become(3);
  assert (select count(*) from zcm.notifications where user_id = t.uid(3) and title like 'Order completed%') = 1, 'the buyer is told it completed';
  -- expiry
  r2 := zcm.create_reservation(l, 1, null);
  perform t.su();
  update zcm.reservations set expires_at = now() - interval '1 hour' where id = r2;
  assert zcm.expire_reservations() = 1, 'stale requests expire';
  assert (select status from zcm.reservations where id = r2) = 'expired';
  raise notice 'ok 5 reservations';
end $$;

do $$ declare r uuid; n int; begin
  select id into r from zcm.reservations where status = 'completed';
  perform t.become(3);
  insert into storage.objects(bucket_id, name) values ('zcm-payment-proofs', r || '/delete-me.png');
  perform t.become(2);
  delete from storage.objects where name = r || '/delete-me.png';
  get diagnostics n = row_count;
  assert n = 0, 'the seller cannot delete payment-proof files';
  perform t.become(5);
  delete from storage.objects where name = r || '/delete-me.png';
  get diagnostics n = row_count;
  assert n = 0, 'an outsider cannot delete payment-proof files';
  perform t.become(3);
  delete from storage.objects where name = r || '/delete-me.png';
  get diagnostics n = row_count;
  assert n = 1, 'the buyer can delete their own proof file';
  perform t.su();
  raise notice 'ok 5b proof cleanup';
end $$;

-- ═══ 6. chat and shadowban ═══
do $$ declare l uuid; c uuid; notif_before int; begin
  select id into l from zcm.listings where title = 'Cookies';
  perform t.become(3);
  c := zcm.start_conversation(l);
  assert zcm.start_conversation(l) = c, 'starting a chat twice reopens the same one';
  insert into zcm.messages(conversation_id, sender_id, body) values (c, t.uid(3), 'hello');
  assert t.fails(format($q$insert into zcm.messages(conversation_id,sender_id,body) values (%L,%L,'spoof')$q$, c, t.uid(2))) is not null, 'cannot send as someone else';
  perform t.become(2);
  assert t.n('select 1 from zcm.messages') = 1, 'the seller receives the message';
  assert (select count(*) from zcm.notifications where user_id = t.uid(2) and type = 'message') = 1, 'new message notification';
  perform zcm.mark_read(c);
  assert t.n('select 1 from zcm.messages where read_at is null') = 0, 'mark_read works';
  assert t.fails(format('select zcm.start_conversation(%L)', l)) like '%own listing%', 'cannot chat with yourself';
  perform t.become(5);
  assert t.n('select 1 from zcm.conversations') = 0 and t.n('select 1 from zcm.messages') = 0, 'outsiders see no chats';
  assert t.fails(format('select zcm.start_conversation(%L)', l)) is not null, 'an outsider cannot start a chat';
  -- shadowban carol: bob stops seeing her messages and gets no notification; carol notices nothing
  perform t.su();
  update zcm.memberships set shadowbanned = true where user_id = t.uid(3);
  select count(*) into notif_before from zcm.notifications where user_id = t.uid(2);
  perform t.become(3);
  insert into zcm.messages(conversation_id, sender_id, body) values (c, t.uid(3), 'second');
  assert t.n(format('select 1 from zcm.messages where sender_id = %L', t.uid(3))) = 2, 'a shadowbanned sender still sees their own messages';
  assert zcm.msg_hidden(c, t.uid(3)) is false, 'a banned user cannot detect their own shadowban through the API';
  perform t.become(2);
  assert t.n($q$select 1 from zcm.messages where body = 'second'$q$) = 0, 'the recipient never sees a shadowbanned senders messages';
  assert zcm.msg_hidden(c, t.uid(3)) is true, 'hidden for the recipient';
  perform t.su();
  assert (select count(*) from zcm.notifications where user_id = t.uid(2)) = notif_before, 'no notification for a shadowbanned sender';
  update zcm.memberships set shadowbanned = false where user_id = t.uid(3);
  raise notice 'ok 6 chat';
end $$;

do $$ begin
  perform t.su();
  update zcm.memberships set shadowbanned = true where user_id = t.uid(2);
  perform t.become(3);
  assert t.n('select 1 from zcm.listings') = 0, 'a shadowbanned sellers listings vanish for others';
  assert t.n('select 1 from zcm.sellers') = 0, 'and so does their seller profile';
  perform t.become(2);
  assert t.n('select 1 from zcm.listings') = 2, 'but the seller still sees their own';
  perform t.become(1);
  assert t.n('select 1 from zcm.listings') = 2, 'admins still see everything';
  perform t.su();
  update zcm.memberships set shadowbanned = false where user_id = t.uid(2);
  update zcm.memberships set status = 'suspended' where user_id = t.uid(2);
  perform t.become(3);
  assert t.n('select 1 from zcm.listings') = 0, 'a banned sellers listings vanish';
  perform t.su();
  update zcm.memberships set status = 'verified' where user_id = t.uid(2);
  raise notice 'ok 6b moderation';
end $$;

-- ═══ 7. reports, invites, announcements ═══
do $$ declare k uuid; l uuid; code text; begin
  select id into k from zcm.communities where slug = 'kijani-ridge';
  select id into l from zcm.listings where title = 'Cookies';
  perform t.become(3);
  insert into zcm.reports(community_id, reporter_id, target_type, target_id, reason) values (k, t.uid(3), 'listing', l, 'looks like spam');
  assert t.n('select 1 from zcm.reports') = 1, 'a reporter sees their own report';
  perform t.become(2);
  assert t.n('select 1 from zcm.reports') = 0, 'other residents do not see reports';
  perform t.become(1);
  assert t.n('select 1 from zcm.reports') = 1, 'the admin sees reports';
  update zcm.reports set status = 'resolved', resolved_by = t.uid(1) where status = 'open';
  perform t.become(3);
  assert t.fails(format($q$update zcm.reports set status='dismissed' where reporter_id=%L$q$, t.uid(3))) is null and
         (select status from zcm.reports limit 1) = 'resolved', 'a reporter cannot resolve reports';
  perform t.su();
  select i.code into code from zcm.community_invites i where i.community_id = k;
  perform t.anon();
  assert (select count(*) from zcm.community_by_invite(code)) = 1, 'a valid invite link resolves for anyone';
  assert (select count(*) from zcm.community_by_invite('nope')) = 0, 'a bad invite code resolves to nothing';
  perform t.become(5);
  assert zcm.get_invite_code(k) is null, 'only members can fetch the invite code';
  perform t.become(2);
  assert zcm.get_invite_code(k) = code, 'members can fetch it to invite neighbours';
  assert t.fails(format('select zcm.rotate_invite_code(%L)', k)) like '%Admins only%', 'only admins can rotate the code';
  assert t.fails(format($q$insert into zcm.announcements(community_id,author_id,title) values (%L,%L,'hello all')$q$, k, t.uid(2))) is not null, 'only admins can post announcements';
  perform t.become(1);
  assert zcm.rotate_invite_code(k) <> code, 'an admin can rotate the code';
  insert into zcm.announcements(community_id, author_id, title, pinned) values (k, t.uid(1), 'Welcome!', true);
  perform t.become(3);
  assert t.n('select 1 from zcm.announcements') = 1, 'residents read announcements';
  perform t.become(5);
  assert t.n('select 1 from zcm.announcements') = 0, 'outsiders do not';
  perform t.su();
  raise notice 'ok 7 reports invites';
end $$;

-- ═══ 8. hardening: what the public API can and cannot reach ═══
do $$ declare bad text; begin
  -- anonymous visitors may call exactly one function: the invite lookup
  select string_agg(p.proname, ', ') into bad from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'zcm' and has_function_privilege('anon', p.oid, 'execute');
  assert bad = 'community_by_invite', 'anon may only run community_by_invite, found: ' || coalesce(bad, '(none)');
  -- internal / trigger / admin-only functions are unreachable for signed-in users too
  select string_agg(p.proname, ', ') into bad from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'zcm' and p.proname in ('handle_new_user','guard_seller_plan','listings_before_write','messages_before_insert',
      'reviews_before_insert','memberships_check_referral','on_community_created','on_message_notify','on_reservation_notify',
      'on_membership_notify','guard_last_admin','notify','slug_of','is_shadowbanned','reserved_units','expire_reservations',
      'create_community','make_community_admin') and has_function_privilege('authenticated', p.oid, 'execute');
  assert bad is null, 'internal functions callable by signed-in users: ' || coalesce(bad, '');
  -- the app's own functions still work for them
  assert has_function_privilege('authenticated', 'zcm.create_reservation(uuid,int,text)', 'execute') and
         has_function_privilege('authenticated', 'zcm.is_verified_member(uuid)', 'execute') and
         has_function_privilege('authenticated', 'zcm.usernames_for(uuid,uuid[])', 'execute'), 'the API functions the app needs must stay executable';
  -- every SECURITY DEFINER function pins its search_path
  select string_agg(p.proname, ', ') into bad from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'zcm' and p.prosecdef and p.proconfig is null;
  assert bad is null, 'SECURITY DEFINER functions without a pinned search_path: ' || coalesce(bad, '');
  assert not exists (select 1 from pg_views where schemaname = 'zcm' and viewname = 'member_names'), 'no SECURITY DEFINER view left';
  -- policies use the once-per-statement form
  select string_agg(policyname, ', ') into bad from pg_policies
    where (schemaname = 'zcm' or (schemaname = 'storage' and policyname like 'zcm\_%'))
      and ((coalesce(qual,'') like '%auth.uid()%' and coalesce(qual,'') not like '%SELECT auth.uid()%')
        or (coalesce(with_check,'') like '%auth.uid()%' and coalesce(with_check,'') not like '%SELECT auth.uid()%'));
  assert bad is null, 'RLS policies must wrap auth.uid() in (select ...): ' || coalesce(bad, '');
  -- every foreign key is indexed
  select string_agg(c.conname, ', ') into bad from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where c.contype = 'f' and n.nspname = 'zcm' and not exists (
      select 1 from pg_index i where i.indrelid = c.conrelid and (i.indkey::int2[])[0:array_length(c.conkey,1)-1] = c.conkey);
  assert bad is null, 'foreign keys without an index: ' || coalesce(bad, '');
  assert (select timezone from zcm.communities limit 1) = 'Africa/Nairobi', 'communities default to Nairobi time';
  raise notice 'ok 8 api surface';
end $$;

do $$ declare k uuid; begin
  select id into k from zcm.communities where slug = 'kijani-ridge';
  -- usernames are only revealed within a shared community
  perform t.become(2);
  assert (select count(*) from zcm.usernames_for(k, array[t.uid(3), t.uid(1)])) = 2, 'residents can look up neighbours usernames';
  assert (select count(*) from zcm.usernames_for(k, array[t.uid(2)])) = 1, 'and their own';
  perform t.become(5);
  assert (select count(*) from zcm.usernames_for(k, array[t.uid(3), t.uid(1)])) = 0, 'outsiders cannot';
  -- a community can't lose its last admin
  perform t.become(1);
  assert t.fails(format($q$update zcm.memberships set status='suspended' where user_id=%L$q$, t.uid(1))) like '%at least one verified admin%', 'the last admin cannot be banned';
  assert t.fails(format($q$update zcm.memberships set role='resident' where user_id=%L$q$, t.uid(1))) like '%at least one verified admin%', 'the last admin cannot be demoted';
  assert t.fails('select zcm.delete_my_account()') like '%only admin%', 'the only admin cannot delete their account';
  update zcm.memberships set role = 'admin' where user_id = t.uid(6);
  update zcm.memberships set role = 'resident' where user_id = t.uid(1);
  assert (select role from zcm.memberships where user_id = t.uid(1)) = 'resident', 'with a second admin, the first can step down';
  perform t.su();
  update zcm.memberships set role = 'admin' where user_id = t.uid(1);
  raise notice 'ok 9 admins';
end $$;

-- ═══ 9. deleting an account removes everything they own ═══
do $$ declare k uuid; s uuid; l uuid; c uuid; begin
  select id into k from zcm.communities where slug = 'kijani-ridge';
  insert into auth.users(id, email) values (t.uid(7), 'user7@example.test');
  update zcm.profiles set username = 'grace' where id = t.uid(7);
  insert into zcm.memberships(community_id, user_id, unit, status, reviewed_by) values (k, t.uid(7), 'U7', 'verified', t.uid(1));
  perform t.become(7);
  insert into zcm.sellers(community_id, user_id, display_name) values (k, t.uid(7), 'Grace') returning id into s;
  insert into zcm.listings(seller_id, kind, category, title) values (s, 'service', 'Tutoring', 'Maths') returning id into l;
  perform t.become(3);
  c := zcm.start_conversation(l);
  insert into zcm.messages(conversation_id, sender_id, body) values (c, t.uid(3), 'hi grace');
  perform t.become(7);
  perform zcm.delete_my_account();
  perform t.su();
  assert not exists (select 1 from auth.users where id = t.uid(7)), 'the user is gone';
  assert not exists (select 1 from zcm.profiles where id = t.uid(7)) and not exists (select 1 from zcm.memberships where user_id = t.uid(7)), 'their profile and membership are gone';
  assert not exists (select 1 from zcm.listings where id = l), 'their listings are gone';
  assert not exists (select 1 from zcm.messages where conversation_id = c), 'their chats are gone';
  -- an admin who verified other residents can be deleted: reviewed_by just becomes null
  update zcm.memberships set role = 'admin' where user_id = t.uid(6);
  perform t.become(1);
  perform zcm.delete_my_account();
  perform t.su();
  assert not exists (select 1 from auth.users where id = t.uid(1)), 'an admin with a successor can delete their account';
  assert (select count(*) from zcm.memberships where reviewed_by is null) > 0, 'reviewed_by is cleared, not blocking';
  raise notice 'ok 10 account deletion';
end $$;
