import { readFileSync, appendFileSync, existsSync } from "node:fs";
import path from "node:path";
import { geohashForLocation } from "geofire-common";
import { FieldValue, type DocumentSnapshot, type Query } from "firebase-admin/firestore";
import { adminDb, parseServiceAccount } from "./firebase-admin";
import { tokenize } from "./prices";
import { DIETS } from "./types";
import type { Claim, Deal, Diet, Lead, MenuItem, PlaceRequest, PricePoint, Profile, Restaurant } from "./types";

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

  // Accounts
  getProfile(uid: string): Promise<Profile | null>;
  saveProfile(uid: string, patch: Partial<Omit<Profile, "uid" | "createdAt">> & { username?: string; email?: string }): Promise<void>;
  /** Reserve a username for a user. False if someone else has it. */
  claimUsername(username: string, uid: string, email: string): Promise<boolean>;
  releaseUsername(username: string, uid: string): Promise<void>;
  findEmailByUsername(username: string): Promise<string | null>;
  listProfiles(limit: number): Promise<Profile[]>;

  // Community requests ("please add this place")
  /** Create the request, or add the user's support if it already exists. */
  upsertRequest(id: string, base: Omit<PlaceRequest, "id" | "supportCount" | "status" | "createdAt">, user: { uid: string; handle: string }): Promise<{ created: boolean; supported: boolean }>;
  supportRequest(id: string, user: { uid: string; handle: string }): Promise<"supported" | "already" | "missing">;
  listRequests(o: { kind?: PlaceRequest["kind"]; country?: string; citySlug?: string; includeAll?: boolean; limit?: number }): Promise<PlaceRequest[]>;
  setRequestStatus(id: string, status: PlaceRequest["status"]): Promise<void>;
  requestsBy(uid: string): Promise<PlaceRequest[]>;
  supportedBy(uid: string, ids: string[]): Promise<Set<string>>;
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

  const needsDb = async (): Promise<never> => { throw new Error("Accounts and requests need Firestore. Set FIREBASE_SERVICE_ACCOUNT."); };

  return {
    getProfile: needsDb, saveProfile: needsDb, claimUsername: needsDb, releaseUsername: needsDb, findEmailByUsername: needsDb,
    upsertRequest: needsDb, supportRequest: needsDb, setRequestStatus: needsDb,
    async listProfiles() { return []; },
    async listRequests() { return []; },
    async requestsBy() { return []; },
    async supportedBy() { return new Set<string>(); },
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
  const db = adminDb();
  const col = db.collection("restaurants");
  const toR = (d: DocumentSnapshot): Restaurant => ({ ...(d.data() as Omit<Restaurant, "id">), id: d.id });

  const prices = db.collection("prices");
  const deals = db.collection("deals_find");
  const withId = <T,>(d: DocumentSnapshot) => ({ ...(d.data() as object), id: d.id }) as T;

  const profiles = db.collection("profiles");
  const usernames = db.collection("usernames");
  const requests = db.collection("requests");
  const iso = (v: unknown): string => (v && typeof (v as { toDate?: unknown }).toDate === "function" ? (v as { toDate(): Date }).toDate().toISOString() : typeof v === "string" ? v : new Date(0).toISOString());
  const toProfile = (d: DocumentSnapshot): Profile => {
    const x = d.data() as Record<string, unknown>;
    const [legacyCity, legacyCc] = String(x.location ?? "").split(",").map((t) => t.trim());
    const list = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
    return {
      uid: d.id, username: String(x.username ?? "").toLowerCase(), email: String(x.email ?? ""),
      diets: list(x.diets ?? x.diet).map((t) => t.toLowerCase().replace(/[- ]/g, "_")).filter((t): t is Diet => DIETS.some((y) => y.id === t)),
      allergies: list(x.allergies), city: (x.city as string) || legacyCity || undefined, country: ((x.country as string) || legacyCc || "").toUpperCase() || undefined,
      optIn: x.optIn === true, createdAt: iso(x.createdAt), updatedAt: iso(x.updatedAt),
    };
  };
  const reqFrom = (d: DocumentSnapshot) => ({ ...(d.data() as object), id: d.id }) as PlaceRequest;

  return {
    async getProfile(uid) {
      const d = await profiles.doc(uid).get();
      return d.exists ? toProfile(d) : null;
    },
    async saveProfile(uid, patch) {
      const now = new Date().toISOString();
      const ref = profiles.doc(uid);
      const snap = await ref.get();
      await ref.set({ ...patch, updatedAt: now, ...(snap.exists ? {} : { createdAt: now }) }, { merge: true });
    },
    async claimUsername(username, uid, email) {
      const ref = usernames.doc(username);
      return db.runTransaction(async (tx: FirebaseFirestore.Transaction) => {
        const d = await tx.get(ref);
        if (d.exists && d.data()?.uid !== uid) return false;
        tx.set(ref, { uid, email });
        return true;
      });
    },
    async releaseUsername(username, uid) {
      const ref = usernames.doc(username);
      const d = await ref.get();
      if (d.exists && d.data()?.uid === uid) await ref.delete();
    },
    async findEmailByUsername(username) {
      const d = await usernames.doc(username).get();
      return d.exists ? String(d.data()?.email ?? "") || null : null;
    },
    async listProfiles(limit) {
      return (await profiles.limit(limit).get()).docs.map(toProfile);
    },
    async upsertRequest(id, base, user) {
      const ref = requests.doc(id);
      const sup = ref.collection("supporters").doc(user.uid);
      return db.runTransaction(async (tx: FirebaseFirestore.Transaction) => {
        const [d, s] = await Promise.all([tx.get(ref), tx.get(sup)]);
        const now = new Date().toISOString();
        if (!d.exists) {
          tx.set(ref, { ...base, supportCount: 1, status: "open", createdAt: now });
          tx.set(sup, { handle: user.handle, at: now });
          return { created: true, supported: true };
        }
        if (s.exists) return { created: false, supported: false };
        tx.update(ref, { supportCount: FieldValue.increment(1) });
        tx.set(sup, { handle: user.handle, at: now });
        return { created: false, supported: true };
      });
    },
    async supportRequest(id, user) {
      const ref = requests.doc(id);
      const sup = ref.collection("supporters").doc(user.uid);
      return db.runTransaction(async (tx: FirebaseFirestore.Transaction) => {
        const [d, s] = await Promise.all([tx.get(ref), tx.get(sup)]);
        if (!d.exists || d.data()?.status === "hidden") return "missing" as const;
        if (s.exists) return "already" as const;
        tx.update(ref, { supportCount: FieldValue.increment(1) });
        tx.set(sup, { handle: user.handle, at: new Date().toISOString() });
        return "supported" as const;
      });
    },
    async listRequests(o) {
      let q: Query = requests;
      if (!o.includeAll) q = q.where("status", "==", "open");
      if (o.kind) q = q.where("kind", "==", o.kind);
      if (o.country) q = q.where("country", "==", o.country);
      if (o.citySlug) q = q.where("citySlug", "==", o.citySlug);
      const snap = await q.limit(500).get();
      return snap.docs.map(reqFrom).sort((a, b) => b.supportCount - a.supportCount || b.createdAt.localeCompare(a.createdAt)).slice(0, o.limit ?? 100);
    },
    async setRequestStatus(id, status) {
      await requests.doc(id).update({ status });
    },
    async requestsBy(uid) {
      const snap = await requests.where("createdBy.uid", "==", uid).limit(100).get();
      return snap.docs.map(reqFrom);
    },
    async supportedBy(uid, ids) {
      if (!ids.length) return new Set<string>();
      const refs = ids.map((id) => requests.doc(id).collection("supporters").doc(uid));
      const docs = await db.getAll(...refs);
      return new Set(ids.filter((_, i) => docs[i].exists));
    },
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

export { parseServiceAccount };

const g = globalThis as unknown as { __zistStore?: Store };
export function getStore(): Store {
  return (g.__zistStore ??= process.env.FIREBASE_SERVICE_ACCOUNT ? createFirestoreStore() : createDemoStore());
}

export const isDemo = () => !process.env.FIREBASE_SERVICE_ACCOUNT;
