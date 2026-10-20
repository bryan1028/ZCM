-- Bans: banned users cannot write; their reviews are hidden everywhere (reversible by unbanning).
create table if not exists public.rv_bans (user_id uuid primary key references auth.users(id) on delete cascade, reason text, banned_at timestamptz not null default now());
alter table public.rv_bans enable row level security;

create or replace function public.rv_is_banned(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$ select exists(select 1 from rv_bans where user_id = uid); $$;
grant execute on function public.rv_is_banned to anon, authenticated;

drop policy if exists r_sel on public.rv_reviews; drop policy if exists r_ins on public.rv_reviews; drop policy if exists r_upd on public.rv_reviews;
create policy r_sel on public.rv_reviews for select using (not rv_is_banned(user_id) or user_id = auth.uid() or rv_is_admin());
create policy r_ins on public.rv_reviews for insert to authenticated with check (user_id = auth.uid() and not rv_is_banned(auth.uid()));
create policy r_upd on public.rv_reviews for update to authenticated using (user_id = auth.uid() and not rv_is_banned(auth.uid())) with check (user_id = auth.uid());
drop policy if exists p_upd on public.rv_profiles; drop policy if exists p_ins on public.rv_profiles;
create policy p_ins on public.rv_profiles for insert to authenticated with check (id = auth.uid() and not rv_is_banned(auth.uid()));
create policy p_upd on public.rv_profiles for update to authenticated using (id = auth.uid() and not rv_is_banned(auth.uid())) with check (id = auth.uid());
drop policy if exists rp_ins on storage.objects;
create policy rp_ins on storage.objects for insert to authenticated with check (bucket_id = 'review-photos' and (storage.foldername(name))[1] = auth.uid()::text and not public.rv_is_banned(auth.uid()));

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
         (select round(avg(stars)::numeric,1) from rv_reviews v where v.restaurant_id = m.id and not rv_is_banned(v.user_id)),
         (select count(*) from rv_reviews v where v.restaurant_id = m.id and not rv_is_banned(v.user_id))
  from m order by m.sim desc, m.name;
$$;
create or replace function public.rv_restaurant(rid text)
returns table(id text, name text, city text, country text, address text, lat float8, lng float8, website text, cuisines text[], avg_stars numeric, review_count bigint)
language sql stable security definer set search_path = public as $$
  select r.id, r.name, r.city, r.country, r.address, r.lat, r.lng, r.website, r.cuisines,
         (select round(avg(stars)::numeric,1) from rv_reviews v where v.restaurant_id = r.id and not rv_is_banned(v.user_id)),
         (select count(*) from rv_reviews v where v.restaurant_id = r.id and not rv_is_banned(v.user_id))
  from restaurants r where r.id = rid;
$$;
create or replace function public.rv_popular(city_filter text default null, lim int default 12)
returns table(id text, name text, city text, country text, cuisines text[], avg_stars numeric, review_count bigint)
language sql stable security definer set search_path = public as $$
  select r.id, r.name, r.city, r.country, r.cuisines, round(avg(v.stars)::numeric,1), count(v.id)
  from restaurants r join rv_reviews v on v.restaurant_id = r.id and not rv_is_banned(v.user_id)
  where city_filter is null or r.city_slug = city_filter
  group by r.id order by count(v.id) desc, avg(v.stars) desc limit least(lim, 50);
$$;
create or replace function public.rv_add_restaurant(p_name text, p_city text, p_country text, p_address text default null)
returns text language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); n text := btrim(p_name); c text := btrim(p_city); rid text; slug text;
begin
  if uid is null then raise exception 'sign in required'; end if;
  if rv_is_banned(uid) then raise exception 'account suspended'; end if;
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

drop function if exists public.rv_admin_reports();
create or replace function public.rv_admin_reports()
returns table(review_id uuid, report_count bigint, last_reason text, stars smallint, body text, photos text[], restaurant_id text, restaurant text, handle text, user_id uuid, banned boolean, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not rv_is_admin() then raise exception 'admin only'; end if;
  return query
  select v.id, count(x.id), max(x.reason), v.stars, v.body, v.photos, v.restaurant_id, r.name, p.handle, v.user_id, rv_is_banned(v.user_id), v.created_at
  from rv_reports x join rv_reviews v on v.id = x.review_id join restaurants r on r.id = v.restaurant_id
  left join rv_profiles p on p.id = v.user_id
  group by v.id, r.name, p.handle order by count(x.id) desc, max(x.created_at) desc limit 100;
end $$;

create or replace function public.rv_admin_users(q text default null)
returns table(user_id uuid, handle text, review_count bigint, banned boolean, ban_reason text, joined timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not rv_is_admin() then raise exception 'admin only'; end if;
  return query
  select p.id, p.handle, (select count(*) from rv_reviews v where v.user_id = p.id), (b.user_id is not null), b.reason, p.created_at
  from rv_profiles p left join rv_bans b on b.user_id = p.id
  where (q is null or q = '' or p.handle ilike '%'||q||'%') order by (b.user_id is not null) desc, p.created_at desc limit 50;
end $$;

create or replace function public.rv_admin_ban(uid uuid, why text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not rv_is_admin() then raise exception 'admin only'; end if;
  if exists(select 1 from rv_admins where user_id = uid) then raise exception 'cannot ban an admin'; end if;
  insert into rv_bans(user_id, reason) values (uid, left(why, 300)) on conflict (user_id) do update set reason = excluded.reason;
  delete from rv_reports where review_id in (select id from rv_reviews where user_id = uid);
end $$;
create or replace function public.rv_admin_unban(uid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin if not rv_is_admin() then raise exception 'admin only'; end if; delete from rv_bans where user_id = uid; end $$;

revoke execute on function public.rv_admin_reports, public.rv_admin_users, public.rv_admin_ban, public.rv_admin_unban from anon, public;
grant execute on function public.rv_admin_reports, public.rv_admin_users, public.rv_admin_ban, public.rv_admin_unban to authenticated;
