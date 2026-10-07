set search_path = zcm, public, extensions;

-- Notifications (in-app + web push), automatic reservation expiry.

create table zcm.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references zcm.profiles(id) on delete cascade,
  community_id uuid not null references zcm.communities(id) on delete cascade,
  type         text not null,                 -- message | reservation | membership | ...
  title        text not null,
  body         text,
  url          text not null,                 -- where tapping it goes
  read_at      timestamptz,
  pushed_at    timestamptz,                   -- set once a web push was attempted
  created_at   timestamptz not null default now()
);
create index on zcm.notifications (user_id, read_at, created_at desc);
create index on zcm.notifications (pushed_at) where pushed_at is null;

create table zcm.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references zcm.profiles(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

alter table zcm.notifications enable row level security;
alter table zcm.push_subscriptions enable row level security;
create policy notif_read on zcm.notifications for select to authenticated using (user_id = auth.uid());
create policy notif_mark on zcm.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on zcm.notifications from authenticated;
grant update (read_at) on zcm.notifications to authenticated;     -- users can only mark as read
create policy subs_read on zcm.push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy subs_add on zcm.push_subscriptions for insert to authenticated with check (user_id = auth.uid());
create policy subs_del on zcm.push_subscriptions for delete to authenticated using (user_id = auth.uid());

-- helper used by the triggers below
create function zcm.notify(uid uuid, cid uuid, kind text, t text, b text, link text, collapse boolean default false)
returns void language plpgsql security definer set search_path = zcm as $$
begin
  if collapse and exists (select 1 from notifications where user_id = uid and url = link and type = kind and read_at is null) then
    return;                                    -- don't stack up 20 "new message" rows for one chat
  end if;
  insert into notifications (user_id, community_id, type, title, body, url) values (uid, cid, kind, t, b, link);
end $$;
revoke all on function zcm.notify(uuid,uuid,text,text,text,text,boolean) from public, anon, authenticated;

create function zcm.slug_of(cid uuid) returns text
language sql stable security definer set search_path = zcm as $$ select slug from communities where id = cid $$;

-- ───────────── Messages ─────────────
create function zcm.on_message_notify() returns trigger
language plpgsql security definer set search_path = zcm as $$
declare c conversations; other uuid; uname text;
begin
  select * into c from conversations where id = new.conversation_id;
  other := case when new.sender_id = c.initiator_id then c.recipient_id else c.initiator_id end;
  if zcm.is_shadowbanned(c.community_id, new.sender_id) then return new; end if;
  select username into uname from profiles where id = new.sender_id;
  perform zcm.notify(other, c.community_id, 'message', 'New message from @' || coalesce(uname, 'a neighbour'),
    left(new.body, 100), '/c/' || zcm.slug_of(c.community_id) || '/inbox/' || c.id, true);
  return new;
end $$;
create trigger messages_notify after insert on zcm.messages for each row execute function zcm.on_message_notify();

-- ───────────── Reservations ─────────────
create function zcm.on_reservation_notify() returns trigger
language plpgsql security definer set search_path = zcm as $$
declare lt text; link text; actor uuid := auth.uid();
begin
  select title into lt from listings where id = new.listing_id;
  link := '/c/' || zcm.slug_of(new.community_id) || '/orders';
  if tg_op = 'INSERT' then
    perform zcm.notify(new.seller_user_id, new.community_id, 'reservation', 'New request: ' || lt, 'Quantity ' || new.quantity, link);
  elsif new.status is distinct from old.status then
    if new.status = 'accepted' and old.status = 'paid' then
      perform zcm.notify(new.buyer_id, new.community_id, 'reservation', 'Payment proof rejected', lt || ' — please send a clearer proof', link);
    elsif new.status = 'accepted' then
      perform zcm.notify(new.buyer_id, new.community_id, 'reservation', 'Accepted: ' || lt, 'Pay the seller and upload your proof', link);
    elsif new.status = 'declined' then
      perform zcm.notify(new.buyer_id, new.community_id, 'reservation', 'Declined: ' || lt, null, link);
    elsif new.status = 'paid' then
      perform zcm.notify(new.seller_user_id, new.community_id, 'reservation', 'Payment proof received', lt, link);
    elsif new.status = 'completed' then
      perform zcm.notify(new.buyer_id, new.community_id, 'reservation', 'Order completed: ' || lt, 'Leave a review!', link);
    elsif new.status = 'cancelled' then
      perform zcm.notify(case when actor = new.buyer_id then new.seller_user_id else new.buyer_id end,
        new.community_id, 'reservation', 'Cancelled: ' || lt, null, link);
    elsif new.status = 'expired' then
      perform zcm.notify(new.buyer_id, new.community_id, 'reservation', 'Expired: ' || lt, null, link);
      perform zcm.notify(new.seller_user_id, new.community_id, 'reservation', 'Expired: ' || lt, null, link);
    end if;
  end if;
  return new;
end $$;
create trigger reservations_notify after insert or update of status on zcm.reservations
  for each row execute function zcm.on_reservation_notify();

-- ───────────── Membership: tell admins about applicants, tell applicants they're in ─────────────
create function zcm.on_membership_notify() returns trigger
language plpgsql security definer set search_path = zcm as $$
declare a record; slug text := zcm.slug_of(new.community_id);
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    for a in select user_id from memberships where community_id = new.community_id and role = 'admin' and status = 'verified' loop
      perform zcm.notify(a.user_id, new.community_id, 'membership', 'New resident to verify', 'Unit ' || new.unit, '/c/' || slug || '/admin', true);
    end loop;
  elsif tg_op = 'UPDATE' and new.status = 'verified' and old.status <> 'verified' then
    perform zcm.notify(new.user_id, new.community_id, 'membership', 'You''re verified 🎉', 'Welcome to the community', '/c/' || slug);
  end if;
  return new;
end $$;
create trigger memberships_notify after insert or update of status on zcm.memberships
  for each row execute function zcm.on_membership_notify();

-- ───────────── Reservation expiry ─────────────
create function zcm.expire_reservations() returns int
language plpgsql security definer set search_path = zcm as $$
declare n int;
begin
  update reservations set status = 'expired', updated_at = now()
  where status in ('requested','accepted') and expires_at < now();
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function zcm.expire_reservations() from public, anon, authenticated;

-- Run every 15 minutes where pg_cron is available (Supabase: yes). Otherwise lazy expiry in
-- transition_reservation()/reserved_units() still keeps results correct.
do $$ begin
  create extension if not exists pg_cron;
  perform cron.schedule('expire-reservations', '*/15 * * * *', 'select zcm.expire_reservations()');
exception when others then
  raise notice 'pg_cron unavailable (%); skipping schedule', sqlerrm;
end $$;

-- Save/replace a push subscription for the current user (a shared phone may switch accounts).
create function zcm.save_push_subscription(ep text, p256 text, au text) returns void
language sql security definer set search_path = zcm as $$
  insert into push_subscriptions (user_id, endpoint, p256dh, auth) values (auth.uid(), ep, p256, au)
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth;
$$;
revoke all on function zcm.save_push_subscription(text,text,text) from public, anon;
grant execute on function zcm.save_push_subscription(text,text,text) to authenticated;
