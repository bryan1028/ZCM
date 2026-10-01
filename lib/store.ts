import { readFileSync, appendFileSync, existsSync } from "node:fs";
import path from "node:path";
import { geohashForLocation } from "geofire-common";
import { cert, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { FieldValue, getFirestore, type DocumentSnapshot, type Query } from "firebase-admin/firestore";
import { tokenize } from "./prices";
import type { Claim, Deal, Diet, Lead, MenuItem, PricePoint, Restaurant } from "./types";

export interface SearchOptions {
  country?: string;
  citySlug?: string;
  diet?: Diet[];
  q?: string;
  limit?: number;
}

export interface CitySummary {
  country: string;
  city: string;
  citySlug: string;
  count: number;
}

export interface Store {
  searchRestaurants(opts: SearchOptions): Promise<Restaurant[]>;
  getRestaurant(id: string): Promise<Restaurant | null>;
  listCities(): Promise<CitySummary[]>;
  /** Insert or update by (source, sourceId). Never overwrites owner-edited menus. */
  upsertImported(rs: Omit<Restaurant, "id">[]): Promise<{ created: number; skipped: number }>;
  createRestaurant(r: Omit<Restaurant, "id">): Promise<string>;
  setMenu(id: string, menu: MenuItem[]): Promise<void>;
  recordLead(lead: Lead): Promise<void>;
  listLeads(limit: number): Promise<Lead[]>;
  addClaim(claim: Claim): Promise<void>;
  listClaims(limit: number): Promise<Claim[]>;

  // Zist Find
  searchPrices(o: PriceQuery): Promise<PricePoint[]>;
  addPrice(p: Omit<PricePoint, "id">): Promise<string>;
  /** Bulk insert, de-duplicated on (source, sourceId). */
  upsertPrices(ps: Omit<PricePoint, "id">[]): Promise<{ created: number; skipped: number }>;
  listPrices(limit: number): Promise<PricePoint[]>;
  setPriceStatus(id: string, status: PricePoint["status"]): Promise<void>;
  addDeal(d: Omit<Deal, "id">): Promise<void>;
  listDeals(o: { country?: string; citySlug?: string; includeAll?: boolean; limit?: number }): Promise<Deal[]>;
}

export interface PriceQuery {
  q?: string;
  country?: string;
  citySlug?: string;
  productKey?: string;
  /** include flagged/hidden points (admin only) */
  includeAll?: boolean;
  limit?: number;
}

const PUBLIC = new Set(["active", "unclaimed"]);

function priceMatches(p: PricePoint, o: PriceQuery): boolean {
  if (!o.includeAll && p.status !== "ok") return false;
  if (o.country && p.country !== o.country) return false;
  if (o.citySlug && p.citySlug !== o.citySlug) return false;
  if (o.productKey && p.productKey !== o.productKey) return false;
  if (o.q) {
    const qt = tokenize(o.q);
    if (qt.length && !qt.every((t) => p.tokens.some((x) => x.startsWith(t)))) return false;
  }
  return true;
}

function dealLive(d: Deal, o: { country?: string; citySlug?: string; includeAll?: boolean }): boolean {
  if (!o.includeAll && (d.status !== "active" || d.validUntil < new Date().toISOString().slice(0, 10))) return false;
  return (!o.country || d.country === o.country) && (!o.citySlug || d.citySlug === o.citySlug);
}

function matches(r: Restaurant, o: SearchOptions): boolean {
  if (!PUBLIC.has(r.status)) return false;
  if (o.country && r.country !== o.country) return false;
  if (o.citySlug && r.citySlug !== o.citySlug) return false;
  if (o.diet?.length && !o.diet.every((d) => r.diets.includes(d))) return false;
  if (o.q) {
    const q = o.q.toLowerCase();
    const hay = [r.name, ...r.cuisines, ...r.menu.map((m) => m.name)].join(" ").toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

/** Verified restaurants first, then those with menus, then alphabetical. */
function rank(a: Restaurant, b: Restaurant): number {
  const score = (r: Restaurant) => (r.status === "active" ? 2 : 0) + (r.menu.length ? 1 : 0);
  return score(b) - score(a) || a.name.localeCompare(b.name);
}

function summarize(rs: Restaurant[]): CitySummary[] {
  const map = new Map<string, CitySummary>();
  for (const r of rs) {
    if (!PUBLIC.has(r.status)) continue;
    const key = `${r.country}/${r.citySlug}`;
    const cur = map.get(key);
    if (cur) cur.count++;
    else map.set(key, { country: r.country, city: r.city, citySlug: r.citySlug, count: 1 });
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

// ───────────────────────── Demo (no credentials) ─────────────────────────

const DATA_DIR = path.join(process.cwd(), "data");

function createDemoStore(): Store {
  const restaurants: Restaurant[] = JSON.parse(readFileSync(path.join(DATA_DIR, "demo.json"), "utf8"));
  const leadsFile = path.join(DATA_DIR, "leads.jsonl");
  const claimsFile = path.join(DATA_DIR, "claims.jsonl");
  const readLines = <T,>(f: string): T[] =>
    existsSync(f) ? readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];

  const prices: PricePoint[] = JSON.parse(readFileSync(path.join(DATA_DIR, "demo-prices.json"), "utf8"));
  const deals: Deal[] = JSON.parse(readFileSync(path.join(DATA_DIR, "demo-deals.json"), "utf8"));
  const pricesFile = path.join(DATA_DIR, "prices.jsonl");
  const dealsFile = path.join(DATA_DIR, "deals.jsonl");
  prices.push(...readLines<PricePoint>(pricesFile));
  deals.push(...readLines<Deal>(dealsFile));

  return {
    async searchPrices(o) {
      return prices.filter((p) => priceMatches(p, o)).slice(0, o.limit ?? 500);
    },
    async addPrice(p) {
      const full = { ...p, id: `local-p${prices.length + 1}` };
      prices.push(full);
      appendFileSync(pricesFile, JSON.stringify(full) + "\n");
      return full.id;
    },
    async upsertPrices() {
      throw new Error("Imports need Firestore. Set FIREBASE_SERVICE_ACCOUNT.");
    },
    async listPrices(limit) {
      return [...prices].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
    },
    async setPriceStatus(id, status) {
      const p = prices.find((x) => x.id === id);
      if (p) p.status = status;
    },
    async addDeal(d) {
      const full = { ...d, id: `local-d${deals.length + 1}` };
      deals.push(full);
      appendFileSync(dealsFile, JSON.stringify(full) + "\n");
    },
    async listDeals(o) {
      return deals.filter((d) => dealLive(d, o)).sort((a, b) => a.validUntil.localeCompare(b.validUntil)).slice(0, o.limit ?? 100);
    },
    async searchRestaurants(o) {
      return restaurants.filter((r) => matches(r, o)).sort(rank).slice(0, o.limit ?? 60);
    },
    async getRestaurant(id) {
      return restaurants.find((r) => r.id === id) ?? null;
    },
    async listCities() {
      return summarize(restaurants);
    },
    async upsertImported() {
      throw new Error("Imports need Firestore. Set FIREBASE_SERVICE_ACCOUNT.");
    },
    async createRestaurant(r) {
      const id = `local-${restaurants.length + 1}`;
      restaurants.push({ ...r, id });
      return id;
    },
    async setMenu(id, menu) {
      const r = restaurants.find((x) => x.id === id);
      if (r) { r.menu = menu; r.diets = [...new Set(menu.flatMap((m) => m.diets))]; }
    },
    async recordLead(lead) {
      const r = restaurants.find((x) => x.id === lead.restaurantId);
      if (r) r.leadCount++;
      appendFileSync(leadsFile, JSON.stringify(lead) + "\n");
    },
    async listLeads(limit) {
      return readLines<Lead>(leadsFile).reverse().slice(0, limit);
    },
    async addClaim(c) {
      appendFileSync(claimsFile, JSON.stringify(c) + "\n");
    },
    async listClaims(limit) {
      return readLines<Claim>(claimsFile).reverse().slice(0, limit);
    },
  };
}

// ───────────────────────── Firestore ─────────────────────────

function createFirestoreStore(): Store {
  if (!getApps().length) {
    initializeApp({ credential: cert(parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT as string) as ServiceAccount) });
  }
  const db = getFirestore();
  const col = db.collection("restaurants");
  const toR = (d: DocumentSnapshot): Restaurant => ({ ...(d.data() as Omit<Restaurant, "id">), id: d.id });

  const prices = db.collection("prices");
  const deals = db.collection("deals_find");
  const withId = <T,>(d: DocumentSnapshot) => ({ ...(d.data() as object), id: d.id }) as T;

  return {
    async searchPrices(o) {
      let q: Query = prices;
      if (!o.includeAll) q = q.where("status", "==", "ok");
      if (o.country) q = q.where("country", "==", o.country);
      if (o.citySlug) q = q.where("citySlug", "==", o.citySlug);
      if (o.productKey) q = q.where("productKey", "==", o.productKey);
      const first = o.q ? tokenize(o.q)[0] : undefined;
      if (first) q = q.where("tokens", "array-contains", first);
      const snap = await q.limit(1000).get();
      return snap.docs.map((d) => withId<PricePoint>(d)).filter((p) => priceMatches(p, o)).slice(0, o.limit ?? 500);
    },
    async addPrice(p) {
      return (await prices.add(p)).id;
    },
    async upsertPrices(ps) {
      let created = 0, skipped = 0;
      for (let i = 0; i < ps.length; i += 400) {
        const chunk = ps.slice(i, i + 400);
        const ids = chunk.map((p) => `${p.source}-${p.sourceId}`.replace(/\//g, "_"));
        const existing = await db.getAll(...ids.map((id: string) => prices.doc(id)));
        const batch = db.batch();
        chunk.forEach((p, j) => { if (existing[j].exists) skipped++; else { batch.set(prices.doc(ids[j]), p); created++; } });
        await batch.commit();
      }
      return { created, skipped };
    },
    async listPrices(limit) {
      const snap = await prices.orderBy("createdAt", "desc").limit(limit).get();
      return snap.docs.map((d) => withId<PricePoint>(d));
    },
    async setPriceStatus(id, status) {
      await prices.doc(id).update({ status });
    },
    async addDeal(d) {
      await deals.add(d);
    },
    async listDeals(o) {
      let q: Query = deals;
      if (!o.includeAll) q = q.where("status", "==", "active");
      if (o.country) q = q.where("country", "==", o.country);
      if (o.citySlug) q = q.where("citySlug", "==", o.citySlug);
      const snap = await q.limit(300).get();
      return snap.docs.map((d) => withId<Deal>(d)).filter((d) => dealLive(d, o)).sort((a, b) => a.validUntil.localeCompare(b.validUntil)).slice(0, o.limit ?? 100);
    },
    async searchRestaurants(o) {
      const limit = o.limit ?? 60;
      const out: Restaurant[] = [];
      // Two passes so verified restaurants are never crowded out by thousands of seeded ones.
      for (const status of ["active", "unclaimed"] as const) {
        let q: Query = col.where("status", "==", status);
        if (o.country) q = q.where("country", "==", o.country);
        if (o.citySlug) q = q.where("citySlug", "==", o.citySlug);
        if (o.diet?.length) q = q.where("diets", "array-contains", o.diet[0]);
        const snap = await q.limit(400).get();
        out.push(...snap.docs.map(toR).filter((r) => matches(r, o)));
        if (out.length >= limit) break;
      }
      return out.sort(rank).slice(0, limit);
    },
    async getRestaurant(id) {
      const d = await col.doc(id).get();
      return d.exists ? toR(d) : null;
    },
    async listCities() {
      // Cheap enough until ~100k docs; replace with a maintained `cities` collection after that.
      const snap = await col.where("status", "in", ["active", "unclaimed"]).select("country", "city", "citySlug", "status").get();
      return summarize(snap.docs.map((d: DocumentSnapshot) => ({ ...d.data(), menu: [] }) as unknown as Restaurant)).slice(0, 200);
    },
    async upsertImported(rs) {
      let created = 0;
      let skipped = 0;
      for (let i = 0; i < rs.length; i += 400) {
        const batch = db.batch();
        const chunk = rs.slice(i, i + 400);
        const ids = chunk.map((r) => `${r.source}-${r.sourceId}`.replace(/\//g, "_"));
        const existing = await db.getAll(...ids.map((id: string) => col.doc(id)));
        chunk.forEach((r, j) => {
          if (existing[j].exists) { skipped++; return; }
          const withHash = r.lat != null && r.lng != null ? { ...r, geohash: geohashForLocation([r.lat, r.lng]) } : r;
          batch.set(col.doc(ids[j]), withHash);
          created++;
        });
        await batch.commit();
      }
      return { created, skipped };
    },
    async createRestaurant(r) {
      const ref = await col.add(r);
      return ref.id;
    },
    async setMenu(id, menu) {
      await col.doc(id).update({ menu, diets: [...new Set(menu.flatMap((m) => m.diets))] });
    },
    async recordLead(lead) {
      const batch = db.batch();
      batch.set(db.collection("leads").doc(), lead);
      batch.update(col.doc(lead.restaurantId), { leadCount: FieldValue.increment(1) });
      await batch.commit();
    },
    async listLeads(limit) {
      const snap = await db.collection("leads").orderBy("createdAt", "desc").limit(limit).get();
      return snap.docs.map((d: DocumentSnapshot) => ({ ...(d.data() as Lead), id: d.id }));
    },
    async addClaim(c) {
      await db.collection("claims").add(c);
    },
    async listClaims(limit) {
      const snap = await db.collection("claims").orderBy("createdAt", "desc").limit(limit).get();
      return snap.docs.map((d: DocumentSnapshot) => ({ ...(d.data() as Claim), id: d.id }));
    },
  };
}

/** Accepts the service-account JSON either as raw JSON or base64-encoded (some env-var forms reject "{" and quotes). */
export function parseServiceAccount(raw: string): object {
  const v = raw.trim();
  return JSON.parse(v.startsWith("{") ? v : Buffer.from(v, "base64").toString("utf8"));
}

const g = globalThis as unknown as { __zistStore?: Store };
export function getStore(): Store {
  return (g.__zistStore ??= process.env.FIREBASE_SERVICE_ACCOUNT ? createFirestoreStore() : createDemoStore());
}

export const isDemo = () => !process.env.FIREBASE_SERVICE_ACCOUNT;
