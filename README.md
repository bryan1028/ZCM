# Zist

Find restaurants that match your diet and allergies, see their menus, and message them on WhatsApp.
Every "Message" tap is logged server-side so we can count the leads we send to restaurants.

Next.js (App Router) + Firebase Firestore (project `zist-de662`). The previous single-file site is kept in `legacy/index.html`.

## Run locally (no credentials needed)

```bash
npm install
npm run dev        # http://localhost:3000 — uses data/demo.json, leads go to data/leads.jsonl
```

Set `FIREBASE_SERVICE_ACCOUNT` (see `.env.example`) to use the real database instead.

## How it works

| Path | What |
|---|---|
| `/` | Search by city, dish/cuisine and diet chips |
| `/c/{country}/{city}` | SEO city page (indexed by Google, and used by the ChatGPT app) |
| `/r/{id}` | Restaurant page: menu, diets, allergens, Message button |
| `/go/{id}?item=&src=` | **Lead tracker.** Logs the lead on the server, then redirects to `wa.me/<number>?text=…(ref ABCD)`. Skips bots and repeat taps (1h per visitor) |
| `/list` | Owners claim a listing or add a new restaurant (lands in the admin queue as `pending`) |
| `/admin` | Lead counts (24h / 7d / by restaurant / from ChatGPT) and claims to verify. Sign in at `/admin/login` with `ADMIN_PASSWORD` |
| `/api/restaurants` | Public JSON search, for the ChatGPT app to wrap |

The `ref` code in each WhatsApp message lets a restaurant confirm a lead ("yes, ref K82E messaged us").
Link taps count *intent to message*; WhatsApp doesn't tell us whether the message was actually sent.

## Zist Find: prices & deals (worldwide)

| Path | What |
|---|---|
| `/find?q=milk&city=nairobi` | Price per store for a product, cheapest highlighted, with how old each price is |
| `/find/report` | Anyone can report a shelf price (no account) |
| `/deals` | Active deals by city; added by admin in `/admin` |
| `/api/prices?q=&city=&country=` | Public JSON comparison, for the ChatGPT app |

Prices come from shoppers plus the open **Open Prices** dataset (Open Food Facts) — no scraping of retailer sites.
**Coverage reality:** Open Prices is mostly US (USD, ~39k prices) and Europe (EUR, ~240k). It has **no Kenyan prices** (KES = 0), so Nairobi depends on community reports. About 2,900 US prices (New York, Mountain View, Rochester Hills, ...) are already imported. Cross-store comparisons are sparse: most products have a price at only one store.
Quality guards: only the latest price per store counts; prices older than 120 days are ignored; currencies are never mixed;
a report far from the local median (3x) is held as `flagged` until an admin approves it in `/admin`; plus a honeypot and a
20-reports/day cap per visitor cookie (a speed bump, not strong anti-abuse — add accounts or photo proof before scale).

```bash
npm test                              # price-logic unit tests
npm run import:openprices -- USD 30   # 30 pages x 100 newest USD prices (filters by CURRENCY; add --country FR to keep one country)
```

