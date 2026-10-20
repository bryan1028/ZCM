create table if not exists public.rv_admins (user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.rv_admins enable row level security;

create or replace function public.rv_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from rv_admins where user_id = auth.uid());
$$;

create or replace function public.rv_admin_reports()
returns table(review_id uuid, report_count bigint, last_reason text, stars smallint, body text, photos text[], restaurant_id text, restaurant text, handle text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not rv_is_admin() then raise exception 'admin only'; end if;
  return query
  select v.id, count(x.id), max(x.reason), v.stars, v.body, v.photos, v.restaurant_id, r.name, p.handle, v.created_at
  from rv_reports x join rv_reviews v on v.id = x.review_id join restaurants r on r.id = v.restaurant_id
  left join rv_profiles p on p.id = v.user_id
  group by v.id, r.name, p.handle order by count(x.id) desc, max(x.created_at) desc limit 100;
end $$;

create or replace function public.rv_admin_dismiss(rid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin if not rv_is_admin() then raise exception 'admin only'; end if; delete from rv_reports where review_id = rid; end $$;

create or replace function public.rv_admin_delete_review(rid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin if not rv_is_admin() then raise exception 'admin only'; end if; delete from rv_reviews where id = rid; end $$;

create or replace function public.rv_admin_stats()
returns table(users bigint, reviews bigint, reports bigint, user_added bigint, restaurants bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not rv_is_admin() then raise exception 'admin only'; end if;
  return query select (select count(*) from rv_profiles), (select count(*) from rv_reviews), (select count(distinct review_id) from rv_reports),
    (select count(*) from restaurants where source like 'user:%'), (select count(*) from restaurants);
end $$;

revoke execute on function public.rv_admin_reports, public.rv_admin_dismiss, public.rv_admin_delete_review, public.rv_admin_stats from anon, public;
grant execute on function public.rv_is_admin, public.rv_admin_reports, public.rv_admin_dismiss, public.rv_admin_delete_review, public.rv_admin_stats to authenticated;
grant execute on function public.rv_is_admin to anon;
