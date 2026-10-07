# ZCM — Zist Community Marketplaces

A closed, resident-only marketplace per estate. Starter community: **Kijani Ridge**.
Two tabs: **Services** (gardeners, cleaners…) and **Products** (cookies…). Sellers are
**individual** or **business**; business accounts carry the features we can monetise later.

Stack (all free tiers): Next.js 15 · Supabase (Postgres + Auth + RLS) · Vercel.

## Setup
1. Create a Supabase project. In the SQL editor run `supabase/migrations/0001_init.sql`, `0002_trust_and_moderation.sql`, then `supabase/seed.sql`.
2. Supabase → Auth → URL Configuration: set Site URL and add `<site>/auth/callback` as a redirect URL.
3. `cp .env.example .env.local` and fill in the URL + anon key (never put the service-role key in the app).
4. `npm install && npm run dev`.
5. Sign in, request to join Kijani Ridge, then run the "bootstrap first admin" SQL at the bottom of `seed.sql` with your email.

## How it scales to more communities
- Every community-owned row has `community_id`; RLS only exposes rows to **verified members of that community**.
- A new estate = one `insert into communities`. Routes are `/c/<slug>/…`; no code change.
- One person can belong to several communities. Each community has its own admin(s) who verify residents.

## Resident verification
Sign in (email magic link) → request to join with unit number + a note → status `pending` → a community admin
verifies at `/c/<slug>/admin`. Only `verified` memberships can read anything. Users cannot verify themselves (RLS).

## Monetisation hooks (already in the schema)
`plan_limits` defines per (account type × plan): max active listings, featured listings, analytics, images.
Change a row to change a tier. `sellers.plan` can only be changed by you (service role / SQL), so billing can
later be a webhook that flips `free` → `pro`.

## Trust & moderation (0002)
Member reviews (1–5★, one per listing, no self-reviews) · reports on listings/reviews resolved by admins ·
ban (suspend) and shadowban (user keeps posting, nobody else sees it) · per-listing view counts for sellers ·
stock/availability · search · installable PWA manifest.

## Mapping to the architecture doc
Doc MVP: services & products, search, messaging (WhatsApp deep-link for now). Phase 2: reservations + payment proof.
Phase 3: seller dashboard, chatrooms. Phase 4: AI verification. Stack deviates from the doc on purpose
(Supabase instead of Mongo/Express/Redis/S3) to stay on free tiers with one service to run.

## Not built yet (suggested next)
Image upload (Supabase Storage) · in-app messaging/newsfeed · reservations & payment proof (Phase 2) ·
push notifications · listing edit UI · seller dashboard · admin logs · SMS login.
