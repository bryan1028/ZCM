/**
 * Bulk-add restaurants (and optionally menus) from CSV. Needs FIREBASE_SERVICE_ACCOUNT.
 *
 *   npm run import:csv -- restaurants.csv
 *   npm run import:csv -- restaurants.csv --menus menus.csv
 *
 * restaurants.csv columns: name,country,city,address,lat,lng,whatsapp,cuisines,diets
 *   country = ISO-2 (KE). cuisines/diets = ";"-separated. diets from: vegan vegetarian gluten_free halal kosher dairy_free nut_free
 * menus.csv columns: restaurant,city,item,description,price,currency,diets,allergens
 *   "restaurant"+"city" must match a row in restaurants.csv (or an already imported restaurant).
 *
 * Imported restaurants are created as `active` only if you pass --active; the default is `unclaimed`.
 */
import { readFileSync } from "node:fs";
import { parseCsv } from "./csv";
import { getStore, isDemo } from "../lib/store";
import { DIETS, type Diet, type MenuItem, type Restaurant } from "../lib/types";
import { normalizeWhatsapp, slugify } from "../lib/util";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const menusFile = args.includes("--menus") ? args[args.indexOf("--menus") + 1] : undefined;
const status: Restaurant["status"] = args.includes("--active") ? "active" : "unclaimed";
if (!file) { console.error("usage: import-csv <restaurants.csv> [--menus menus.csv] [--active]"); process.exit(1); }
if (isDemo()) { console.error("Set DATABASE_URL (Supabase) or FIREBASE_SERVICE_ACCOUNT first."); process.exit(1); }

const list = (s: string) => s.split(";").map((x) => x.trim()).filter(Boolean);
const diets = (s: string): Diet[] => list(s).filter((d): d is Diet => DIETS.some((x) => x.id === d));
const idFor = (name: string, city: string) => `import-${slugify(name)}-${slugify(city)}`;

async function main() {
  const store = getStore();
  const rows = parseCsv(readFileSync(file!, "utf8"));
  const items: Omit<Restaurant, "id">[] = [];
  for (const r of rows) {
    if (!r.name || !r.city || !/^[A-Za-z]{2}$/.test(r.country)) { console.warn("skip (name/city/country missing):", r.name); continue; }
    const lat = r.lat ? Number(r.lat) : undefined, lng = r.lng ? Number(r.lng) : undefined;
    items.push({
      name: r.name, country: r.country.toUpperCase(), city: r.city, citySlug: slugify(r.city), address: r.address || undefined,
      lat: Number.isFinite(lat) ? lat : undefined, lng: Number.isFinite(lng) ? lng : undefined,
      whatsapp: normalizeWhatsapp(r.whatsapp), cuisines: list(r.cuisines ?? ""), diets: diets(r.diets ?? ""), menu: [],
      status, source: "import", sourceId: `${slugify(r.name)}-${slugify(r.city)}`, plan: "free", leadCount: 0, createdAt: new Date().toISOString(),
    });
  }
  console.log(await store.upsertImported(items));

  if (menusFile) {
    const byRestaurant = new Map<string, MenuItem[]>();
    for (const m of parseCsv(readFileSync(menusFile, "utf8"))) {
      if (!m.restaurant || !m.city || !m.item) continue;
      const key = idFor(m.restaurant, m.city);
      const price = m.price ? Number(m.price) : undefined;
      const arr = byRestaurant.get(key) ?? [];
      arr.push({ id: `m${arr.length + 1}`, name: m.item, description: m.description || undefined, price: Number.isFinite(price) ? price : undefined, currency: m.currency || undefined, diets: diets(m.diets ?? ""), allergens: list(m.allergens ?? "") });
      byRestaurant.set(key, arr);
    }
    for (const [id, menu] of byRestaurant) {
      if (await store.getRestaurant(id)) await store.setMenu(id, menu);
      else console.warn("menu skipped, no restaurant:", id);
    }
    console.log(`menus set for ${byRestaurant.size} restaurants`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
