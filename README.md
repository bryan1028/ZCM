# ZCM — Zist Community Marketplaces

A closed, resident-only marketplace per estate. Starter community: **Kijani Ridge**.
Two tabs: **Services** (gardeners, cleaners…) and **Products** (cookies…). Sellers are
**individual** or **business**; business accounts carry the features we can monetise later.

Stack (all free tiers): Next.js 15 · Supabase (Postgres + Auth + RLS) · Vercel.

## Setup
1. Create a Supabase project. In the SQL editor run `supabase/migrations/0001_init.sql`, `0002_trust_and_moderation.sql`, `0003_usernames_and_chat.sql`, `0004_photos_and_reservations.sql`, then `supabase/seed.sql`.
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

## Usernames & chat (0003)
Everyone picks a unique `@username` on first sign-in (`/welcome`). Neighbours only ever see usernames — never real
names, emails or phones (`member_names` view). Chat is 1:1 and always starts from a listing ("Message @seller").
Only the two participants can read it; messages arrive live via Supabase Realtime (30s poll fallback), are
rate-limited (20/min), shadowbanned senders' messages are silently dropped for the recipient, and any chat can be
reported to admins. Make sure **Realtime** is enabled for the `messages` table (the migration adds it to the
`supabase_realtime` publication).

## Photos, my listings, reservations (0004)
- Photos live in **private** Storage buckets; the app serves short-lived signed URLs, and Storage RLS limits reads to
  verified members of that community. Max photos per listing comes from `plan_limits`.
- `/c/<slug>/mine`: pause, activate, mark sold, delete, edit, view counts. `/c/<slug>/l/<id>/edit`: details + photos.
- Reserve/book flow (doc Phase 2): buyer reserves → seller accepts/declines → buyer pays off-platform (e.g. M-Pesa) and
  uploads a screenshot → seller confirms (stock decrements) or rejects the proof. Requests expire after 48h. All state
  changes go through Postgres functions (`create_reservation`, `transition_reservation`, `submit_payment`), so the
  rules can't be bypassed from the client. Money never moves through the app; it only records proof.

## Mapping to the architecture doc
Doc MVP: services & products, search, in-app messaging (WhatsApp link kept as an option). Phase 2: reservations + payment proof.
Phase 3: seller dashboard, chatrooms. Phase 4: AI verification. Stack deviates from the doc on purpose
(Supabase instead of Mongo/Express/Redis/S3) to stay on free tiers with one service to run.

## Not built yet (suggested next)
newsfeed · group chats · in-app payments (M-Pesa Daraja/Stripe) · seller ratings of buyers ·
push notifications · seller dashboard/analytics charts · admin logs · SMS login.
