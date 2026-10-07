set search_path = zcm, public, extensions;

-- Explicit table privileges (belt and braces for the default privileges in 0000). Row Level Security
-- still decides which rows anyone can touch; `anon` gets no table access at all.
grant select, insert, update, delete on all tables in schema zcm to authenticated;
grant all on all tables in schema zcm to service_role;
-- notifications: users may only mark their own as read
revoke update on zcm.notifications from authenticated;
grant update (read_at) on zcm.notifications to authenticated;
