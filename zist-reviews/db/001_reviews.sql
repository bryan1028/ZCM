-- Zist reviews MVP: ratings, reviews, Top 5, profiles. Restaurants table stays locked; access via RPCs.
create extension if not exists pg_trgm;
create index if not exists restaurants_name_trgm on public.restaurants using gin (lower(name) gin_trgm_ops);
create index if not exists restaurants_city_slug_idx on public.restaurants (city_slug);

create table if not exists public.rv_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z0-9_]{3,20}$'),
  display_name text check (char_length(display_name) <= 60),
  bio text check (char_length(bio) <= 280),
  city text check (char_length(city) <= 60),
  created_at timestamptz not null default now()
);

create table if not exists public.rv_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  restaurant_id text not null references public.restaurants(id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  body text check (char_length(body) <= 2000),
  photos text[] not null default '{}' check (cardinality(photos) <= 4),
  visited_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, restaurant_id)
);
create index if not exists rv_reviews_rest_idx on public.rv_reviews (restaurant_id, created_at desc);
create index if not exists rv_reviews_user_idx on public.rv_reviews (user_id, created_at desc);

create table if not exists public.rv_top5 (
  user_id uuid not null references auth.users(id) on delete cascade,
  position smallint not null check (position between 1 and 5),
  restaurant_id text not null references public.restaurants(id) on delete cascade,
  primary key (user_id, position),
  unique (user_id, restaurant_id)
);

create table if not exists public.rv_reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null references auth.users(id) on delete cascade,
  review_id uuid not null references public.rv_reviews(id) on delete cascade,
  reason text check (char_length(reason) <= 300),
  created_at timestamptz not null default now(),
  unique (reporter, review_id)
);

alter table public.rv_profiles enable row level security;
alter table public.rv_reviews enable row level security;
alter table public.rv_top5 enable row level security;
alter table public.rv_reports enable row level security;

drop policy if exists p_sel on public.rv_profiles; drop policy if exists p_ins on public.rv_profiles; drop policy if exists p_upd on public.rv_profiles;
create policy p_sel on public.rv_profiles for select using (true);
create policy p_ins on public.rv_profiles for insert to authenticated with check (id = auth.uid());
create policy p_upd on public.rv_profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists r_sel on public.rv_reviews; drop policy if exists r_ins on public.rv_reviews; drop policy if exists r_upd on public.rv_reviews; drop policy if exists r_del on public.rv_reviews;
create policy r_sel on public.rv_reviews for select using (true);
create policy r_ins on public.rv_reviews for insert to authenticated with check (user_id = auth.uid());
create policy r_upd on public.rv_reviews for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy r_del on public.rv_reviews for delete to authenticated using (user_id = auth.uid());

drop policy if exists t_sel on public.rv_top5; drop policy if exists t_ins on public.rv_top5; drop policy if exists t_upd on public.rv_top5; drop policy if exists t_del on public.rv_top5;
create policy t_sel on public.rv_top5 for select using (true);
create policy t_ins on public.rv_top5 for insert to authenticated with check (user_id = auth.uid());
create policy t_upd on public.rv_top5 for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy t_del on public.rv_top5 for delete to authenticated using (user_id = auth.uid());

drop policy if exists x_ins on public.rv_reports;
create policy x_ins on public.rv_reports for insert to authenticated with check (reporter = auth.uid());

create or replace function public.rv_touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists rv_reviews_touch on public.rv_reviews;
create trigger rv_reviews_touch before update on public.rv_reviews for each row execute function public.rv_touch();

