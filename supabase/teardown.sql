-- Removes everything ZCM added to a shared Supabase project. Destroys all ZCM data. Other schemas are untouched.
drop trigger if exists zcm_on_auth_user_created on auth.users;
do $$ begin
  if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'zcm' and tablename = 'messages') then
    alter publication supabase_realtime drop table zcm.messages;
  end if;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('expire-reservations');
  end if;
exception when others then null; end $$;
drop policy if exists zcm_listing_images_read on storage.objects;
drop policy if exists zcm_listing_images_insert on storage.objects;
drop policy if exists zcm_listing_images_delete on storage.objects;
drop policy if exists zcm_listing_videos_read on storage.objects;
drop policy if exists zcm_listing_videos_insert on storage.objects;
drop policy if exists zcm_listing_videos_delete on storage.objects;
drop policy if exists zcm_proofs_read on storage.objects;
drop policy if exists zcm_proofs_insert on storage.objects;
-- delete the files via the dashboard or Storage API first; Supabase blocks deleting non-empty buckets from SQL
delete from storage.buckets where id in ('zcm-listing-images','zcm-listing-videos','zcm-payment-proofs');
drop schema zcm cascade;
