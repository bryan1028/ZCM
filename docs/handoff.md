# Handoff: moving Zist (Zood + Zind) from Firestore to Supabase

## Why
The live site (zist.it.com) returns 500 on every page because Firestore's free-tier daily quota ran out
(`8 RESOURCE_EXHAUSTED: Quota exceeded`). Decision: move all data to Supabase Postgres. Firebase Auth stays for login.
No real users yet, so nothing needs to be preserved except the curated data below.

## Done and tested (this branch)
- `supabase/migrations/0001_init.sql` — schema (RLS on, no policies; the app uses a direct server connection only).
- `lib/pg-store.ts` — full Postgres implementation of the `Store` interface. `scripts/test-pg-store.ts` runs 30+ checks
  against a real in-process Postgres (PGlite): `npx tsx scripts/test-pg-store.ts`.
- `lib/store.ts` — `getStore()` uses Postgres when `DATABASE_URL` is set, else Firestore, else demo data.
- `scripts/load-legacy-data.ts` — loads the 101 curated Nairobi restaurants + 22 grocery prices from the user's two old
  import pages (kept at /root/.claude/uploads/.../c64162dd-zistimport.html and cf3d73d2-zistfindimport.html, or copy them
  from the user). Dry run by default.
- UI fixes (dish cards, price bars, whole-number prices) and Zood/Zind features from earlier are in the repo but the
  latest UI fixes are NOT deployed.

## Also done since (untested against a live database; unit-tested locally)
- `lib/places.ts` + `scripts/import-places-jsonl.ts` (+ `scripts/test-places.ts`): map extracted world restaurants to listings. WhatsApp is
  only set when the extractor judged a WhatsApp-capable mobile; other numbers are `phone` only.
- `/go/[id]?mode=call|website` tracked redirects, `Lead.channel`, Call/Website buttons, honest "contact details come from public
  listings" note, local restaurants shown on Zood when a city has restaurants but no menus, MCP `callUrl`/`websiteUrl`.
- `scripts/import-openprices.ts --out file.jsonl` stages prices without a database; `scripts/import-prices-jsonl.ts` loads them.

## Staged data (ready to load; no database needed to produce it)
- `data/overture-places.jsonl`: restaurants/cafes for 43 world cities (Overture Maps, balanced so chains don't crowd out independents:
  max 2 branches per name per city, up to 300 per city). Produced by `python3 scripts/overture_extract.py --out data/overture-places.jsonl
  --per-city 300 --per-chain 2` (about 25 minutes). Load: `npx tsx scripts/import-places-jsonl.ts data/overture-places.jsonl --apply`.
  WhatsApp is set only for WhatsApp-capable mobiles; everything else is Call/Website (Mexico, Japan, Korea, US, CA show 0 WhatsApp by design).
- `data/prices.jsonl`: ~15k Open Prices rows in 45 countries / 629 cities (EUR, USD, NOK, SEK, PLN, GBP, DKK, CHF, CAD, JPY, INR, MXN, ...).
  Load: `npx tsx scripts/import-prices-jsonl.ts data/prices.jsonl --apply`. Kenya has no Open Prices data (Nairobi prices come from the curated list).

## Still to do
1. Create the Supabase project, apply `supabase/migrations/0001_init.sql`, set `DATABASE_URL` (TRANSACTION POOLER string, port 6543) on
   Netlify and in the shell, run `scripts/load-legacy-data.ts --apply`, the places/prices loaders, deploy (draft first), verify, then
   stop using Firestore for data. BLOCKER at the time of writing: `SUPABASE_ACCESS_TOKEN` was not present in the session environment.
