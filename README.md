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
| `/admin` | Lead counts (24h / 7d / by restaurant / from ChatGPT) and claims to verify. Basic auth: user `admin`, password `ADMIN_PASSWORD` |
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
Quality guards: only the latest price per store counts; prices older than 120 days are ignored; currencies are never mixed;
a report far from the local median (3x) is held as `flagged` until an admin approves it in `/admin`; plus a honeypot and a
20-reports/day cap per visitor cookie (a speed bump, not strong anti-abuse — add accounts or photo proof before scale).

```bash
npm test                              # price-logic unit tests
npm run import:openprices -- KE 10    # seed Kenya from Open Prices (10 pages x 100)
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
   - `FIREBASE_SERVICE_ACCOUNT` — Firebase console → Project settings → Service accounts → Generate new private key; paste the whole JSON.
   - `ADMIN_PASSWORD` — pick a long one; you log in at `/admin` as user `admin`.
   - `NEXT_PUBLIC_SITE_URL` = `https://zist.it.com`
3. Domain management → **Add a domain** → `zist.it.com`, then set the DNS records Netlify shows.
4. Once: `firebase deploy --only firestore:indexes` (needed for the filtered queries).
5. Check after deploy: `/` loads, `/admin` asks for a password, tapping Message on a restaurant creates a row in `leads`.

Next 16 `proxy.ts` (the admin login prompt) is the part most likely to differ between hosts. `/admin` also re-checks the password
itself (`lib/auth.ts`), so it stays closed either way; if the login prompt doesn't appear, tell me and I'll switch to a login page.

`firestore.rules` is a snapshot of the current shared rules (this app uses the Admin SDK, which bypasses them).
Don't deploy different rules until the legacy app and Zist Find are retired.
