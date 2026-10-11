-- "Negotiable" is a flag on a priced listing, not a price type: buyers always see an asking price, with a Negotiable tag,
-- and haggle in the inbox. A listing with no amount reads "Ask for price".
set search_path = zcm, public;

alter table zcm.listings add column negotiable boolean not null default false;
update zcm.listings set negotiable = true, price_unit = 'fixed' where price_unit = 'negotiable';
alter table zcm.listings drop constraint if exists listings_price_unit_check;
alter table zcm.listings add constraint listings_price_unit_check
  check (price_unit in ('fixed', 'per_hour', 'per_job', 'per_item', 'per_kg'));
