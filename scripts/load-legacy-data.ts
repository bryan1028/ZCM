/**
 * Load the original curated Zist data (your two import tools' ENTRIES arrays) into the current database.
 * Idempotent: re-running skips what exists. Dry run unless --apply.
 *
 *   npx tsx scripts/load-legacy-data.ts <zistimport.html> <zistfindimport.html>            # preview
 *   DATABASE_URL=... npx tsx scripts/load-legacy-data.ts <...> <...> --apply
 */
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { productKey, tokenize } from "../lib/prices";
import { getStore, isDemo } from "../lib/store";
import { DIETS, type Diet, type MenuItem, type PricePoint, type Restaurant } from "../lib/types";
import { normalizeWhatsapp, slugify } from "../lib/util";

const [restaurantsHtml, itemsHtml] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const apply = process.argv.includes("--apply");
if (!restaurantsHtml || !itemsHtml) { console.error("usage: load-legacy-data <zistimport.html> <zistfindimport.html> [--apply]"); process.exit(1); }
if (apply && isDemo()) { console.error("Set DATABASE_URL (Supabase) or FIREBASE_SERVICE_ACCOUNT first."); process.exit(1); }

/** Pull the `const ENTRIES = ...` literal out of one of the old import pages and evaluate just that literal. */
function entries(file: string): any[] {
  const html = readFileSync(file, "utf8");
  const start = html.indexOf("const ENTRIES = ");
  const end = html.indexOf("const firebaseConfig", start);
  if (start < 0 || end < 0) throw new Error(`no ENTRIES in ${file}`);
  return vm.runInNewContext(html.slice(start, end).replace("const ENTRIES =", "ENTRIES =") + "; ENTRIES", {}, { timeout: 2000 });
}
const diets = (xs: unknown): Diet[] => (Array.isArray(xs) ? xs : []).map((d) => String(d).toLowerCase().replace(/[- ]/g, "_")).filter((d): d is Diet => DIETS.some((x) => x.id === d));

(async () => {
  // ── restaurants
  const rs: (Omit<Restaurant, "id"> & { id: string })[] = entries(restaurantsHtml).map((e) => {
    const [cityRaw, cc] = String(e.location).split(",").map((s: string) => s.trim());
    const menu: MenuItem[] = (e.menuItems ?? []).map((m: any, i: number): MenuItem => ({
      id: `m${i + 1}`, name: m.name, description: m.desc || undefined, price: Number(m.price) || undefined, currency: "KES", diets: diets(m.diet), allergens: (m.allergens ?? []).map(String),
    }));
    return {
      id: slugify(`${e.name}-${e.location}`), name: e.name, country: (cc ?? "KE").toUpperCase(), city: cityRaw, citySlug: slugify(cityRaw), whatsapp: normalizeWhatsapp(e.whatsapp),
      cuisines: e.cuisine ? [String(e.cuisine)] : [], diets: [...new Set([...diets(e.diet), ...menu.flatMap((m) => m.diets)])], menu,
      status: menu.length ? "active" : "unclaimed", source: "import", sourceId: slugify(`${e.name}-${e.location}`), plan: menu.length ? "trial" : "free", leadCount: 0, rank: menu.length ? 1 : 0.4, createdAt: new Date().toISOString(),
    };
  });
  console.log(`restaurants: ${rs.length} (active with menus: ${rs.filter((r) => r.status === "active").length}, with a WhatsApp number: ${rs.filter((r) => r.whatsapp).length})`);

  // ── grocery prices (the old Zist Find catalogue)
  const STORES: Record<string, string> = { carrefour: "Carrefour", naivas: "Naivas", quickmart: "Quickmart", cleanshelf: "Clean Shelf", eastmatt: "Eastmatt", tuskys: "Tuskys", chandarana: "Chandarana Foodplus", game: "Game Stores" };
  const ps: Omit<PricePoint, "id">[] = [];
  for (const it of entries(itemsHtml)) {
    for (const [sid, sp] of Object.entries<any>(it.stores ?? {})) {
      const price = Number(sp?.price);
      if (!Number.isFinite(price) || price <= 0) continue;
      ps.push({
        productKey: productKey(it.name, undefined, it.unit), productName: it.name, brand: it.brand || undefined, size: it.unit || undefined, storeName: STORES[sid] ?? sid,
        country: "KE", city: "Nairobi", citySlug: "nairobi", price, currency: "KES", tokens: tokenize(it.name, it.brand), source: "admin", status: "ok",
        observedAt: "2026-08-24T00:00:00.000Z", // "Prices as sourced: 24 Aug 2026" (from the import tool's own note)
        createdAt: new Date().toISOString(), sourceId: `legacy_${slugify(`${it.name}-${it.unit ?? ""}`)}_${sid}`,
      });
    }
  }
  console.log(`prices: ${ps.length} store prices for ${new Set(ps.map((p) => p.productKey)).size} items`);
  if (!apply) return console.log("DRY RUN: nothing written. Add --apply.");
  const store = getStore();
  console.log("restaurants:", await store.upsertImported(rs));
  console.log("prices:", await store.upsertPrices(ps));
})().catch((e) => { console.error(e); process.exit(1); });
