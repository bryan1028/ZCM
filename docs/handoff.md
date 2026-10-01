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

## Written but NOT yet run
- `scripts/overture_extract.py` + `scripts/cities.json`: pulls restaurants/cafes for ~40 world cities from Overture Maps
  (S3 reachable through the proxy with `pip install pyarrow s3fs phonenumbers`; set AWS_CA_BUNDLE=/root/.ccr/ca-bundle.crt).
  Output JSONL -> needs `scripts/import-places-jsonl.ts` (NOT written yet: map JSONL rows to `Restaurant` with
  source "overture", status "unclaimed", sourceId = Overture id, whatsapp/phone/website/cuisines/diets/rank, then
  `store.upsertImported`).
- Open Prices has data in many countries (USD ~39k, EUR ~240k, GBP, CAD, INR, AUD ...). `scripts/import-openprices.ts
  <CURRENCY> <pages> [--country XX]` already works with either backend; broaden it across countries.

## Still to build
1. `phone` / `website` support in the UI and `/go/[id]` (modes `call` and `website`, `Lead.channel`), and show local
   restaurants (menus coming soon) on Zood when a city has restaurants but no dishes. Columns already exist in the schema.
2. MCP tools: add `websiteUrl` / tracked `callUrl` for restaurants without WhatsApp; no raw phone numbers in output.
3. Create the Supabase project, apply the migration, set `DATABASE_URL` (use the TRANSACTION POOLER string, port 6543) on
   Netlify and in the shell, run the loaders, deploy, verify, then retire Firestore reads.

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
