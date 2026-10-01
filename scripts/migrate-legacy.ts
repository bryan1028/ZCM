/**
 * One-time, ADDITIVE migration of the old site's `restaurants` docs to the new schema.
 * Old fields (location, diet, menuItems, active, ...) are left untouched so the legacy app still works.
 * Idempotent. Dry-run unless --apply is passed. Writes a JSON backup first when applying.
 *
 *   npx tsx scripts/migrate-legacy.ts                       # dry run, prints a summary
 *   npx tsx scripts/migrate-legacy.ts --apply --backup /path/backup.json
 */
import { writeFileSync } from "node:fs";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { geohashForLocation } from "geofire-common";
import { parseServiceAccount } from "../lib/store";
import { DIETS, type Diet, type MenuItem } from "../lib/types";
import { normalizeWhatsapp, slugify } from "../lib/util";

const apply = process.argv.includes("--apply");
const backupPath = process.argv.includes("--backup") ? process.argv[process.argv.indexOf("--backup") + 1] : undefined;
if (!process.env.FIREBASE_SERVICE_ACCOUNT) { console.error("Set FIREBASE_SERVICE_ACCOUNT."); process.exit(1); }
if (apply && !backupPath) { console.error("--apply requires --backup <file>."); process.exit(1); }

const CURRENCY: Record<string, string> = { KE: "KES", GB: "GBP", US: "USD", NG: "NGN", ZA: "ZAR", UG: "UGX", TZ: "TZS" };
const toDiets = (xs: unknown): Diet[] =>
  (Array.isArray(xs) ? xs : []).map((d) => String(d).toLowerCase().replace(/[- ]/g, "_")).filter((d): d is Diet => DIETS.some((x) => x.id === d));

async function main() {
  initializeApp({ credential: cert(parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT!) as never) });
  const db = getFirestore();
  const snap = await db.collection("restaurants").get();
  if (apply) writeFileSync(backupPath!, JSON.stringify(snap.docs.map((d) => ({ id: d.id, data: d.data() })), null, 1));

  const stats = { total: snap.size, alreadyMigrated: 0, active: 0, pending: 0, unclaimed: 0, withNumber: 0, withMenu: 0, skipped: 0 };
  let batch = db.batch(), n = 0;
  for (const d of snap.docs) {
    const x = d.data();
    if (x.migratedAt) { stats.alreadyMigrated++; continue; }
    const [cityRaw, ccRaw] = String(x.location ?? "").split(",").map((s) => s.trim());
    const country = (ccRaw ?? "").toUpperCase();
    if (!cityRaw || !/^[A-Z]{2}$/.test(country)) { stats.skipped++; console.warn("skip (unparseable location):", d.id, x.location); continue; }

    const status = x.active ? "active" : x.submittedBy ? "pending" : "unclaimed";
    const whatsapp = normalizeWhatsapp(x.whatsapp);
    const currency = CURRENCY[country] ?? "USD";
    const menu: MenuItem[] = (Array.isArray(x.menuItems) ? x.menuItems : []).map((m: Record<string, unknown>, i: number) => ({
      id: String(m.id ?? `m${i + 1}`), name: String(m.name ?? "Item"), description: m.desc ? String(m.desc) : undefined,
      price: typeof m.price === "number" ? m.price : undefined, currency, diets: toDiets(m.diet), allergens: Array.isArray(m.allergens) ? m.allergens.map(String) : [],
    }));
    const diets = [...new Set([...toDiets(x.diet), ...menu.flatMap((m) => m.diets)])];
    const patch: Record<string, unknown> = {
      country, city: cityRaw, citySlug: slugify(cityRaw), whatsapp, cuisines: x.cuisine ? [String(x.cuisine)] : [], diets, menu, status,
      source: x.submittedBy ? "owner" : "import", leadCount: Number(x.leads ?? 0), migratedAt: new Date().toISOString(),
    };
    if (typeof x.lat === "number" && typeof x.lng === "number") patch.geohash = geohashForLocation([x.lat, x.lng]);

    stats[status as "active" | "pending" | "unclaimed"]++;
    if (whatsapp) stats.withNumber++;
    if (menu.length) stats.withMenu++;
    if (apply) { batch.set(d.ref, patch, { merge: true }); if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); } }
  }
  if (apply && n % 400) await batch.commit();
  console.log(apply ? "APPLIED" : "DRY RUN (nothing written)", stats);
}
main().catch((e) => { console.error(e); process.exit(1); });
