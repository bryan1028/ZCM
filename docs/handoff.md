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
