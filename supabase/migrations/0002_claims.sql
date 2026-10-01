-- Verified restaurant claims, owner link, and an in-app message thread per claim.
alter table restaurants add column if not exists owner_uid text;
alter table restaurants add column if not exists trial_ends_at timestamptz;
create index if not exists restaurants_owner_idx on restaurants (owner_uid) where owner_uid is not null;

alter table claims add column if not exists status text not null default 'new';
alter table claims add column if not exists user_id text;
alter table claims add column if not exists user_handle text;
alter table claims add column if not exists role text;
alter table claims add column if not exists proof text;
alter table claims add column if not exists admin_note text;
create index if not exists claims_user_idx on claims (user_id) where user_id is not null;
create index if not exists claims_restaurant_idx on claims (restaurant_id);

create table if not exists claim_messages (
  id         text primary key,
  claim_id   text not null,
  from_admin boolean not null,
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists claim_messages_claim_idx on claim_messages (claim_id, created_at);
alter table claim_messages enable row level security;
