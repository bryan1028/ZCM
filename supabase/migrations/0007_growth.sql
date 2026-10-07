set search_path = zcm, public, extensions;

-- Growth: invite links with referrals, announcements, listing videos, one-call new-community setup.

-- ───────────── Invite links ─────────────
-- Codes live in their own admin-only table so signed-in strangers can't harvest other estates' codes.
create table zcm.community_invites (
  community_id uuid primary key references zcm.communities(id) on delete cascade,
  code         text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)
);
insert into zcm.community_invites (community_id) select id from zcm.communities on conflict do nothing;
alter table zcm.community_invites enable row level security;
create policy invites_admin on zcm.community_invites for select to authenticated using (zcm.is_community_admin(community_id));

create function zcm.on_community_created() returns trigger
language plpgsql security definer set search_path = zcm as $$
begin insert into community_invites (community_id) values (new.id) on conflict do nothing; return new; end $$;
create trigger communities_invite after insert on zcm.communities for each row execute function zcm.on_community_created();

-- Landing page for an invite link: works for signed-out visitors, reveals only the name.
create function zcm.community_by_invite(c text) returns table (id uuid, slug text, name text)
language sql stable security definer set search_path = zcm as $$
  select co.id, co.slug, co.name from communities co join community_invites i on i.community_id = co.id where i.code = c;
$$;
revoke all on function zcm.community_by_invite(text) from public;
grant execute on function zcm.community_by_invite(text) to anon, authenticated;

-- Verified residents can fetch their community's code so they can invite neighbours.
create function zcm.get_invite_code(cid uuid) returns text
language sql stable security definer set search_path = zcm as $$
  select code from community_invites where community_id = cid and zcm.is_verified_member(cid);
$$;
revoke all on function zcm.get_invite_code(uuid) from public, anon;
grant execute on function zcm.get_invite_code(uuid) to authenticated;

create function zcm.rotate_invite_code(cid uuid) returns text
language plpgsql security definer set search_path = zcm as $$
declare c text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
begin
  if not zcm.is_community_admin(cid) then raise exception 'Admins only'; end if;
  update community_invites set code = c where community_id = cid;
  return c;
end $$;
revoke all on function zcm.rotate_invite_code(uuid) from public, anon;
grant execute on function zcm.rotate_invite_code(uuid) to authenticated;

-- Referral claim: "invited by @someone". Kept only if that person is a verified member (admins see it as a vouch).
alter table zcm.memberships add column invited_by_username text;
create function zcm.memberships_check_referral() returns trigger
language plpgsql security definer set search_path = zcm as $$
begin
  if new.invited_by_username is not null and not exists (
      select 1 from memberships m join profiles p on p.id = m.user_id
      where m.community_id = new.community_id and m.status = 'verified' and p.username = lower(new.invited_by_username)) then
    new.invited_by_username := null;
  else
    new.invited_by_username := lower(new.invited_by_username);
  end if;
  return new;
end $$;
create trigger memberships_referral before insert on zcm.memberships for each row execute function zcm.memberships_check_referral();

-- ───────────── Announcements (community newsfeed from admins) ─────────────
create table zcm.announcements (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references zcm.communities(id) on delete cascade,
  author_id    uuid not null references zcm.profiles(id) on delete cascade,
  title        text not null check (char_length(title) between 3 and 120),
  body         text check (char_length(body) <= 2000),
  pinned       boolean not null default false,
  created_at   timestamptz not null default now()
);
create index on zcm.announcements (community_id, created_at desc);
alter table zcm.announcements enable row level security;
create policy ann_read on zcm.announcements for select to authenticated using (zcm.is_verified_member(community_id));
create policy ann_write on zcm.announcements for insert to authenticated
  with check (author_id = auth.uid() and zcm.is_community_admin(community_id));
create policy ann_update on zcm.announcements for update to authenticated
  using (zcm.is_community_admin(community_id)) with check (zcm.is_community_admin(community_id));
create policy ann_delete on zcm.announcements for delete to authenticated using (zcm.is_community_admin(community_id));

