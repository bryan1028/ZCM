-- ZCM lives entirely in its own `zcm` schema so it can share a Supabase project with other apps
-- without touching their tables. (Expose `zcm` under Settings → API → Exposed schemas.)
create schema if not exists zcm;
grant usage on schema zcm to anon, authenticated, service_role;
alter default privileges in schema zcm grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema zcm grant all on tables to service_role;
