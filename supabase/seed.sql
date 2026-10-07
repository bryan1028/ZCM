-- Starter community. Run in the Supabase SQL editor after the migration.
insert into public.communities (slug, name, city)
values ('kijani-ridge', 'Kijani Ridge', 'Nairobi')
on conflict (slug) do nothing;

-- BOOTSTRAP THE FIRST ADMIN (you):
-- 1. Sign in once on the site, and request to join Kijani Ridge.
-- 2. Then run this with your email to make yourself a verified admin:
--
-- update public.memberships
--    set status = 'verified', role = 'admin', reviewed_at = now()
--  where user_id = (select id from auth.users where email = 'you@example.com')
--    and community_id = (select id from public.communities where slug = 'kijani-ridge');
