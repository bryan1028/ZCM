set search_path = zcm, public, extensions;

-- Photos (private Storage buckets) and Phase 2: reservations + payment proof.

create function zcm.safe_uuid(t text) returns uuid
language plpgsql immutable as $$
begin return t::uuid; exception when others then return null; end $$;

-- ───────────── Storage buckets (private; the app serves signed URLs) ─────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('zcm-listing-images', 'zcm-listing-images', false, 5242880, array['image/jpeg','image/png','image/webp']),
  ('zcm-payment-proofs', 'zcm-payment-proofs', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- listing-images/<community_id>/<seller user_id>/<file>
create policy zcm_listing_images_read on storage.objects for select to authenticated using (
  bucket_id = 'zcm-listing-images'
  and zcm.is_verified_member(zcm.safe_uuid((storage.foldername(name))[1])));
create policy zcm_listing_images_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'zcm-listing-images'
  and (storage.foldername(name))[2] = auth.uid()::text
  and zcm.is_verified_member(zcm.safe_uuid((storage.foldername(name))[1])));
create policy zcm_listing_images_delete on storage.objects for delete to authenticated using (
  bucket_id = 'zcm-listing-images' and (storage.foldername(name))[2] = auth.uid()::text);

-- ───────────── Reservations ─────────────
create table zcm.reservations (
  id               uuid primary key default gen_random_uuid(),
  community_id     uuid not null references zcm.communities(id) on delete cascade,
  listing_id       uuid not null references zcm.listings(id) on delete cascade,
  buyer_id         uuid not null references zcm.profiles(id) on delete cascade,
  seller_user_id   uuid not null references zcm.profiles(id) on delete cascade,
  quantity         int not null default 1 check (quantity between 1 and 999),
  unit_price_cents int,                         -- snapshot at reservation time
  note             text check (char_length(note) <= 500),
  status           text not null default 'requested'
                   check (status in ('requested','accepted','paid','completed','declined','cancelled','expired')),
  expires_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (buyer_id <> seller_user_id)
);
create index on zcm.reservations (buyer_id);
create index on zcm.reservations (seller_user_id);
create index on zcm.reservations (listing_id, status);

create table zcm.payments (
  id             uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references zcm.reservations(id) on delete cascade,
  proof_path     text not null,                -- object in the payment-proofs bucket
  reference      text check (char_length(reference) <= 100),   -- e.g. M-Pesa code
  amount_cents   int,
  status         text not null default 'pending' check (status in ('pending','confirmed','rejected')),
  created_at     timestamptz not null default now()
);
create index on zcm.payments (reservation_id);

alter table zcm.reservations enable row level security;
alter table zcm.payments enable row level security;

create policy res_read on zcm.reservations for select to authenticated
  using (auth.uid() in (buyer_id, seller_user_id) and zcm.is_verified_member(community_id));
create policy pay_read on zcm.payments for select to authenticated using (exists (
  select 1 from reservations r where r.id = reservation_id and auth.uid() in (r.buyer_id, r.seller_user_id)));
-- No insert/update policies: every change goes through the functions below (a fixed state machine).

-- payment-proofs/<reservation_id>/<file>
create policy zcm_proofs_read on storage.objects for select to authenticated using (
  bucket_id = 'zcm-payment-proofs' and exists (
    select 1 from zcm.reservations r
    where r.id = zcm.safe_uuid((storage.foldername(name))[1]) and auth.uid() in (r.buyer_id, r.seller_user_id)));
create policy zcm_proofs_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'zcm-payment-proofs' and exists (
    select 1 from zcm.reservations r
    where r.id = zcm.safe_uuid((storage.foldername(name))[1]) and r.buyer_id = auth.uid()));