-- Public restaurant card shape (no owner/plan/lead fields)
create or replace function public.rv_search(q text, city_filter text default null, lim int default 20)
returns table(id text, name text, city text, country text, address text, cuisines text[], avg_stars numeric, review_count bigint)
language sql stable security definer set search_path = public as $$
  with m as (
    select r.id, r.name, r.city, r.country, r.address, r.cuisines,
           greatest(similarity(lower(r.name), lower(q)), case when lower(r.name) like lower(q)||'%' then 0.9 else 0 end) sim
    from restaurants r
    where char_length(q) >= 2
      and (lower(r.name) % lower(q) or lower(r.name) like '%'||lower(q)||'%')
      and (city_filter is null or r.city_slug = city_filter or lower(r.city) = lower(city_filter))
    order by sim desc limit least(lim, 50)
  )
  select m.id, m.name, m.city, m.country, m.address, m.cuisines,
         (select round(avg(stars)::numeric,1) from rv_reviews v where v.restaurant_id = m.id),
         (select count(*) from rv_reviews v where v.restaurant_id = m.id)
  from m order by m.sim desc, m.name;
$$;

create or replace function public.rv_restaurant(rid text)
returns table(id text, name text, city text, country text, address text, lat float8, lng float8, website text, cuisines text[], avg_stars numeric, review_count bigint)
language sql stable security definer set search_path = public as $$
  select r.id, r.name, r.city, r.country, r.address, r.lat, r.lng, r.website, r.cuisines,
         (select round(avg(stars)::numeric,1) from rv_reviews v where v.restaurant_id = r.id),
         (select count(*) from rv_reviews v where v.restaurant_id = r.id)
  from restaurants r where r.id = rid;
$$;

create or replace function public.rv_cities()
returns table(city text, country text, city_slug text, n bigint)
language sql stable security definer set search_path = public as $$
  select city, country, city_slug, count(*) from restaurants group by 1,2,3 order by 4 desc;
$$;

create or replace function public.rv_popular(city_filter text default null, lim int default 12)
returns table(id text, name text, city text, country text, cuisines text[], avg_stars numeric, review_count bigint)
language sql stable security definer set search_path = public as $$
  select r.id, r.name, r.city, r.country, r.cuisines, round(avg(v.stars)::numeric,1), count(v.id)
  from restaurants r join rv_reviews v on v.restaurant_id = r.id
  where city_filter is null or r.city_slug = city_filter
  group by r.id order by count(v.id) desc, avg(v.stars) desc limit least(lim, 50);
$$;

-- Add a missing restaurant (dedupe by close name in same city, max 5/day/user)
create or replace function public.rv_add_restaurant(p_name text, p_city text, p_country text, p_address text default null)
returns text language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); n text := btrim(p_name); c text := btrim(p_city); rid text; slug text;
begin
  if uid is null then raise exception 'sign in required'; end if;
  if char_length(n) < 2 or char_length(n) > 120 or char_length(c) < 2 or char_length(c) > 80 then raise exception 'invalid name or city'; end if;
  if (select count(*) from restaurants where source = 'user:'||uid and created_at > now() - interval '1 day') >= 5 then raise exception 'daily limit reached'; end if;
  slug := regexp_replace(lower(c), '[^a-z0-9]+', '-', 'g');
  select id into rid from restaurants
   where (lower(city) = lower(c) or city_slug = slug) and similarity(lower(name), lower(n)) > 0.7 order by similarity(lower(name), lower(n)) desc limit 1;
  if rid is not null then return rid; end if;
  rid := 'u_' || replace(gen_random_uuid()::text,'-','');
  insert into restaurants(id, name, country, city, city_slug, address, status, source, source_id, created_at)
  values (rid, n, btrim(coalesce(p_country,'')), c, slug, nullif(btrim(coalesce(p_address,'')),''), 'unclaimed', 'user:'||uid, rid, now());
  return rid;
end $$;

grant execute on function public.rv_search, public.rv_restaurant, public.rv_cities, public.rv_popular to anon, authenticated;
grant execute on function public.rv_add_restaurant to authenticated;
revoke execute on function public.rv_add_restaurant from anon, public;

-- Photo storage: public read, owners write inside their own folder
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('review-photos','review-photos', true, 3145728, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists rp_ins on storage.objects; drop policy if exists rp_del on storage.objects;
create policy rp_ins on storage.objects for insert to authenticated with check (bucket_id = 'review-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy rp_del on storage.objects for delete to authenticated using (bucket_id = 'review-photos' and (storage.foldername(name))[1] = auth.uid()::text);
