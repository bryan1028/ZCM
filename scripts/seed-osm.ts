/**
 * Seed restaurants for a city from OpenStreetMap (via Overpass). Needs FIREBASE_SERVICE_ACCOUNT.
 *
 *   npm run seed:osm -- KE Nairobi
 *   npm run seed:osm -- GB London --use-phone
 *   npm run seed:osm -- FR Paris --signal      # only places with a WhatsApp number or diet tags (the useful ones)
 *   OVERPASS_URL=https://overpass.kumi.systems/api/interpreter npm run seed:osm -- NG Lagos --signal
 *
 * OSM data is licensed ODbL: keep the "© OpenStreetMap contributors" credit (it is in the site footer).
 * Only `contact:whatsapp` is treated as a WhatsApp number. With --use-phone, a plain `phone` tag is
 * used as a fallback — it may be a landline that is not on WhatsApp, so those chats can fail.
 * Seeded restaurants are `unclaimed`: visible, no menu, with a "claim this listing" prompt.
 */
import { getStore } from "../lib/store";
import { DIETS, type Diet, type Restaurant } from "../lib/types";
import { normalizeWhatsapp, slugify } from "../lib/util";

const [country, city, ...flags] = process.argv.slice(2);
if (!country || !city) { console.error("usage: seed-osm <ISO2 country> <city name> [--use-phone]"); process.exit(1); }
if (!process.env.FIREBASE_SERVICE_ACCOUNT) { console.error("Set FIREBASE_SERVICE_ACCOUNT first."); process.exit(1); }
const usePhone = flags.includes("--use-phone");
const signalOnly = flags.includes("--signal");
const OVERPASS = process.env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter";

interface El { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }

const query = `[out:json][timeout:120];
area["ISO3166-1"="${country.toUpperCase()}"]->.c;
area["name"="${city.replace(/"/g, "")}"](area.c)->.a;
nwr["amenity"="restaurant"](area.a);
out center tags;`;

function dietsFrom(t: Record<string, string>): Diet[] {
  const yes = (k: string) => ["yes", "only"].includes(t[`diet:${k}`]);
  const out: Diet[] = [];
  if (yes("vegan")) out.push("vegan");
  if (yes("vegetarian") || yes("vegan")) out.push("vegetarian");
  if (yes("gluten_free")) out.push("gluten_free");
  if (yes("halal")) out.push("halal");
  if (yes("kosher")) out.push("kosher");
  return out.filter((d) => DIETS.some((x) => x.id === d));
}

async function main() {
  const res = await fetch(OVERPASS, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "zist-seed/0.1 (https://zist.it.com)" },
    body: "data=" + encodeURIComponent(query),
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}: ${await res.text()}`);
  const { elements } = (await res.json()) as { elements: El[] };

  const items: Omit<Restaurant, "id">[] = [];
  for (const e of elements) {
    const t = e.tags ?? {};
    if (!t.name) continue;
    if (signalOnly && !t["contact:whatsapp"] && !Object.keys(t).some((k) => k.startsWith("diet:"))) continue;
    const lat = e.lat ?? e.center?.lat, lng = e.lon ?? e.center?.lon;
    const address = [t["addr:housenumber"], t["addr:street"], t["addr:suburb"]].filter(Boolean).join(" ") || undefined;
    items.push({
      name: t.name, country: country.toUpperCase(), city, citySlug: slugify(city), address, lat, lng,
      whatsapp: normalizeWhatsapp(t["contact:whatsapp"]) ?? (usePhone ? normalizeWhatsapp(t.phone ?? t["contact:phone"]) : null),
      cuisines: (t.cuisine ?? "").split(";").map((c) => c.trim().replace(/_/g, " ")).filter(Boolean),
      diets: dietsFrom(t), menu: [], status: "unclaimed", source: "osm", sourceId: `${e.type}/${e.id}`,
      plan: "free", leadCount: 0, createdAt: new Date().toISOString(),
    });
  }
  console.log(`${elements.length} OSM elements, ${items.length} named, ${items.filter((i) => i.whatsapp).length} with a number`);
  console.log(await getStore().upsertImported(items));
}
main().catch((e) => { console.error(e); process.exit(1); });
