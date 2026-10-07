set search_path = zcm, public, extensions;

-- Trust & moderation: ratings, reports, shadowban, stock/availability, view analytics.

-- ───────────── Shadowban: user keeps posting, but nobody else sees them ─────────────
alter table zcm.memberships add column shadowbanned boolean not null default false;

create function zcm.seller_visible(sid uuid) returns boolean
language sql stable security definer set search_path = zcm as $$
  select exists (
    select 1 from sellers s
    join memberships m on m.community_id = s.community_id and m.user_id = s.user_id
    where s.id = sid
      and m.status = 'verified'                       -- banned/suspended sellers vanish
      and (not m.shadowbanned or s.user_id = auth.uid())
  );
$$;

drop policy sellers_read on zcm.sellers;
create policy sellers_read on zcm.sellers for select to authenticated
  using (zcm.is_verified_member(community_id) and
         (zcm.seller_visible(id) or zcm.is_community_admin(community_id)));

drop policy listings_read on zcm.listings;
create policy listings_read on zcm.listings for select to authenticated
  using (zcm.is_verified_member(community_id) and
         (zcm.seller_visible(seller_id) or zcm.is_community_admin(community_id)));

-- ───────────── Products: stock; both kinds: availability ─────────────
alter table zcm.listings
  add column stock int check (stock >= 0),                -- null = not tracked (services)
  add column available boolean not null default true;

-- ───────────── Reviews ─────────────
create table zcm.reviews (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references zcm.communities(id) on delete cascade,
  listing_id   uuid not null references zcm.listings(id) on delete cascade,
  seller_id    uuid not null references zcm.sellers(id) on delete cascade,
  reviewer_id  uuid not null references zcm.profiles(id) on delete cascade,
  rating       int not null check (rating between 1 and 5),
  comment      text check (char_length(comment) <= 1000),
  created_at   timestamptz not null default now(),
  unique (listing_id, reviewer_id)
);
create index on zcm.reviews (seller_id);

create function zcm.reviews_before_insert() returns trigger
language plpgsql security definer set search_path = zcm as $$
declare l listings; owner uuid;
begin
  select * into l from listings where id = new.listing_id;
  select user_id into owner from sellers where id = l.seller_id;
  if owner = new.reviewer_id then raise exception 'You cannot review your own listing'; end if;
  new.community_id := l.community_id;
  new.seller_id := l.seller_id;
  return new;
end $$;
create trigger reviews_guard before insert on zcm.reviews
  for each row execute function zcm.reviews_before_insert();

alter table zcm.reviews enable row level security;
create policy reviews_read on zcm.reviews for select to authenticated
  using (zcm.is_verified_member(community_id));
create policy reviews_insert on zcm.reviews for insert to authenticated
  with check (reviewer_id = auth.uid() and exists (
    select 1 from listings l where l.id = listing_id and zcm.is_verified_member(l.community_id)));
create policy reviews_update on zcm.reviews for update to authenticated
  using (reviewer_id = auth.uid()) with check (reviewer_id = auth.uid());
create policy reviews_delete on zcm.reviews for delete to authenticated
  using (reviewer_id = auth.uid() or zcm.is_community_admin(community_id));

create view zcm.listing_ratings with (security_invoker = true) as
  select listing_id, count(*)::int as review_count, round(avg(rating), 1) as avg_rating
  from zcm.reviews group by listing_id;
create view zcm.seller_ratings with (security_invoker = true) as
  select seller_id, count(*)::int as review_count, round(avg(rating), 1) as avg_rating
  from zcm.reviews group by seller_id;

-- ───────────── Reports ─────────────
create table zcm.reports (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references zcm.communities(id) on delete cascade,
  reporter_id  uuid not null references zcm.profiles(id) on delete cascade,
  target_type  text not null check (target_type in ('listing','review','seller')),
  target_id    uuid not null,
  reason       text not null check (char_length(reason) between 3 and 1000),
  status       text not null default 'open' check (status in ('open','resolved','dismissed')),
  resolved_by  uuid references zcm.profiles(id),
  resolved_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index on zcm.reports (community_id, status);
alter table zcm.reports enable row level security;
create policy reports_read on zcm.reports for select to authenticated
  using (reporter_id = auth.uid() or zcm.is_community_admin(community_id));
create policy reports_insert on zcm.reports for insert to authenticated
  with check (reporter_id = auth.uid() and status = 'open' and zcm.is_verified_member(community_id));
create policy reports_admin_update on zcm.reports for update to authenticated
  using (zcm.is_community_admin(community_id)) with check (zcm.is_community_admin(community_id));

-- ───────────── Views (analytics: "eyeballs") ─────────────
-- One row per viewer per listing per day; the owner and admins can read them.
create table zcm.listing_views (
  listing_id   uuid not null references zcm.listings(id) on delete cascade,
  community_id uuid not null references zcm.communities(id) on delete cascade,
  viewer_id    uuid not null references zcm.profiles(id) on delete cascade,
  day          date not null default current_date,
  primary key (listing_id, viewer_id, day)
);
alter table zcm.listing_views enable row level security;
create policy views_owner_read on zcm.listing_views for select to authenticated using (
  zcm.is_community_admin(community_id) or exists (
    select 1 from listings l join sellers s on s.id = l.seller_id
    where l.id = listing_id and s.user_id = auth.uid()));

-- Called when a member opens a listing. Sellers' own views and non-members are ignored.
create function zcm.record_view(lid uuid) returns void
language plpgsql security definer set search_path = zcm as $$
declare l listings; owner uuid;
begin
  select * into l from listings where id = lid;
  if l.id is null or not zcm.is_verified_member(l.community_id) then return; end if;
  select user_id into owner from sellers where id = l.seller_id;
  if owner = auth.uid() then return; end if;
  insert into listing_views (listing_id, community_id, viewer_id) values (lid, l.community_id, auth.uid())
  on conflict do nothing;
end $$;
revoke all on function zcm.record_view(uuid) from public;
grant execute on function zcm.record_view(uuid) to authenticated;

create view zcm.listing_view_counts with (security_invoker = true) as
  select listing_id, count(*)::int as views, count(distinct viewer_id)::int as unique_viewers
  from zcm.listing_views group by listing_id;
