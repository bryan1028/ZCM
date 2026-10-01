/**
 * Load extracted world restaurants (from scripts/overture_extract.py) into the current database.
 * Idempotent (de-duplicated on Overture id). Dry run unless --apply.
 *
 *   npx tsx scripts/import-places-jsonl.ts data/overture-places.jsonl                  # preview
 *   DATABASE_URL=... npx tsx scripts/import-places-jsonl.ts data/overture-places.jsonl --apply [--max 5000]
 */
import { readFileSync } from "node:fs";
import { placeToRestaurant, type PlaceRow } from "../lib/places";
import { getStore, isDemo } from "../lib/store";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const apply = args.includes("--apply");
const max = args.includes("--max") ? Number(args[args.indexOf("--max") + 1]) : Infinity;
if (!file) { console.error("usage: import-places-jsonl <file.jsonl> [--apply] [--max N]"); process.exit(1); }
if (apply && isDemo()) { console.error("Set DATABASE_URL (Supabase) or FIREBASE_SERVICE_ACCOUNT first."); process.exit(1); }

(async () => {
  const rows = readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as PlaceRow);
  const mapped = rows.map(placeToRestaurant).filter((r): r is NonNullable<typeof r> => r !== null).slice(0, max);
  const by = new Map<string, number>(); mapped.forEach((r) => by.set(`${r.city}, ${r.country}`, (by.get(`${r.city}, ${r.country}`) ?? 0) + 1));
  console.log(`${rows.length} rows -> ${mapped.length} usable (${rows.length - mapped.length} dropped). With WhatsApp: ${mapped.filter((r) => r.whatsapp).length}, phone: ${mapped.filter((r) => r.phone).length}, website: ${mapped.filter((r) => r.website).length}, diet-tagged: ${mapped.filter((r) => r.diets.length).length}`);
  console.log(`${by.size} cities:`, JSON.stringify([...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)));
  if (!apply) return console.log("DRY RUN: nothing written. Add --apply.");
  console.log(await getStore().upsertImported(mapped));
  await getStore().setCities(await getStore().computeCities());
})().catch((e) => { console.error(e); process.exit(1); });
