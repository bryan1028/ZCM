# ZCM — Zist Community Marketplaces

A closed, resident-only marketplace per estate. Starter community: **Kijani Ridge**.
Two tabs: **Services** (gardeners, cleaners…) and **Products** (cookies…). Sellers are
**individual** or **business**; business accounts carry the features we can monetise later.

Stack (all free tiers): Next.js 15 · Supabase (Postgres + Auth + RLS) · Vercel.

## Setup
ZCM keeps **everything in its own Postgres schema, `zcm`**, so it can share a Supabase project with other apps without touching their tables
(and can be lifted into its own project later with `pg_dump --schema=zcm`). Storage buckets are prefixed `zcm-`.

1. In Supabase run the files in `supabase/migrations/` in order (`0000` … `0008`), then `supabase/seed.sql`.
2. **Settings → API → Exposed schemas**: add `zcm` (keep the existing ones). Without this the app gets "schema must be one of…" errors.
3. **Authentication → URL Configuration**: add `<your site>/auth/callback` to Redirect URLs.
4. **Authentication → SMTP**: the built-in mailer allows only ~2 emails/hour, which blocks sign-ups. Add a free SMTP provider
   (e.g. Resend or Brevo) before inviting residents.
5. `cp .env.example .env.local`, fill in the URL + anon key (never put the service-role key in the browser), then `npm install && npm run dev`.
6. Sign in, request to join Kijani Ridge, then run the "bootstrap first admin" SQL at the bottom of `seed.sql` with your email.

To remove ZCM from a shared project: `supabase/teardown.sql` (destroys ZCM data only).

## Deploying (Netlify, free plan)
`netlify.toml` is set up for Next.js. Production site: https://kijani-ridge.netlify.app (Supabase project `zist`, schema `zcm`).
- Env vars on the site: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL` (+ optional push vars).
  `NEXT_PUBLIC_*` values are baked in at build time, so redeploy after changing them.
- Deploy from a terminal: `npx netlify-cli deploy --prod` (with `NETLIFY_AUTH_TOKEN` set and the folder linked via `netlify link`).
  In restricted networks set `NODE_USE_ENV_PROXY=1` so Node's `fetch` honours the proxy.
- For auto-deploys on every push, connect the GitHub repo under Netlify → Site configuration → Build & deploy → Continuous deployment.
- Supabase Auth → URL Configuration must list `<site>/auth/callback`.

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

## Notifications, expiry, dashboard (0005)
- Database triggers create **in-app notifications** for: new/accepted/declined/cancelled/expired reservations, payment proof
  received/rejected, completed orders, new chat messages (collapsed per chat), new residents awaiting admin verification, and
  "you're verified". The 🔔 in the header shows the unread count.
- **Web push** (optional): set the VAPID + `SUPABASE_SERVICE_ROLE_KEY` vars in `.env.example`; users tap "Turn on push
  notifications" on the Notifications page. Pushes are sent after each action (`after()`), claimed via `pushed_at` so they
  never double-send. Service-role key is server-only and used solely to look up subscriptions. On iPhone, the app must be
  added to the Home Screen first. Without these vars, in-app notifications still work.
- **Expiry**: `pg_cron` runs `expire_reservations()` every 15 min (stale requests expire after 48h); lazy checks keep results
  correct even if cron isn't enabled. Expiry notifications show in-app; push for them goes out on the next action, or call
  `POST /api/push/flush` with `Authorization: Bearer $CRON_SECRET` from any scheduler.
- **Dashboard** (`/c/<slug>/dashboard`): gated by `plan_limits.can_see_analytics` (Business Pro). Free accounts see a teaser.
  Pro also gets "Feature 7 days" on listings. Upgrade a seller with:
  `update sellers set plan = 'pro' where id = '<seller id>';`

Payments are **proof only** by design — the app never handles money.

## Growth features (0006–0007)
- **Launch limits** (0006): generous free caps; Pro-only features stay off. Edit `plan_limits` to change.
- **Invite links**: `/invite/<code>` (public landing) → sign in → pre-filled join. Every resident gets a copy with `?ref=<username>`
  ("Invite on WhatsApp" on the feed); the referrer is shown to admins as a vouch if they're a verified member. Applicants are still
  verified by an admin. Codes live in an admin-only table; admins can rotate them.
- **Feed + announcements**: community home shows admin announcements (pin/unpin) and recently added listings across both tabs.
- **Videos**: up to 1 per listing on free (3 on Pro), MP4/WebM/MOV ≤ 20 MB, uploaded directly to a private bucket.
  Supabase free tier caps each upload at 50 MB and total storage at 1 GB — watch storage as you grow.
- **New estates**: `select create_community('slug','Name','City','admin@email')` — see `docs/NEW_COMMUNITY.md`.

## Mapping to the architecture doc
Doc MVP: services & products, search, in-app messaging (WhatsApp link kept as an option). Phase 2: reservations + payment proof.
Phase 3: seller dashboard, chatrooms. Phase 4: AI verification. Stack deviates from the doc on purpose
(Supabase instead of Mongo/Express/Redis/S3) to stay on free tiers with one service to run.

## Not built yet (suggested next)
newsfeed · group chats · seller ratings of buyers ·
seller dashboard/analytics charts · admin logs · SMS login.
