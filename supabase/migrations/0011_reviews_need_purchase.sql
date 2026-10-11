-- Reviews come from buyers: you can only review a listing once you have a completed order for it.
-- (The guard runs as security definer so it can see the buyer's orders; sellers still can't review their own listing.)
set search_path = zcm, public;

create or replace function zcm.reviews_before_insert() returns trigger
language plpgsql security definer set search_path = zcm as $$
declare l listings; owner uuid;
begin
  select * into l from listings where id = new.listing_id;
  select user_id into owner from sellers where id = l.seller_id;
  if owner = new.reviewer_id then raise exception 'You cannot review your own listing'; end if;
  if not exists (select 1 from reservations r
                 where r.listing_id = new.listing_id and r.buyer_id = new.reviewer_id and r.status = 'completed') then
    raise exception 'You can review this once you have completed an order with the seller';
  end if;
  new.community_id := l.community_id;
  new.seller_id := l.seller_id;
  return new;
end $$;
