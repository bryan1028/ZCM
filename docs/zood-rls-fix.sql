-- Zood project (seqqbtuvpwwmleywtshl): RLS fix applied 2026-10-07.
-- Problem: admin policies on profiles/leads/restaurants queried `profiles` from inside `profiles` policies -> 'infinite recursion detected in policy'
-- (public reads of those tables returned HTTP 500), and any user could set their own role to 'admin'.
-- Fix: security-definer is_admin() + a trigger that only lets admins (or the SQL editor / service role) set a non-default role.

-- ===== APPLY =====
-- 1) admin check that does NOT go through RLS (so it can't recurse)
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- 2) rewrite the three self-referencing policies
drop policy "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles" on public.profiles for select using (public.is_admin());
drop policy "Admins can read all leads" on public.leads;
create policy "Admins can read all leads" on public.leads for select using (public.is_admin());
drop policy "Admins can do everything with restaurants" on public.restaurants;
create policy "Admins can do everything with restaurants" on public.restaurants for all using (public.is_admin());

-- 3) close the self-promotion hole: only an admin (or the SQL editor / service role) may set a non-default role
create or replace function public.guard_profile_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if tg_op = 'INSERT' and new.role is distinct from 'user' then
      new.role := 'user';
    elsif tg_op = 'UPDATE' and new.role is distinct from old.role then
      raise exception 'Only an admin can change roles';
    end if;
  end if;
  return new;
end $$;
create trigger profiles_guard_role before insert or update on public.profiles
  for each row execute function public.guard_profile_role();

-- ===== UNDO (restores the previous, recursive policies; reopens the self-promotion hole) =====
-- begin;
-- drop trigger if exists profiles_guard_role on public.profiles;
-- drop policy "Admins can read all profiles" on public.profiles;
-- create policy "Admins can read all profiles" on public.profiles for select using (exists (select 1 from public.profiles profiles_1 where profiles_1.id = auth.uid() and profiles_1.role = 'admin'::text));
-- drop policy "Admins can read all leads" on public.leads;
-- create policy "Admins can read all leads" on public.leads for select using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'::text));
-- drop policy "Admins can do everything with restaurants" on public.restaurants;
-- create policy "Admins can do everything with restaurants" on public.restaurants for all using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'::text));
-- drop function if exists public.guard_profile_role();
-- drop function if exists public.is_admin();
-- commit;
