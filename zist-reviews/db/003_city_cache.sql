create materialized view if not exists public.rv_city_mv as
  select city, country, city_slug, count(*) n from public.restaurants group by 1,2,3;
create or replace function public.rv_cities()
returns table(city text, country text, city_slug text, n bigint)
language sql stable security definer set search_path = public as $$
  select city, country, city_slug, n from rv_city_mv order by n desc;
$$;
revoke all on public.rv_city_mv from anon, authenticated;
select cron.schedule('rv-city-refresh','17 3 * * *','refresh materialized view public.rv_city_mv');
