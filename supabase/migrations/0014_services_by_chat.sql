-- Services are arranged by chat, not booked and paid in the app (most are someone's known gardener or cleaner, and nobody
-- pays before the work is done). So: no reservations on services, and a service review needs a real two-way conversation
-- with the seller about that listing. Products still need a completed order.
set search_path = zcm, public;

create function zcm.reviewer_eligible(lid uuid, uid uuid) returns boolean
language plpgsql stable security definer set search_path = zcm as $$
declare k text;
begin
  select kind into k from listings where id = lid;
  if k = 'service' then
    return exists (
      select 1 from conversations c
      where c.listing_id = lid and uid in (c.initiator_id, c.recipient_id)
        and exists (select 1 from messages m where m.conversation_id = c.id and m.sender_id = c.initiator_id)
        and exists (select 1 from messages m where m.conversation_id = c.id and m.sender_id = c.recipient_id));
  end if;
  return exists (select 1 from reservations r where r.listing_id = lid and r.buyer_id = uid and r.status = 'completed');
end $$;

-- the page asks this to decide whether to show the review form
create function zcm.can_review(lid uuid) returns boolean
language sql stable security definer set search_path = zcm as $$
  select zcm.reviewer_eligible(lid, auth.uid())
$$;

create or replace function zcm.reviews_before_insert() returns trigger
language plpgsql security definer set search_path = zcm as $$
declare l listings; owner uuid;
begin
  select * into l from listings where id = new.listing_id;
  select user_id into owner from sellers where id = l.seller_id;
  if owner = new.reviewer_id then raise exception 'You cannot review your own listing'; end if;
  if not zcm.reviewer_eligible(new.listing_id, new.reviewer_id) then
    if l.kind = 'service' then
      raise exception 'You can review a service once you have been in touch with the seller and used it';
    end if;
    raise exception 'You can review this once you have completed an order with the seller';
  end if;
  new.community_id := l.community_id;
  new.seller_id := l.seller_id;
  return new;
end $$;

create or replace function zcm.create_reservation(lid uuid, qty int, note_text text) returns uuid
language plpgsql security definer set search_path = zcm as $$
declare l listings; owner uuid; rid uuid;
begin
  select * into l from listings where id = lid and status = 'active' and available;
  if l.id is null or not zcm.is_verified_member(l.community_id) or not zcm.seller_visible(l.seller_id) then
    raise exception 'This listing is not available';
  end if;
  if l.kind = 'service' then raise exception 'Services are arranged by chat: message the seller'; end if;
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

revoke all on function zcm.reviewer_eligible(uuid, uuid), zcm.can_review(uuid) from public, anon, authenticated;
grant execute on function zcm.can_review(uuid) to authenticated;
grant execute on function zcm.reviewer_eligible(uuid, uuid), zcm.can_review(uuid) to service_role;