-- Units committed to open reservations (so two buyers can't both reserve the last item).
create function zcm.reserved_units(lid uuid) returns int
language sql stable security definer set search_path = zcm as $$
  select coalesce(sum(quantity), 0)::int from reservations
  where listing_id = lid and (status in ('accepted','paid') or (status = 'requested' and expires_at > now()));
$$;

create function zcm.create_reservation(lid uuid, qty int, note_text text) returns uuid
language plpgsql security definer set search_path = zcm as $$
declare l listings; owner uuid; rid uuid;
begin
  select * into l from listings where id = lid and status = 'active' and available;
  if l.id is null or not zcm.is_verified_member(l.community_id) or not zcm.seller_visible(l.seller_id) then
    raise exception 'This listing is not available';
  end if;
  select user_id into owner from sellers where id = l.seller_id;
  if owner = auth.uid() then raise exception 'This is your own listing'; end if;
  if l.stock is not null and qty > l.stock - zcm.reserved_units(lid) then
    raise exception 'Not enough stock left';
  end if;
  insert into reservations (community_id, listing_id, buyer_id, seller_user_id, quantity, unit_price_cents, note, expires_at)
  values (l.community_id, lid, auth.uid(), owner, qty, l.price_cents, nullif(trim(note_text), ''), now() + interval '48 hours')
  returning id into rid;
  return rid;
end $$;

-- accept | decline | cancel | confirm | reject_proof
create function zcm.transition_reservation(rid uuid, act text) returns text
language plpgsql security definer set search_path = zcm as $$
declare r reservations; me uuid := auth.uid(); is_buyer boolean; is_seller boolean; new_status text;
begin
  select * into r from reservations where id = rid for update;
  if r.id is null or me not in (r.buyer_id, r.seller_user_id) then raise exception 'Reservation not found'; end if;
  is_buyer := me = r.buyer_id; is_seller := me = r.seller_user_id;

  if r.status in ('requested','accepted') and r.expires_at < now() then
    update reservations set status = 'expired', updated_at = now() where id = rid;
    raise exception 'This reservation has expired';
  end if;

  if act = 'accept' and is_seller and r.status = 'requested' then new_status := 'accepted';
  elsif act = 'decline' and is_seller and r.status = 'requested' then new_status := 'declined';
  elsif act = 'cancel' and r.status in ('requested','accepted') then new_status := 'cancelled';
  elsif act = 'reject_proof' and is_seller and r.status = 'paid' then
    new_status := 'accepted';
    update payments set status = 'rejected' where reservation_id = rid and status = 'pending';
  elsif act = 'confirm' and is_seller and r.status = 'paid' then
    new_status := 'completed';
    update payments set status = 'confirmed' where reservation_id = rid and status = 'pending';
    update listings set stock = greatest(stock - r.quantity, 0) where id = r.listing_id and stock is not null;
  else raise exception 'That action is not allowed right now';
  end if;

  update reservations set status = new_status, updated_at = now(),
    expires_at = case when new_status = 'accepted' then now() + interval '48 hours' else expires_at end
  where id = rid;
  return new_status;
end $$;

-- Buyer attaches proof (the file was already uploaded to payment-proofs/<rid>/…).
create function zcm.submit_payment(rid uuid, path text, ref text) returns void
language plpgsql security definer set search_path = zcm as $$
declare r reservations;
begin
  select * into r from reservations where id = rid for update;
  if r.id is null or r.buyer_id <> auth.uid() then raise exception 'Reservation not found'; end if;
  if r.status <> 'accepted' then raise exception 'Payment can only be submitted once the seller has accepted'; end if;
  if r.expires_at < now() then raise exception 'This reservation has expired'; end if;
  if zcm.safe_uuid(split_part(path, '/', 1)) is distinct from rid then raise exception 'Invalid proof path'; end if;
  insert into payments (reservation_id, proof_path, reference, amount_cents)
  values (rid, path, nullif(trim(ref), ''), r.unit_price_cents * r.quantity);
  update reservations set status = 'paid', updated_at = now() where id = rid;
end $$;

revoke all on function zcm.create_reservation(uuid,int,text), zcm.transition_reservation(uuid,text),
  zcm.submit_payment(uuid,text,text), zcm.reserved_units(uuid) from public, anon;
grant execute on function zcm.create_reservation(uuid,int,text), zcm.transition_reservation(uuid,text),
  zcm.submit_payment(uuid,text,text) to authenticated;