## Supabase access
The user adds `SUPABASE_ACCESS_TOKEN` (a Personal Access Token) in the cloud environment settings. Use the Management API
(https://api.supabase.com/v1/...) to create the project and apply the migration (`POST /v1/projects/{ref}/database/query`).
Never use the dashboard password; the system blocks that and it should not be used.

## Deploy recipe (Netlify)
`NEXT_PUBLIC_SITE_URL=https://zist.it.com netlify build --offline` then
`netlify deploy --no-build --dir .netlify/static --skip-functions-cache` (draft first with `--alias`, test, then restore it
via the API to publish). `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt` behind the proxy.
The Netlify token may be named `Netlify_AUTH_TOKEN` (mixed case); map it to `NETLIFY_AUTH_TOKEN`.
Netlify env vars to add: `DATABASE_URL`. Keep `FIREBASE_SERVICE_ACCOUNT` (Firebase Auth), `ADMIN_PASSWORD`, `NEXT_PUBLIC_SITE_URL`.
Do not upgrade firebase-admin past 13.x on Netlify (ESM-only jose breaks functions).


## Update: Supabase migration DONE (2026-10-01)
- Supabase project `zist` (ref `xwtfdjkpwzgybangudyc`, eu-central-1) has the schema and the data: 12,812 restaurants (43 cities, 37 countries) and 15,481 prices.
- `DATABASE_URL` (pooled, port 6543) is set on the Netlify site. The site runs on Supabase; Firestore is no longer used for data (Firebase Auth still is).
- The sandbox cannot open raw Postgres TCP. Data was loaded by generating `insert ... jsonb_to_recordset($zj$...$zj$)` SQL files from the same store code and POSTing them to
  `https://api.supabase.com/v1/projects/{ref}/database/query` with `SUPABASE_ACCESS_TOKEN`. Inserts are idempotent (`on conflict do nothing`).
- Legacy Firestore data (one profile) was not migrated; there are no real users.
- One test lead (Chuka Ramen Bar, WhatsApp) from verification is in the `leads` table; delete it before reading lead stats.
- Live deploy includes the WhatsApp "order request" change and the new UI.

## Update: unclaimed restaurants are a demand signal, not a lead hand-off
- Every imported restaurant is `status=unclaimed`. For those, `/go/[id]` records the tap (same bot filter and 1h dedupe) and redirects to `/r/[id]/thanks`,
  which says plainly that the restaurant has NOT been messaged and tells the Zood story. No phone/WhatsApp/website is exposed, so no free leads and no "number isn't on WhatsApp" errors.
- Buttons read "I want to order here" / "I want this". ChatGPT tool text tells the model the link does not contact the restaurant.
- SUPERSEDED by the claim flow below: the "I want to order here" tap and /r/[id]/thanks were removed.
- Restaurants that join (status `active`) keep the direct WhatsApp/call/website flow.
- `/about` has the Zood and Zind vision; `VisionStory` (app/vision.tsx) is reused on the thanks page and /find.
- Admin has a "Restaurants to pitch" table with real 30-day counts and a copy-ready pitch line. Numbers are deliberately real, not invented: restaurants can ask for proof.

## Update: claims, owner editor, admin inbox (migration 0002 applied to the live project)
- **Zood only lists active restaurants WITH a menu** (searchRestaurants, listCities). Unclaimed/menu-less pages still load (noindex) so a claim link works.
  Consequence: Zood is empty until restaurants are approved and have menus (owners via /account/restaurant, or admin via /admin/restaurant/[id]).
- Unclaimed page shows "Is this your restaurant? ... Claim your free trial" -> `/list?claim=<id>` (sign-in required) -> `submitClaim` (app/claim-actions.ts): name, role, WhatsApp, email, proof.
  `/go/[id]` for an unclaimed restaurant redirects to the claim page; contact details are never exposed for them.
- Admin `/admin#claims` ("Inbox: restaurants"): per claim shows claimant, listed phone/website, email-domain-vs-website match, proof, thread; actions: reply, mark verifying, approve (status active, plan trial, owner set, 90-day trial), reject.
  `/admin#support` ("Inbox: support") is the existing support list. Replies to claimants are in-app (shown on /account/restaurant); there is no email sending yet.
- Approved owners edit profile + menu at `/account/restaurant` (one dish per line: `Name | price | description | diets | allergens`). Admin can do the same at `/admin/restaurant/[id]`.
- Deleting an account scrubs the person from their claims and releases restaurant ownership.
- Store methods for claims/owners are Postgres-only (Firestore/demo throw).

## Update: pinboard homepage, signatures, mission (2026-10-01)
- Zood home is "the Pinterest of restaurants": gradient hero, 7-photo pinboard (`lib/pins.ts`, photos in `public/img/pins`, Wikimedia Commons, credits on `/about#credits`), mission block, and a **Wanted board**.
  Pinterest itself was NOT used: pins are other people's copyrighted photos and scraping breaks its terms. To add a photo: add a Pin with a Commons image and a `credit`.
- Wanted board (`app/wanted.tsx`): existing unclaimed restaurants (from `searchRestaurants({ includeUnlisted: true })`) with "I want this on Zood" signatures.
  A signature is a `requests` row keyed by `lib/wanted.ts` (same key as the zummon form), so counts merge with "Zummon a place". Unclaimed restaurant pages show the same button and the owner claim CTA.
- Zind home is "the Wikipedia of prices": green gradient hero, price ticker, crowd-sourcing mission (add a price / see deals / join spotters).
- Commons API is heavily rate-limited from the sandbox: use curl with a descriptive User-Agent and long sleeps.

## Update: hero mosaic, peach, grocery ticker, sign-in fix
- **Sign-in bug:** accounts created before the Postgres move (the one Firebase Auth user) had no `profiles` row, so `currentUser()` returned null even after a successful login. `lib/session.ts` now creates a blank profile on first sight; the person picks a username on /account. Verified on a draft deploy: signup, login by email and by username, and the missing-profile case. (Test account deleted.)
  The legacy username/profile in Firestore were not copied (Firestore quota was still exhausted).
- Zood hero: photo mosaic (`public/img/mosaic`, Unsplash) across the top with the headline/search centred at the bottom; peach palette tokens (`--peach`, `--peach-deep`, `--peach-soft`) in globals.css.
- Zind ticker: `lib/ticker.ts` + `Store.priceMedians` (Postgres) give the median shelf price per country for 8 staples; cached 10 min per server. Sizes vary, so the page says so.

## Update: top strips and centred heroes
- Zood: moving strip of place-labelled dishes (`PinStrip`) above a centred hero (Unsplash mosaic behind a brand gradient). Zind: moving strip of grocery photo cards with prices in 3 countries (`StapleStrip`, photos in `public/img/staples`) above a centred hero on a supermarket-aisle photo, then the price ticker.
- Staples are in `lib/ticker.ts` (sugar was dropped for lack of a photo). To add one: add a photo to `public/img/staples` and an entry with `img`.

## Update: city dropdown and pledges
- "Where?" is a native `<datalist>` (`app/cityinput.tsx`): Zood lists every city with restaurants (`listCities({ includeUnlisted: true })`, 43 cities), Zind lists cities with prices (`priceCities()`).
- Typing a city with no restaurants shows "Add a restaurant in X" (links to `/requests/new?city=X`); a city with restaurants shows "N restaurants in X aren't on Zood yet, pledge" and the Wanted board. "Sign"/"signature" wording is now "pledge".

## Update: pledges are local
- You can only pledge for restaurants in the country you're in (`pledgeCountry` in lib/geo.ts: request IP country, falling back to profile country; never stored; unknown = allowed). Enforced in `wantRestaurantAction`, and the UI shows "Pledges come from people in X" for other countries. Country level, not city level, and a VPN can bypass it.

## Update: shareable pledge cards
- `/pledge/[city]` (any city slug): gradient header with real pledge and restaurant counts, share bar (WhatsApp/X/Facebook/copy/native share, `app/share.tsx`), and the Wanted board. Nairobi is the launch city: homepage ribbon links to `/pledge/nairobi`; other cities work the same and are in the sitemap.
- Link-preview images are generated per page (`app/pledge/[city]/opengraph-image.tsx`, `app/r/[id]/opengraph-image.tsx`, next/og, live data, no emoji because the default font lacks them).
- After pledging, `?pledged=1` shows a thank-you plus a share bar on home, city and restaurant pages. Unclaimed restaurant pages always have a share bar.

## Update: email verification and reCAPTCHA
- Signup now sends Firebase's standard verification email (`sendVerificationEmail`, via a custom token so no password is needed). `requireVerified()` gates pledging, zummoning/backing, claiming and price reports; unverified users are sent to `/verify` (resend once a minute, "I've verified" re-checks live with Firebase, so no re-login). Verified end to end on a draft with a throwaway account (deleted).
- The verification email comes from Firebase's default template/sender. Branding it or sending from our own domain needs a mailer (Resend) later.
- reCAPTCHA v2 checkbox is ON for signup (`app/captcha.tsx`, `captchaOk` in lib/session.ts). Netlify env vars `RECAPTCHA_SITE_KEY` and `RECAPTCHA_SECRET` are set (v2 checkbox, domain zist.it.com). Verified: widget renders, secret is accepted by Google, signup without a solved captcha is rejected. A solved captcha has not been tested by a human yet. Pledges deliberately have NO per-user cap.

- **reCAPTCHA is v3, not v2.** The key the owner created is a v3 (invisible, score-based) key: Google's v2 widget endpoint answered "Invalid input" for it, while size=invisible loaded. Code now matches: `app/captcha-client.tsx` fetches a token on page load (refreshed every 90 s) into a hidden `g-recaptcha-response`; `captchaOk` accepts success + action `signup` + score >= 0.5. If the key is ever swapped for a v2 key, change both files back. Not yet confirmed by a real browser signup (the sandbox browser can't reach Google through the proxy).

- **CAPTCHA removed** at the owner's request (email verification is the bot gate). `app/captcha*.tsx` and `captchaOk` are deleted and the `RECAPTCHA_*` env vars removed from Netlify. Git history has the v3 implementation if it is ever needed again.
