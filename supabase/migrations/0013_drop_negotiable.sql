-- Decision: no "negotiable" status. Every listing shows one clear price; buyer and seller agree any discount in the chat,
-- and the seller confirms the payment they receive. (Undoes the flag added in 0012; negotiable as a price type went in 0012 too.)
set search_path = zcm, public;
alter table zcm.listings drop column if exists negotiable;
