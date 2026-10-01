/**
 * One-time move of the old Zist Find catalogue (`items`: name, brand, unit, storePrices{store:{price}}) into Zind's
 * `prices` (one observed price per item per store). Additive: the old `items` docs are left untouched.
 * Idempotent (de-duplicated on source+sourceId). Dry run unless --apply.
 *
 *   npx tsx scripts/migrate-legacy-items.ts            # preview
 *   npx tsx scripts/migrate-legacy-items.ts --apply
 */
import { adminDb } from "../lib/firebase-admin";
import { productKey, tokenize } from "../lib/prices";
import { getStore } from "../lib/store";
import { slugify } from "../lib/util";
import type { PricePoint } from "../lib/types";

const apply = process.argv.includes("--apply");
if (!process.env.FIREBASE_SERVICE_ACCOUNT) { console.error("Set FIREBASE_SERVICE_ACCOUNT."); process.exit(1); }

// Store ids used by the old Zist Find.
const STORES: Record<string, string> = {
  carrefour: "Carrefour", naivas: "Naivas", quickmart: "Quickmart", cleanshelf: "Clean Shelf",
  eastmatt: "Eastmatt", tuskys: "Tuskys", chandarana: "Chandarana Foodplus", game: "Game Stores",
};
const iso = (v: unknown) => (v && typeof (v as { toDate?: unknown }).toDate === "function" ? (v as { toDate(): Date }).toDate().toISOString() : typeof v === "string" && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : new Date().toISOString());

(async () => {
  const snap = await adminDb().collection("items").get();
  const out: Omit<PricePoint, "id">[] = [];
  let skipped = 0;
  for (const d of snap.docs) {
    const x = d.data() as { name?: string; brand?: string; unit?: string; storePrices?: Record<string, { price?: number; available?: boolean }>; updatedAt?: unknown };
    if (!x.name) { skipped++; continue; }
    for (const [sid, sp] of Object.entries(x.storePrices ?? {})) {
      const price = Number(sp?.price);
      if (!Number.isFinite(price) || price <= 0 || sp?.available === false) continue;
      const storeName = STORES[sid] ?? sid;
      out.push({
        productKey: productKey(x.name, undefined, x.unit), productName: x.name, brand: x.brand || undefined, size: x.unit || undefined,
        storeName, country: "KE", city: "Nairobi", citySlug: slugify("Nairobi"), price, currency: "KES",
        tokens: tokenize(x.name, x.brand), source: "admin", status: "ok", observedAt: iso(x.updatedAt), createdAt: new Date().toISOString(),
        sourceId: `legacy_${d.id}_${sid}`,
      });
    }
  }
  const perStore = new Map<string, number>(); out.forEach((p) => perStore.set(p.storeName, (perStore.get(p.storeName) ?? 0) + 1));
  console.log(`${snap.size} legacy items -> ${out.length} store prices (${skipped} skipped).`, JSON.stringify([...perStore.entries()]));
  console.log("newest observation:", out.map((p) => p.observedAt).sort().slice(-1)[0]?.slice(0, 10), "| sample:", out[0] && `${out[0].productName} ${out[0].size} @ ${out[0].storeName} KES ${out[0].price}`);
  if (!apply) return console.log("DRY RUN: nothing written. Add --apply.");
  console.log(await getStore().upsertPrices(out));
})().catch((e) => { console.error(e); process.exit(1); });
