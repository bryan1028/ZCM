import type { PriceComparison, PricePoint } from "./types";
import { slugify } from "./util";

const STOP = new Set(["the", "a", "an", "of", "and", "with", "for"]);

export function tokenize(...parts: (string | undefined)[]): string[] {
  const words = parts
    .filter(Boolean)
    .join(" ")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOP.has(w));
  return [...new Set(words)];
}

export function productKey(name: string, brand?: string, size?: string, barcode?: string): string {
  if (barcode && /^\d{8,14}$/.test(barcode)) return `ean-${barcode}`;
  return slugify([brand, name, size].filter(Boolean).join(" "));
}

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * A new report is suspect if it's wildly off the recent prices for the same product in the same city.
 * Needs >= 3 existing points to judge; below that we trust it (and rely on the sanity bounds elsewhere).
 */
export function isOutlier(price: number, existing: number[]): boolean {
  if (existing.length < 3) return false;
  const m = median(existing);
  return price > m * 3 || price < m / 3;
}

const MAX_AGE_DAYS = 120;

/**
 * Turn raw price points into per-product store comparisons:
 *  - ignore flagged/hidden/stale points
 *  - keep each store's most recent price
 *  - only compare within the product's most common currency (never mix KES and USD)
 */
export function comparePrices(points: PricePoint[], now = Date.now(), query?: string, preferCitySlug?: string): PriceComparison[] {
  const cutoff = now - MAX_AGE_DAYS * 864e5;
  // One comparison per product PER CITY: a store's price in one city says nothing about another city.
  const byProduct = new Map<string, PricePoint[]>();
  for (const p of points) {
    if (p.status !== "ok" || Date.parse(p.observedAt) < cutoff) continue;
    const k = `${p.productKey}|${p.citySlug}`;
    (byProduct.get(k) ?? byProduct.set(k, []).get(k)!).push(p);
  }

  const out: PriceComparison[] = [];
  for (const [key, ps] of byProduct) {
    const counts = new Map<string, number>();
    ps.forEach((p) => counts.set(p.currency, (counts.get(p.currency) ?? 0) + 1));
    const currency = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];

    const latest = new Map<string, PricePoint>();
    for (const p of ps.filter((x) => x.currency === currency)) {
      const k = p.storeName.trim().toLowerCase();
      const cur = latest.get(k);
      if (!cur || p.observedAt > cur.observedAt) latest.set(k, p);
    }
    const stores = [...latest.values()].sort((a, b) => a.price - b.price);
    const min = stores[0].price, max = stores[stores.length - 1].price;
    const first = stores[0];
    out.push({
      productKey: key.split("|")[0], productName: first.productName, brand: first.brand, size: first.size, city: first.city, citySlug: first.citySlug, country: first.country, currency,
      stores: stores.map((s) => ({ storeName: s.storeName, price: s.price, observedAt: s.observedAt, source: s.source, isCheapest: s.price === min, by: s.reporterHandle })),
      min, max, savingsPct: stores.length > 1 && max > 0 ? Math.round(((max - min) / max) * 100) : 0,
    });
  }
  // Best match to what was typed first (whole-word in the name beats a stray word), then the user's own city,
  // then products compared across more stores, then the biggest saving.
  // English puts the main noun last ("Whole Milk" is milk; "Milk Chocolate" is chocolate), so a match on the LAST word
  // of the name ranks highest, then the first word, then anywhere. An exact name match gets a bonus.
  const words = (query ?? "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const rel = (c: PriceComparison) => {
    if (!words.length) return 0;
    const nameWords = c.productName.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    const all = [c.brand, c.productName].filter(Boolean).join(" ").toLowerCase().split(/[^a-z0-9]+/);
    const tail = nameWords[nameWords.length - 1], lead = nameWords[0];
    const exact = nameWords.join(" ") === words.join(" ") ? 3 : 0;
    return exact + words.reduce((n, w) => n + (tail === w ? 5 : lead === w ? 2.5 : all.includes(w) ? 2 : 1), 0);
  };
  return out.sort((a, b) =>
    rel(b) - rel(a) || Number(b.citySlug === preferCitySlug) - Number(a.citySlug === preferCitySlug) ||
    b.stores.length - a.stores.length || b.savingsPct - a.savingsPct);
}

export function agoLabel(iso: string, now = Date.now()): string {
  const days = Math.floor((now - Date.parse(iso)) / 864e5);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return `${Math.floor(days / 30)} mo ago`;
}

/** A readable item name: add the brand/size only when the name doesn't already say them, and skip run-on brand strings. */
export function displayName(c: { brand?: string; productName: string; size?: string }, withSize = true): string {
  const name = c.productName.trim();
  const flat = (v: string) => v.toLowerCase().replace(/[^a-z0-9%]/g, "");
  const parts: string[] = [];
  if (c.brand && c.brand.length <= 24 && !flat(name).includes(flat(c.brand))) parts.push(c.brand);
  parts.push(name);
  if (withSize && c.size && !flat(name).includes(flat(c.size))) parts.push(c.size);
  return parts.join(" ");
}