Firestore collections added: `prices`, `deals_find` (the legacy Find app's `items`/`deals` are untouched).

## Adding restaurants worldwide

```bash
export FIREBASE_SERVICE_ACCOUNT="$(cat service-account.json)"

# 1. Seed a city from OpenStreetMap (name, address, location, cuisine, diets, contact:whatsapp)
npm run seed:osm -- KE Nairobi
npm run seed:osm -- GB London --use-phone    # also treat plain phone numbers as WhatsApp candidates

# 2. Or import your own sheets
npm run import:csv -- restaurants.csv --menus menus.csv
```

Seeded restaurants are `unclaimed`: visible, no menu, with a "claim this listing" prompt. Owners claim via `/list`,
you verify them on WhatsApp from `/admin`, then set their `status` to `active` in Firestore.

**Data licensing:** OSM is ODbL (credit is in the footer). Google Places terms do not allow bulk-storing
place data beyond the place ID, so Places is not used for seeding.

## Deploy to zist.it.com (Netlify)

1. Netlify → **Add new site → Import an existing project → GitHub** → pick `bryan1028/ZCM`, branch `claude/blissful-rubin-a7wvq3` (or merge to your main branch first). `netlify.toml` already sets the build.
2. Site configuration → **Environment variables**:
   - `FIREBASE_SERVICE_ACCOUNT` — Firebase console → Project settings → Service accounts → Generate new private key; paste the whole JSON, or its base64 (`base64 -w0 key.json`; macOS: `base64 -i key.json | tr -d '\n'`) if the form rejects `{`.
   - `ADMIN_PASSWORD` — pick a long one; you sign in at `/admin/login`.
   - `NEXT_PUBLIC_SITE_URL` = `https://zist.it.com`
3. Domain management → **Add a domain** → `zist.it.com`, then set the DNS records Netlify shows.
4. Once: `firebase deploy --only firestore:indexes` (needed for the filtered queries).
5. Check after deploy: `/` loads, `/admin` redirects to `/admin/login`, tapping Message on a restaurant creates a row in `leads`.

`firestore.rules` is the **live** ruleset (this app uses the Admin SDK, which bypasses rules). It was tightened on 2026-10-01 because
sign-up is open: `profiles` are readable only by their owner, `usernames` (which hold emails) and `leads` are server-only, and
`restaurants` are admin-write. Zist Find's `items`/`deals` are unchanged. To roll back, republish ruleset
`f86fd377-f85d-4681-b3ca-ffd824201f47` (Firebase console -> Firestore -> Rules -> history). Rolling back re-opens the email/profile exposure.

> **Do not upgrade `firebase-admin` past 13.x on Netlify.** v14 depends on an ES-module-only `jose` that Netlify's function runtime
> cannot `require()`, which crashed every page with `ERR_REQUIRE_ESM`. It works locally, so only a deploy shows it.

### Deploying from a sandbox/CLI
`netlify build --offline`, then `netlify deploy --prod --no-build --dir .netlify/static --skip-functions-cache`
(publish dir must be `.netlify/static`; set `NODE_USE_ENV_PROXY=1` behind a proxy). Netlify's own build from the repo needs no flags.

## Accounts & community requests

- `/signup`, `/login`, `/account`, `/reset`: server-side auth against Firebase (username or email; password never reaches the browser). Session = 14-day httpOnly cookie.
- `/requests`: anyone signed in can request a restaurant or store; it carries their `@username` signature; others back it with one tap.
  Same place twice = one request with more backers. Requests for places already listed redirect to the listing.
- Price reports and "Message" clicks are attributed to the signed-in user when there is one.
- Marketing consent: the opt-in box is **unticked by default**. `/admin/export?type=users` only ever exports opted-in emails.
- Admin `/admin`: accounts, opt-ins, requests, backings, and CSV exports (the proof-of-concept numbers for restaurants and investors).

## ChatGPT plugin

- `/mcp`: remote MCP server (Streamable HTTP, stateless, no auth) with 5 read-only tools: `search_restaurants`, `get_restaurant`, `compare_prices`, `find_deals`, `list_requested_places` (`lib/mcp.ts`).
  Inputs are city names only; diet/allergy filters and search text are never stored or logged. Output has no raw phone numbers and no user handles.
  "Message" results are tracked `/go/<id>?src=chatgpt` links, so leads from ChatGPT are counted separately in `/admin`.
- Test it: `npx tsx scripts/test-mcp.ts https://zist.it.com/mcp` (checks the contract, annotations, validation, no PII).
- `plugin/` is the submission package; `python3 scripts/build-plugin-zip.py` builds `zist-plugin-1.1.0.zip`. Step-by-step submission, tool justifications and a demo script: [`docs/plugin-submission.md`](docs/plugin-submission.md).
- Domain verification: set `OPENAI_APPS_CHALLENGE` (token from the portal) and redeploy; it is served at `/.well-known/openai-apps-challenge`.
- Legal pages required for review: `/privacy`, `/terms`, `/support` (a contact form stored in `support_messages`, shown in `/admin`). **Have a lawyer review the privacy policy and terms before you rely on them.**

## Social, email and account lifecycle

- `/u/<handle>` public profile (handle, join month, requests only; never diet, allergies, email or city), follow/unfollow, and `/feed` of what people you follow added.
- `/account` has **Delete my account**: removes login, profile, username and follows; strips identity from leads, prices, requests and backings (content stays as "former member").
- `/unsubscribe` uses a signed token (`lib/unsub.ts`). `scripts/send-launch-email.ts` is a **dry run by default**, only targets opted-in users, adds an unsubscribe link and `List-Unsubscribe`, and refuses `--send` without a postal address. Note the one existing opted-in profile came from the old site; confirm that consent before emailing it.

## Zood & Zind (the product names)

- **Zood** (`/`) is dish-first: type what you're craving, optionally pick diets and "skip anything with" allergens, and get **dishes** (not just restaurants) with price, tags and **Message to order**.
  On a restaurant page you tick several dishes and press one button; WhatsApp opens with all of them in the message (`/go/<id>?item=a&item=b`).
  "No allergens listed" is never shown as "allergen-free".
- **Zind** (`/find`) is item-first: type any item and see its price at each store, grouped per city (never mixing cities or currencies). With no search it shows fresh sightings.
- Both are worldwide: the "where?" box is prefilled from the approximate city of the request (`lib/geo.ts`, never stored) and can be cleared to search everywhere. If a city has no data the page widens the search and says so, with a "zummon" call to action.
- **Zummon** (`/requests`) is the name for requesting a place. Same data model as before.
- `npx tsx scripts/test-dishes.ts` and `scripts/test-prices.ts` cover the matching and ranking rules.
- `scripts/migrate-legacy-items.ts` moved the old Zist Find catalogue (20 Nairobi items, 22 store prices) into Zind.
- Seeding restaurants for other cities needs OpenStreetMap, which may be blocked in some sandboxes: run `npm run seed:osm -- FR Paris --signal` from a machine that can reach Overpass (`--signal` keeps only places with a WhatsApp number or diet tags).
