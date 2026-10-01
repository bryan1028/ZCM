/**
 * Import real shop prices from Open Prices (Open Food Facts). Needs FIREBASE_SERVICE_ACCOUNT unless --dry.
 *
 *   npm run import:openprices -- USD 40            # 40 pages x 100 newest USD prices
 *   npm run import:openprices -- EUR 20 --country FR
 *   npm run import:openprices -- USD 3 --dry       # preview only, writes nothing
 *
 * IMPORTANT: Open Prices cannot filter by country, only by currency, so we filter by currency and optionally keep one country.
 * Coverage is mostly USD (US) and EUR (Europe). There is NO Kenyan data (KES has 0 prices), so Nairobi relies on community reports.
 * Source: https://prices.openfoodfacts.org (open data; keep the Open Food Facts credit in the footer and check their licence terms).
 */
import { getStore } from "../lib/store";
import { productKey, tokenize } from "../lib/prices";
import { slugify } from "../lib/util";
import type { PricePoint } from "../lib/types";

const args = process.argv.slice(2);
const [currency, pagesArg] = args.filter((a) => !a.startsWith("--"));
const country = args.includes("--country") ? args[args.indexOf("--country") + 1]?.toUpperCase() : undefined;
const dry = args.includes("--dry");
if (!currency || !/^[A-Za-z]{3}$/.test(currency)) { console.error("usage: import-openprices <CURRENCY> [pages] [--country XX] [--dry]"); process.exit(1); }
if (!dry && !process.env.FIREBASE_SERVICE_ACCOUNT) { console.error("Set FIREBASE_SERVICE_ACCOUNT first (or use --dry)."); process.exit(1); }
const pages = Math.min(Number(pagesArg) || 5, 200);

/* eslint-disable @typescript-eslint/no-explicit-any */
async function main() {
  const out: Omit<PricePoint, "id">[] = [];
  let seen = 0;
  for (let page = 1; page <= pages; page++) {
    const url = `https://prices.openfoodfacts.org/api/v1/prices?currency=${currency.toUpperCase()}&order_by=-created&size=100&page=${page}`;
    const res = await fetch(url, { headers: { "User-Agent": "zist-import/0.2 (https://zist.it.com)" } });
    if (!res.ok) throw new Error(`Open Prices ${res.status}`);
    const body: any = await res.json();
    for (const it of body.items ?? []) {
      seen++;
      const loc = it.location ?? {}, prod = it.product ?? {};
      const name: string | undefined = prod.product_name || it.product_name;
      const price = Number(it.price);
      const city: string | undefined = loc.osm_address_city || loc.osm_address_town || loc.osm_address_village;
      const cc: string | undefined = loc.osm_address_country_code?.toUpperCase();
      const store: string | undefined = loc.osm_name;
      if (!name || !store || !city || !cc || !Number.isFinite(price) || price <= 0) continue;
      if (country && cc !== country) continue;
      if (it.price_per && it.price_per !== "UNIT") continue; // per-kg prices aren't comparable to per-pack prices
      const brand = typeof prod.brands === "string" ? prod.brands.split(",")[0].trim() || undefined : undefined;
      const size = prod.product_quantity ? `${prod.product_quantity}${prod.product_quantity_unit ?? ""}` : undefined;
      const when = new Date(it.date ?? it.created ?? Date.now()).toISOString();
      out.push({
        productKey: productKey(name, brand, size, it.product_code), productName: name, brand, size, barcode: it.product_code || undefined,
        storeName: store, country: cc, city, citySlug: slugify(city), lat: loc.osm_lat, lng: loc.osm_lon,
        price, currency: currency.toUpperCase(), tokens: tokenize(name, brand), source: "openprices", status: "ok",
        observedAt: when, createdAt: new Date().toISOString(), sourceId: String(it.id),
      });
    }
    if (page >= (body.pages ?? 1)) break;
  }
  const byCity = new Map<string, number>(); out.forEach((p) => byCity.set(`${p.city}, ${p.country}`, (byCity.get(`${p.city}, ${p.country}`) ?? 0) + 1));
  console.log(`${seen} fetched, ${out.length} usable. Top cities:`, JSON.stringify([...byCity.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)));
  console.log("sample:", JSON.stringify(out.slice(0, 2).map((p) => ({ n: p.productName, b: p.brand, s: p.size, store: p.storeName, city: p.city, price: p.price, cur: p.currency, at: p.observedAt.slice(0, 10) }))));
  if (dry) return console.log("DRY RUN: nothing written.");
  console.log(await getStore().upsertPrices(out));
}
main().catch((e) => { console.error(e); process.exit(1); });
