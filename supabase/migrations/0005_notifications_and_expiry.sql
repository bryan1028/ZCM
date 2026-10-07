-- Notifications (in-app + web push), automatic reservation expiry.

create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  type         text not null,                 -- message | reservation | membership | ...
  title        text not null,
  body         text,
  url          text not null,                 -- where tapping it goes
  read_at      timestamptz,
  pushed_at    timestamptz,                   -- set once a web push was attempted
  created_at   timestamptz not null default now()
);
create index on public.notifications (user_id, read_at, created_at desc);
create index on public.notifications (pushed_at) where pushed_at is null;

create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
create policy notif_read on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notif_mark on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;     -- users can only mark as read
create policy subs_read on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy subs_add on public.push_subscriptions for insert to authenticated with check (user_id = auth.uid());
create policy subs_del on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());

-- helper used by the triggers below
create function public.notify(uid uuid, cid uuid, kind text, t text, b text, link text, collapse boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  if collapse and exists (select 1 from notifications where user_id = uid and url = link and type = kind and read_at is null) then
    return;                                    -- don't stack up 20 "new message" rows for one chat
  end if;
  insert into notifications (user_id, community_id, type, title, body, url) values (uid, cid, kind, t, b, link);
end $$;
revoke all on function public.notify(uuid,uuid,text,text,text,text,boolean) from public, anon, authenticated;

create function public.slug_of(cid uuid) returns text
language sql stable security definer set search_path = public as $$ select slug from communities where id = cid $$;

-- ───────────── Messages ─────────────
create function public.on_message_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare c conversations; other uuid; uname text;
begin
  select * into c from conversations where id = new.conversation_id;
  other := case when new.sender_id = c.initiator_id then c.recipient_id else c.initiator_id end;
  if public.is_shadowbanned(c.community_id, new.sender_id) then return new; end if;
  select username into uname from profiles where id = new.sender_id;
  perform public.notify(other, c.community_id, 'message', 'New message from @' || coalesce(uname, 'a neighbour'),
    left(new.body, 100), '/c/' || public.slug_of(c.community_id) || '/inbox/' || c.id, true);
  return new;
end $$;
create trigger messages_notify after insert on public.messages for each row execute function public.on_message_notify();

-- ───────────── Reservations ─────────────
create function public.on_reservation_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare lt text; link text; actor uuid := auth.uid();
begin
  select title into lt from listings where id = new.listing_id;
  link := '/c/' || public.slug_of(new.community_id) || '/orders';
  if tg_op = 'INSERT' then
    perform public.notify(new.seller_user_id, new.community_id, 'reservation', 'New request: ' || lt, 'Quantity ' || new.quantity, link);
  elsif new.status is distinct from old.status then
    if new.status = 'accepted' and old.status = 'paid' then
      perform public.notify(new.buyer_id, new.community_id, 'reservation', 'Payment proof rejected', lt || ' — please send a clearer proof', link);
    elsif new.status = 'accepted' then
      perform public.notify(new.buyer_id, new.community_id, 'reservation', 'Accepted: ' || lt, 'Pay the seller and upload your proof', link);
    elsif new.status = 'declined' then
      perform public.notify(new.buyer_id, new.community_id, 'reservation', 'Declined: ' || lt, null, link);
    elsif new.status = 'paid' then
      perform public.notify(new.seller_user_id, new.community_id, 'reservation', 'Payment proof received', lt, link);
    elsif new.status = 'completed' then
      perform public.notify(new.buyer_id, new.community_id, 'reservation', 'Order completed: ' || lt, 'Leave a review!', link);
    elsif new.status = 'cancelled' then
      perform public.notify(case when actor = new.buyer_id then new.seller_user_id else new.buyer_id end,
        new.community_id, 'reservation', 'Cancelled: ' || lt, null, link);
    elsif new.status = 'expired' then
      perform public.notify(new.buyer_id, new.community_id, 'reservation', 'Expired: ' || lt, null, link);
      perform public.notify(new.seller_user_id, new.community_id, 'reservation', 'Expired: ' || lt, null, link);
    end if;
  end if;
  return new;
end $$;
create trigger reservations_notify after insert or update of status on public.reservations
  for each row execute function public.on_reservation_notify();

-- ───────────── Membership: tell admins about applicants, tell applicants they're in ─────────────
create function public.on_membership_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare a record; slug text := public.slug_of(new.community_id);
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    for a in select user_id from memberships where community_id = new.community_id and role = 'admin' and status = 'verified' loop
      perform public.notify(a.user_id, new.community_id, 'membership', 'New resident to verify', 'Unit ' || new.unit, '/c/' || slug || '/admin', true);
    end loop;
  elsif tg_op = 'UPDATE' and new.status = 'verified' and old.status <> 'verified' then
    perform public.notify(new.user_id, new.community_id, 'membership', 'You''re verified 🎉', 'Welcome to the community', '/c/' || slug);
  end if;
  return new;
end $$;
create trigger memberships_notify after insert or update of status on public.memberships
  for each row execute function public.on_membership_notify();

-- ───────────── Reservation expiry ─────────────
create function public.expire_reservations() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update reservations set status = 'expired', updated_at = now()
  where status in ('requested','accepted') and expires_at < now();
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.expire_reservations() from public, anon, authenticated;

-- Run every 15 minutes where pg_cron is available (Supabase: yes). Otherwise lazy expiry in
-- transition_reservation()/reserved_units() still keeps results correct.
do $$ begin
  create extension if not exists pg_cron;
  perform cron.schedule('expire-reservations', '*/15 * * * *', 'select public.expire_reservations()');
exception when others then
  raise notice 'pg_cron unavailable (%); skipping schedule', sqlerrm;
end $$;

-- Save/replace a push subscription for the current user (a shared phone may switch accounts).
create function public.save_push_subscription(ep text, p256 text, au text) returns void
language sql security definer set search_path = public as $$
  insert into push_subscriptions (user_id, endpoint, p256dh, auth) values (auth.uid(), ep, p256, au)
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth;
$$;
revoke all on function public.save_push_subscription(text,text,text) from public, anon;
grant execute on function public.save_push_subscription(text,text,text) to authenticated;
