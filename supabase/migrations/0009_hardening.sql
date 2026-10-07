set search_path = zcm, public, extensions;

-- Hardening pass (from Supabase's security + performance advisors and a manual review).
--  1. only the functions the app/RLS actually need are callable through the public API
--  2. no SECURITY DEFINER view; usernames come from a checked function instead
--  3. shadowban status can't be probed by the banned user
--  4. RLS policies evaluate auth.uid() once per query, not once per row
--  5. indexes on every foreign key
--  6. a community can't lose its last admin; account deletion; per-community timezone

-- ───────────── new functions first (privileges are set at the end) ─────────────

-- Replaces the old member_names view. Returns usernames only for members of a community the caller belongs to.
create function zcm.usernames_for(cid uuid, ids uuid[]) returns table (user_id uuid, username text)
language sql stable security definer set search_path = zcm as $$
  select m.user_id, p.username
  from memberships m join profiles p on p.id = m.user_id
  where m.community_id = cid and m.status = 'verified' and p.username is not null
    and m.user_id = any(ids)
    and (is_verified_member(cid) or m.user_id = auth.uid());
$$;
drop view zcm.member_names;

-- "Is this sender's message hidden from me?" Takes the conversation, so it can only answer for senders in a
-- conversation the caller is part of (and never for the sender themselves).
create function zcm.msg_hidden(conv uuid, sender uuid) returns boolean
language sql stable security definer set search_path = zcm as $$
  select sender is distinct from auth.uid() and exists (
    select 1 from conversations c
    join memberships m on m.community_id = c.community_id and m.user_id = sender
    where c.id = conv and m.shadowbanned and auth.uid() in (c.initiator_id, c.recipient_id));
$$;
drop policy msg_read on zcm.messages;
create policy msg_read on zcm.messages for select to authenticated
  using (zcm.in_conversation(conversation_id) and not zcm.msg_hidden(conversation_id, sender_id));

-- A community must always keep at least one verified admin.
create function zcm.guard_last_admin() returns trigger
language plpgsql security definer set search_path = zcm as $$
begin
  if old.role = 'admin' and old.status = 'verified' and (new.role <> 'admin' or new.status <> 'verified')
     and not exists (select 1 from memberships
                     where community_id = old.community_id and role = 'admin' and status = 'verified' and id <> old.id) then
    raise exception 'A community must keep at least one verified admin';
  end if;
  return new;
end $$;
create trigger memberships_guard_last_admin before update on zcm.memberships
  for each row execute function zcm.guard_last_admin();

-- Deleting an account must not be blocked by "reviewed by"/"resolved by" references to the person.
alter table zcm.memberships drop constraint memberships_reviewed_by_fkey,
  add constraint memberships_reviewed_by_fkey foreign key (reviewed_by) references auth.users(id) on delete set null;
alter table zcm.reports drop constraint reports_resolved_by_fkey,
  add constraint reports_resolved_by_fkey foreign key (resolved_by) references zcm.profiles(id) on delete set null;

-- Self-service account deletion (the app removes the person's files first). Everything they own cascades.
create function zcm.delete_my_account() returns void
language plpgsql security definer set search_path = zcm as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if exists (
    select 1 from memberships m
    where m.user_id = auth.uid() and m.role = 'admin' and m.status = 'verified'
      and not exists (select 1 from memberships o where o.community_id = m.community_id
                      and o.role = 'admin' and o.status = 'verified' and o.user_id <> m.user_id)
  ) then
    raise exception 'You are the only admin of a community. Make someone else an admin before deleting your account.';
  end if;
  delete from auth.users where id = auth.uid();
end $$;

-- Dates are shown in the community's own timezone, not the server's.
alter table zcm.communities add column timezone text not null default 'Africa/Nairobi';

-- Unused: usernames are checked by the unique constraint instead.
drop function zcm.is_username_available(text);

-- BUG FIX: a resident could not create their own seller profile. INSERT ... RETURNING re-checks the SELECT policy against
-- the new row, but seller_visible() runs in the statement's snapshot and can't see that row yet. Owners now always see theirs.
drop policy sellers_read on zcm.sellers;
create policy sellers_read on zcm.sellers for select to authenticated
  using (zcm.is_verified_member(community_id)
         and (user_id = auth.uid() or zcm.seller_visible(id) or zcm.is_community_admin(community_id)));

-- ───────────── safer search paths ─────────────
alter function zcm.guard_seller_plan() set search_path = zcm;
alter function zcm.safe_uuid(text) set search_path = pg_catalog;

-- A buyer may delete their own payment-proof files (needed when they delete their account).
create policy zcm_proofs_delete on storage.objects for delete to authenticated using (
  bucket_id = 'zcm-payment-proofs' and exists (
    select 1 from zcm.reservations r
    where r.id = zcm.safe_uuid((storage.foldername(name))[1]) and r.buyer_id = (select auth.uid())));

-- ───────────── RLS: evaluate auth.uid() once per statement ─────────────
do $$
declare r record; q text; w text; cmd text;
begin
  for r in select schemaname, tablename, policyname, qual, with_check from pg_policies
           where schemaname = 'zcm' or (schemaname = 'storage' and policyname like 'zcm\_%') loop
    q := r.qual; w := r.with_check;
    if q is not null and q like '%auth.uid()%' and q not like '%SELECT auth.uid()%' then q := replace(q, 'auth.uid()', '(select auth.uid())'); end if;
    if w is not null and w like '%auth.uid()%' and w not like '%SELECT auth.uid()%' then w := replace(w, 'auth.uid()', '(select auth.uid())'); end if;
    if q is distinct from r.qual or w is distinct from r.with_check then
      cmd := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
      if q is distinct from r.qual then cmd := cmd || ' using (' || q || ')'; end if;
      if w is distinct from r.with_check then cmd := cmd || ' with check (' || w || ')'; end if;
      execute cmd;
    end if;
  end loop;
end $$;

-- ───────────── an index for every foreign key ─────────────
do $$
declare r record; cols text;
begin
  for r in select c.conrelid as relid, c.conrelid::regclass as tbl, c.conname, c.conkey
           from pg_constraint c join pg_namespace n on n.oid = c.connamespace
           where c.contype = 'f' and n.nspname = 'zcm' loop
    if not exists (select 1 from pg_index i where i.indrelid = r.relid
                   and (i.indkey::int2[])[0:array_length(r.conkey, 1) - 1] = r.conkey) then
      select string_agg(quote_ident(a.attname), ', ' order by k.ord) into cols
      from unnest(r.conkey) with ordinality as k(attnum, ord)
      join pg_attribute a on a.attrelid = r.relid and a.attnum = k.attnum;
      execute format('create index if not exists %I on %s (%s)', left(r.conname, 55) || '_idx', r.tbl, cols);
    end if;
  end loop;
end $$;

-- ───────────── function privileges: deny by default, grant what's needed ─────────────
revoke execute on all functions in schema zcm from public, anon, authenticated;
alter default privileges in schema zcm revoke execute on functions from public;

-- called by the app over the API
grant execute on function zcm.community_by_invite(text) to anon, authenticated;   -- public invite landing page
grant execute on function
  zcm.get_invite_code(uuid), zcm.rotate_invite_code(uuid),
  zcm.create_reservation(uuid, int, text), zcm.transition_reservation(uuid, text), zcm.submit_payment(uuid, text, text),
  zcm.start_conversation(uuid), zcm.mark_read(uuid), zcm.record_view(uuid),
  zcm.save_push_subscription(text, text, text), zcm.usernames_for(uuid, uuid[]), zcm.delete_my_account()
  to authenticated;
-- evaluated inside RLS policies, which run as the signed-in caller
grant execute on function
  zcm.is_verified_member(uuid), zcm.is_community_admin(uuid), zcm.in_conversation(uuid),
  zcm.seller_visible(uuid), zcm.msg_hidden(uuid, uuid), zcm.safe_uuid(text)
  to authenticated;
-- trigger functions, notify(), slug_of(), is_shadowbanned(), reserved_units(), expire_reservations(),
-- create_community(), make_community_admin() stay private: triggers/definer functions/the SQL editor use them.
grant execute on all functions in schema zcm to service_role;
