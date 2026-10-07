set search_path = zcm, public, extensions;

-- Zist Community Marketplaces — core schema.
-- Multi-tenant by design: every row that belongs to a community carries community_id,
-- and RLS only lets *verified members of that community* see or touch it.
-- Adding a new estate = inserting one row into `communities`. No code or schema change.


-- ───────────────────────── Communities ─────────────────────────
create table zcm.communities (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name       text not null,
  city       text,
  currency   text not null default 'KES',
  created_at timestamptz not null default now()
);

-- ───────────────────────── Profiles (1:1 with auth.users) ─────────────────────────
create table zcm.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  phone      text,
  created_at timestamptz not null default now()
);

create function zcm.handle_new_user() returns trigger
language plpgsql security definer set search_path = zcm as $$
begin
  insert into zcm.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end $$;

create trigger zcm_on_auth_user_created after insert on auth.users
  for each row execute function zcm.handle_new_user();

-- ───────────────────────── Memberships = the residency gate ─────────────────────────
-- A person can belong to several communities. Only `verified` rows grant access.
create table zcm.memberships (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references zcm.communities(id) on delete cascade,
  user_id      uuid not null references zcm.profiles(id) on delete cascade,
  role         text not null default 'resident' check (role in ('resident','admin')),
  status       text not null default 'pending' check (status in ('pending','verified','rejected','suspended')),
  unit         text not null,                 -- house / apartment number the person claims
  proof_note   text,                          -- e.g. "lease holder", "known to Mr. Otieno (block C)"
  reviewed_by  uuid references auth.users(id),
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now(),
  unique (community_id, user_id)
);
create index on zcm.memberships (user_id);
create index on zcm.memberships (community_id, status);

