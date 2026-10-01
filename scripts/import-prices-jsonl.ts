/**
 * Load staged prices (written by import-openprices.ts --out) into the current database. Idempotent. Dry run unless --apply.
 *   npx tsx scripts/import-prices-jsonl.ts data/prices.jsonl [--apply] [--max N]
 */
import { readFileSync } from "node:fs";
import { getStore, isDemo } from "../lib/store";
import type { PricePoint } from "../lib/types";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const apply = args.includes("--apply");
const max = args.includes("--max") ? Number(args[args.indexOf("--max") + 1]) : Infinity;
if (!file) { console.error("usage: import-prices-jsonl <file.jsonl> [--apply] [--max N]"); process.exit(1); }
if (apply && isDemo()) { console.error("Set DATABASE_URL (Supabase) or FIREBASE_SERVICE_ACCOUNT first."); process.exit(1); }

(async () => {
  const rows = readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Omit<PricePoint, "id">)
    .filter((p) => p.productName && p.storeName && p.city && /^[A-Z]{2}$/.test(p.country) && /^[A-Z]{3}$/.test(p.currency) && p.price > 0).slice(0, max);
  const cities = new Map<string, number>(); rows.forEach((p) => cities.set(`${p.city}, ${p.country} (${p.currency})`, (cities.get(`${p.city}, ${p.country} (${p.currency})`) ?? 0) + 1));
  console.log(`${rows.length} prices in ${cities.size} cities. Top:`, JSON.stringify([...cities.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)));
  if (!apply) return console.log("DRY RUN: nothing written. Add --apply.");
  console.log(await getStore().upsertPrices(rows));
})().catch((e) => { console.error(e); process.exit(1); });
