set search_path = zcm, public, extensions;

-- Usernames (public identity) and in-app chat.

-- ───────────── Usernames ─────────────
alter table zcm.profiles
  add column username text unique check (username ~ '^[a-z0-9_]{3,20}$');

-- What neighbours may see about each other: username only (never name/phone/email).
-- Runs as the view owner on purpose; the WHERE clause is the access check.
create view zcm.member_names as
  select m.community_id, m.user_id, p.username
  from zcm.memberships m
  join zcm.profiles p on p.id = m.user_id
  where m.status = 'verified'
    and p.username is not null
    and (zcm.is_verified_member(m.community_id) or m.user_id = auth.uid());
revoke all on zcm.member_names from public, anon;
grant select on zcm.member_names to authenticated;

create function zcm.is_username_available(u text) returns boolean
language sql stable security definer set search_path = zcm as $$
  select not exists (select 1 from profiles where username = lower(u));
$$;
revoke all on function zcm.is_username_available(text) from public, anon;
grant execute on function zcm.is_username_available(text) to authenticated;

-- ───────────── Shadowban helper ─────────────
create function zcm.is_shadowbanned(cid uuid, uid uuid) returns boolean
language sql stable security definer set search_path = zcm as $$
  select coalesce((select shadowbanned from memberships where community_id = cid and user_id = uid), false);
$$;

-- ───────────── Conversations ─────────────
create table zcm.conversations (
  id              uuid primary key default gen_random_uuid(),
  community_id    uuid not null references zcm.communities(id) on delete cascade,
  listing_id      uuid references zcm.listings(id) on delete set null,
  initiator_id    uuid not null references zcm.profiles(id) on delete cascade,
  recipient_id    uuid not null references zcm.profiles(id) on delete cascade,
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  check (initiator_id <> recipient_id),
  unique (listing_id, initiator_id, recipient_id)
);
create index on zcm.conversations (initiator_id);
create index on zcm.conversations (recipient_id);

create table zcm.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references zcm.conversations(id) on delete cascade,
  sender_id       uuid not null references zcm.profiles(id) on delete cascade,
  body            text not null check (char_length(body) between 1 and 2000),
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index on zcm.messages (conversation_id, created_at);

-- Spam guard (doc: rate limiting): max 20 messages per sender per minute.
create function zcm.messages_before_insert() returns trigger
language plpgsql security definer set search_path = zcm as $$
begin
  if (select count(*) from messages where sender_id = new.sender_id
        and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'You are sending messages too fast. Please wait a moment.';
  end if;
  update conversations set last_message_at = now() where id = new.conversation_id;
  return new;
end $$;
create trigger messages_guard before insert on zcm.messages
  for each row execute function zcm.messages_before_insert();

alter table zcm.conversations enable row level security;
alter table zcm.messages enable row level security;

create function zcm.in_conversation(cid uuid) returns boolean
language sql stable security definer set search_path = zcm as $$
  select exists (select 1 from conversations
                 where id = cid and auth.uid() in (initiator_id, recipient_id)
                   and zcm.is_verified_member(community_id));
$$;

create policy conv_read on zcm.conversations for select to authenticated
  using (auth.uid() in (initiator_id, recipient_id) and zcm.is_verified_member(community_id));
-- no insert policy: conversations are created only through start_conversation()

create policy msg_read on zcm.messages for select to authenticated using (
  zcm.in_conversation(conversation_id)
  and (sender_id = auth.uid()   -- a shadowbanned sender's messages never reach the other side
       or not zcm.is_shadowbanned((select community_id from conversations c where c.id = conversation_id), sender_id)));
create policy msg_send on zcm.messages for insert to authenticated
  with check (sender_id = auth.uid() and zcm.in_conversation(conversation_id));

-- Start (or reopen) a chat about a listing.
create function zcm.start_conversation(lid uuid) returns uuid
language plpgsql security definer set search_path = zcm as $$
declare l listings; owner uuid; cid uuid;
begin
  select * into l from listings where id = lid and status = 'active';
  if l.id is null or not zcm.is_verified_member(l.community_id) or not zcm.seller_visible(l.seller_id) then
    raise exception 'Listing not found';
  end if;
  select user_id into owner from sellers where id = l.seller_id;
  if owner = auth.uid() then raise exception 'This is your own listing'; end if;
  insert into conversations (community_id, listing_id, initiator_id, recipient_id)
  values (l.community_id, lid, auth.uid(), owner)
  on conflict (listing_id, initiator_id, recipient_id) do update set listing_id = excluded.listing_id
  returning id into cid;
  return cid;
end $$;
revoke all on function zcm.start_conversation(uuid) from public, anon;
grant execute on function zcm.start_conversation(uuid) to authenticated;

-- Mark everything the other person sent as read.
create function zcm.mark_read(cid uuid) returns void
language sql security definer set search_path = zcm as $$
  update messages set read_at = now()
  where conversation_id = cid and sender_id <> auth.uid() and read_at is null
    and zcm.in_conversation(cid);
$$;
revoke all on function zcm.mark_read(uuid) from public, anon;
grant execute on function zcm.mark_read(uuid) to authenticated;

-- Reports may now also target a user (from inside a chat).
alter table zcm.reports drop constraint reports_target_type_check;
alter table zcm.reports add constraint reports_target_type_check
  check (target_type in ('listing','review','seller','user'));

-- Realtime: push new messages to open chats (RLS still applies to what each client receives).
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table zcm.messages;
  end if;
end $$;
