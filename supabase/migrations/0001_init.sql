-- Zist (Zood + Zind) schema. Postgres 15+ / Supabase.
-- The app talks to this database ONLY from the server (direct connection), never from the browser.
-- Row-level security is enabled with NO policies on every table, so Supabase's public API key can read or write nothing.

create table if not exists restaurants (
  id          text primary key,
  name        text not null,
  country     text not null check (length(country) = 2),
  city        text not null,
  city_slug   text not null,
  address     text,
  lat         double precision,
  lng         double precision,
  whatsapp    text,                       -- E.164 digits; used by the Message button
  phone       text,                       -- public phone; may not be on WhatsApp; used by the Call button
  website     text,
  cuisines    text[] not null default '{}',
  diets       text[] not null default '{}',
  menu        jsonb  not null default '[]',
  status      text   not null check (status in ('unclaimed','pending','active','paused')),
  source      text   not null,
  source_id   text,
  plan        text   not null default 'free',
  lead_count  integer not null default 0,
  rank        real   not null default 0,
  search_text text   not null default '',  -- lower-case name + cuisines + dish names, for text search
  created_at  timestamptz not null default now()
);
create index if not exists restaurants_where_idx on restaurants (status, country, city_slug);
create index if not exists restaurants_city_idx  on restaurants (city_slug, status);
create index if not exists restaurants_diets_idx on restaurants using gin (diets);
create unique index if not exists restaurants_source_uidx on restaurants (source, source_id) where source_id is not null;

create table if not exists prices (
  id            text primary key,
  product_key   text not null,
  product_name  text not null,
  brand         text,
  barcode       text,
  size          text,
  store_name    text not null,
  country       text not null,
  city          text not null,
  city_slug     text not null,
  lat           double precision,
  lng           double precision,
  price         numeric(14,2) not null check (price > 0),
  currency      text not null check (length(currency) = 3),
  search_text   text not null default '',
  source        text not null,
  status        text not null default 'ok' check (status in ('ok','flagged','hidden')),
  observed_at   timestamptz not null,
  created_at    timestamptz not null default now(),
  reporter      text,
  reporter_handle text,
  source_id     text
);
create index if not exists prices_where_idx   on prices (status, country, city_slug);
create index if not exists prices_product_idx on prices (product_key, city_slug);
create index if not exists prices_created_idx on prices (created_at desc);
create unique index if not exists prices_source_uidx on prices (source, source_id) where source_id is not null;

create table if not exists deals (
  id           text primary key,
  title        text not null,
  store_name   text not null,
  country      text not null,
  city         text not null,
  city_slug    text not null,
  description  text,
  price        numeric(14,2),
  currency     text,
  discount_pct integer,
  url          text,
  valid_until  date not null,
  status       text not null default 'active',
  source       text not null default 'admin',
  created_at   timestamptz not null default now()
);
create index if not exists deals_where_idx on deals (status, country, city_slug);

create table if not exists leads (
  id              text primary key,
  restaurant_id   text not null,
  restaurant_name text not null,
  country         text not null,
  city            text not null,
  item_id         text,
  item_name       text,
  source          text not null,
  channel         text,
  ref             text not null,
  visitor         text not null,
  user_id         text,
  user_handle     text,
  created_at      timestamptz not null default now()
);
create index if not exists leads_created_idx on leads (created_at desc);
create index if not exists leads_user_idx on leads (user_id) where user_id is not null;

create table if not exists claims (
  id              text primary key,
  restaurant_id   text,
  restaurant_name text not null,
  country         text not null,
  city            text not null,
  contact_name    text not null,
  whatsapp        text not null,
  email           text,
  created_at      timestamptz not null default now()
);

create table if not exists profiles (
  uid        text primary key,
  username   text,
  email      text not null default '',
  diets      text[] not null default '{}',
  allergies  text[] not null default '{}',
  city       text,
  country    text,
  opt_in     boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists usernames (
  username text primary key,
  uid      text not null,
  email    text not null
);

create table if not exists requests (
  id             text primary key,
  kind           text not null check (kind in ('restaurant','store')),
  name           text not null,
  country        text not null,
  city           text not null,
  city_slug      text not null,
  note           text,
  whatsapp       text,
  website        text,
  created_by_uid text not null,
  created_by_handle text not null,
  support_count  integer not null default 1,
  status         text not null default 'open' check (status in ('open','listed','hidden')),
  created_at     timestamptz not null default now()
);
create index if not exists requests_where_idx on requests (status, country, city_slug);
create index if not exists requests_creator_idx on requests (created_by_uid);
create table if not exists supporters (
  request_id text not null references requests(id) on delete cascade,
  uid        text not null,
  handle     text not null,
  at         timestamptz not null default now(),
  primary key (request_id, uid)
);

create table if not exists follows (
  follower_uid    text not null,
  follower_handle text not null,
  followee_uid    text not null,
  followee_handle text not null,
  at              timestamptz not null default now(),
  primary key (follower_uid, followee_uid)
);
create index if not exists follows_followee_idx on follows (followee_uid);

create table if not exists support_messages (
  id          text primary key,
  email       text not null,
  message     text not null,
  name        text,
  user_handle text,
  created_at  timestamptz not null default now()
);

-- Lock the public API: RLS on, no policies => the anon/authenticated keys can do nothing. The server's direct connection is unaffected.
do $$ declare t text; begin
  foreach t in array array['restaurants','prices','deals','leads','claims','profiles','usernames','requests','supporters','follows','support_messages'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;
