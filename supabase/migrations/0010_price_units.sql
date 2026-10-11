-- More ways to price a listing: per item and per kg (onions by the kilo, a vehicle at a fixed price, cookies per item).
set search_path = zcm, public;

alter table zcm.listings drop constraint if exists listings_price_unit_check;
alter table zcm.listings add constraint listings_price_unit_check
  check (price_unit in ('fixed', 'per_hour', 'per_job', 'per_item', 'per_kg', 'negotiable'));
