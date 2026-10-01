/**
 * Import real shop prices from Open Prices (Open Food Facts) for a country. Needs FIREBASE_SERVICE_ACCOUNT.
 *
 *   npm run import:openprices -- KE            # up to 5 pages (500 prices)
 *   npm run import:openprices -- KE 20         # up to 20 pages
 *
 * Source: https://prices.openfoodfacts.org  (open data, crowdsourced; keep the Open Food Facts credit in the footer —
 * check their current license terms before large-scale use). Only the newest prices per page are taken; re-runs skip duplicates.
 */
import { getStore } from "../lib/store";
import { productKey, tokenize } from "../lib/prices";
import { slugify } from "../lib/util";
import type { PricePoint } from "../lib/types";

const [country, pagesArg] = process.argv.slice(2);
if (!country || !/^[A-Za-z]{2}$/.test(country)) { console.error("usage: import-openprices <ISO2 country> [pages]"); process.exit(1); }
if (!process.env.FIREBASE_SERVICE_ACCOUNT) { console.error("Set FIREBASE_SERVICE_ACCOUNT first."); process.exit(1); }
const pages = Math.min(Number(pagesArg) || 5, 100);

/* eslint-disable @typescript-eslint/no-explicit-any */
async function main() {
  const out: Omit<PricePoint, "id">[] = [];
  for (let page = 1; page <= pages; page++) {
    const url = `https://prices.openfoodfacts.org/api/v1/prices?location__osm_address_country_code=${country.toUpperCase()}&order_by=-date&size=100&page=${page}`;
    const res = await fetch(url, { headers: { "User-Agent": "zist-import/0.1 (https://zist.it.com)" } });
    if (!res.ok) throw new Error(`Open Prices ${res.status}`);
    const body: any = await res.json();
    for (const it of body.items ?? []) {
      const loc = it.location ?? {};
      const prod = it.product ?? {};
      const name: string | undefined = prod.product_name || it.product_name;
      const price = Number(it.price);
      const city: string | undefined = loc.osm_address_city || loc.osm_address_town || loc.osm_address_village;
      const store: string | undefined = loc.osm_name;
      if (!name || !store || !city || !Number.isFinite(price) || price <= 0 || !it.currency) continue;
      const brand = typeof prod.brands === "string" ? prod.brands.split(",")[0].trim() || undefined : undefined;
      const size = prod.product_quantity ? `${prod.product_quantity}${prod.product_quantity_unit ?? ""}` : undefined;
      const date = it.date ? new Date(it.date).toISOString() : new Date().toISOString();
      out.push({
        productKey: productKey(name, brand, size, it.product_code), productName: name, brand, size, barcode: it.product_code || undefined,
        storeName: store, country: country.toUpperCase(), city, citySlug: slugify(city), lat: loc.osm_lat, lng: loc.osm_lon,
        price, currency: String(it.currency).toUpperCase(), tokens: tokenize(name, brand), source: "openprices", status: "ok",
        observedAt: date, createdAt: new Date().toISOString(), sourceId: String(it.id),
      });
    }
    if (page >= (body.pages ?? 1)) break;
  }
  console.log(`${out.length} usable prices`);
  console.log(await getStore().upsertPrices(out));
}
main().catch((e) => { console.error(e); process.exit(1); });