-- RLS helpers (security definer so policies don't recurse into memberships RLS)
create function zcm.is_verified_member(cid uuid) returns boolean
language sql stable security definer set search_path = zcm as $$
  select exists (select 1 from memberships
                 where community_id = cid and user_id = auth.uid() and status = 'verified');
$$;

create function zcm.is_community_admin(cid uuid) returns boolean
language sql stable security definer set search_path = zcm as $$
  select exists (select 1 from memberships
                 where community_id = cid and user_id = auth.uid()
                   and status = 'verified' and role = 'admin');
$$;

-- ───────────────────────── Plans & limits (the monetisation lever) ─────────────────────────
-- Change a row here to change what a tier gets; no deploys needed.
create table zcm.plan_limits (
  account_type        text not null check (account_type in ('individual','business')),
  plan                text not null check (plan in ('free','pro')),
  max_active_listings int,                     -- null = unlimited
  can_feature         boolean not null default false,
  can_see_analytics   boolean not null default false,
  max_images          int not null default 3,
  primary key (account_type, plan)
);
insert into zcm.plan_limits values
  ('individual','free',  5, false, false, 3),
  ('individual','pro',  15, false, false, 5),
  ('business',  'free', 20, false, false, 5),
  ('business',  'pro', null, true,  true, 10);

-- ───────────────────────── Sellers (one seller profile per user per community) ─────────────────────────
create table zcm.sellers (
  id            uuid primary key default gen_random_uuid(),
  community_id  uuid not null references zcm.communities(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  account_type  text not null default 'individual' check (account_type in ('individual','business')),
  plan          text not null default 'free' check (plan in ('free','pro')),
  display_name  text not null,
  business_name text,
  bio           text,
  whatsapp      text,
  created_at    timestamptz not null default now(),
  unique (community_id, user_id),
  check (account_type = 'individual' or business_name is not null)
);

-- Users may not upgrade their own plan; only service role / SQL editor can.
create function zcm.guard_seller_plan() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null and new.plan <> 'free' and (tg_op = 'INSERT' or new.plan <> old.plan) then
    raise exception 'plan can only be changed by the platform';
  end if;
  return new;
end $$;
create trigger sellers_guard_plan before insert or update on zcm.sellers
  for each row execute function zcm.guard_seller_plan();

-- ───────────────────────── Listings: one table, two tabs ─────────────────────────
create table zcm.listings (
  id            uuid primary key default gen_random_uuid(),
  community_id  uuid not null references zcm.communities(id) on delete cascade,
  seller_id     uuid not null references zcm.sellers(id) on delete cascade,
  kind          text not null check (kind in ('service','product')),   -- Services tab / Products tab
  category      text not null,
  title         text not null check (char_length(title) between 3 and 120),
  description   text,
  price_cents   int check (price_cents >= 0),
  price_unit    text not null default 'fixed' check (price_unit in ('fixed','per_hour','per_job','negotiable')),
  image_urls    text[] not null default '{}',
  status        text not null default 'active' check (status in ('active','paused','sold','removed')),
  featured_until timestamptz,
  created_at    timestamptz not null default now()
);
create index on zcm.listings (community_id, kind, status, created_at desc);
create index on zcm.listings (seller_id);

-- community_id always comes from the seller (can't be spoofed); enforce plan limits.
create function zcm.listings_before_write() returns trigger
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
  if new.featured_until is not null and not lim.can_feature
     and auth.uid() is not null then
    raise exception 'Featuring listings requires a business Pro plan.';
  end if;
  return new;
end $$;
create trigger listings_guard before insert or update on zcm.listings
  for each row execute function zcm.listings_before_write();

-- ───────────────────────── Row Level Security ─────────────────────────
alter table zcm.communities  enable row level security;
alter table zcm.profiles     enable row level security;
alter table zcm.memberships  enable row level security;
alter table zcm.plan_limits  enable row level security;
alter table zcm.sellers      enable row level security;
alter table zcm.listings     enable row level security;

-- communities: anyone signed in can see the list (needed to request to join)
create policy communities_read on zcm.communities for select to authenticated using (true);

-- plan_limits: readable so the UI can show what each tier offers
create policy plan_limits_read on zcm.plan_limits for select to authenticated using (true);

-- profiles: own row; community admins can see applicants' names when reviewing
create policy profiles_self on zcm.profiles for select to authenticated using (id = auth.uid());
create policy profiles_self_update on zcm.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin_review on zcm.profiles for select to authenticated using (
  exists (select 1 from memberships m
          where m.user_id = profiles.id and zcm.is_community_admin(m.community_id)));

-- memberships: apply as pending resident only; only admins verify/reject
create policy memberships_read on zcm.memberships for select to authenticated
  using (user_id = auth.uid() or zcm.is_community_admin(community_id));
create policy memberships_apply on zcm.memberships for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending' and role = 'resident');
create policy memberships_admin_update on zcm.memberships for update to authenticated
  using (zcm.is_community_admin(community_id))
  with check (zcm.is_community_admin(community_id));

-- sellers: visible to verified members; you manage only your own
create policy sellers_read on zcm.sellers for select to authenticated
  using (zcm.is_verified_member(community_id));
create policy sellers_insert on zcm.sellers for insert to authenticated
  with check (user_id = auth.uid() and zcm.is_verified_member(community_id));
create policy sellers_update on zcm.sellers for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- listings: visible to verified members; sellers manage their own; admins can moderate
create policy listings_read on zcm.listings for select to authenticated
  using (zcm.is_verified_member(community_id));
create policy listings_insert on zcm.listings for insert to authenticated
  with check (exists (select 1 from sellers s where s.id = seller_id and s.user_id = auth.uid()
                      and zcm.is_verified_member(s.community_id)));
create policy listings_update on zcm.listings for update to authenticated
  using (exists (select 1 from sellers s where s.id = seller_id and s.user_id = auth.uid())
         or zcm.is_community_admin(community_id))
  with check (exists (select 1 from sellers s where s.id = seller_id and s.user_id = auth.uid())
         or zcm.is_community_admin(community_id));
create policy listings_delete on zcm.listings for delete to authenticated
  using (exists (select 1 from sellers s where s.id = seller_id and s.user_id = auth.uid())
         or zcm.is_community_admin(community_id));