-- ───────────── Videos on listings ─────────────
alter table zcm.plan_limits add column max_videos int not null default 1;
update zcm.plan_limits set max_videos = 3 where plan = 'pro';
alter table zcm.listings add column video_urls text[] not null default '{}';

create or replace function zcm.listings_before_write() returns trigger
language plpgsql security definer set search_path = zcm as $$
declare s sellers; lim plan_limits; active_count int;
begin
  select * into s from sellers where id = new.seller_id;
  new.community_id := s.community_id;
  select * into lim from plan_limits where account_type = s.account_type and plan = s.plan;

  if new.status = 'active' and lim.max_active_listings is not null then
    select count(*) into active_count from listings
      where seller_id = new.seller_id and status = 'active'
        and (tg_op = 'INSERT' or id <> new.id);
    if active_count >= lim.max_active_listings then
      raise exception 'Listing limit reached for your plan (%).', lim.max_active_listings;
    end if;
  end if;
  if cardinality(new.image_urls) > lim.max_images then
    raise exception 'Too many images for your plan (max %).', lim.max_images;
  end if;
  if cardinality(new.video_urls) > lim.max_videos then
    raise exception 'Too many videos for your plan (max %).', lim.max_videos;
  end if;
  if new.featured_until is not null and not lim.can_feature
     and auth.uid() is not null then
    raise exception 'Featuring listings requires a business Pro plan.';
  end if;
  return new;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('zcm-listing-videos', 'zcm-listing-videos', false, 20971520, array['video/mp4','video/webm','video/quicktime'])
on conflict (id) do nothing;
create policy zcm_listing_videos_read on storage.objects for select to authenticated using (
  bucket_id = 'zcm-listing-videos' and zcm.is_verified_member(zcm.safe_uuid((storage.foldername(name))[1])));
create policy zcm_listing_videos_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'zcm-listing-videos' and (storage.foldername(name))[2] = auth.uid()::text
  and zcm.is_verified_member(zcm.safe_uuid((storage.foldername(name))[1])));
create policy zcm_listing_videos_delete on storage.objects for delete to authenticated using (
  bucket_id = 'zcm-listing-videos' and (storage.foldername(name))[2] = auth.uid()::text);

-- ───────────── Launching the next estate: one call ─────────────
-- Run in the SQL editor (not callable from the app):
--   select create_community('green-park', 'Green Park', 'Nairobi', 'admin@example.com');
-- The admin must have signed in once so their account exists; they become the verified admin.
create function zcm.create_community(p_slug text, p_name text, p_city text, p_admin_email text) returns text
language plpgsql security definer set search_path = zcm as $$
declare cid uuid; uid uuid; invite text;
begin
  insert into communities (slug, name, city) values (p_slug, p_name, p_city) returning id into cid;
  select i.code into invite from community_invites i where i.community_id = cid;
  select id into uid from auth.users where lower(email) = lower(p_admin_email);
  if uid is null then
    return 'Community created, but no account found for ' || p_admin_email || ' — have them sign in once, then run: select make_community_admin(''' || p_slug || ''', ''' || p_admin_email || ''');';
  end if;
  insert into memberships (community_id, user_id, role, status, unit, reviewed_at) values (cid, uid, 'admin', 'verified', 'admin', now());
  return 'Created ' || p_name || '. Invite link: /invite/' || invite;
end $$;

create function zcm.make_community_admin(p_slug text, p_email text) returns void
language plpgsql security definer set search_path = zcm as $$
declare cid uuid; uid uuid;
begin
  select id into cid from communities where slug = p_slug;
  select id into uid from auth.users where lower(email) = lower(p_email);
  if cid is null or uid is null then raise exception 'community or user not found'; end if;
  insert into memberships (community_id, user_id, role, status, unit, reviewed_at) values (cid, uid, 'admin', 'verified', 'admin', now())
  on conflict (community_id, user_id) do update set role = 'admin', status = 'verified', reviewed_at = now();
end $$;
revoke all on function zcm.create_community(text,text,text,text), zcm.make_community_admin(text,text) from public, anon, authenticated;
