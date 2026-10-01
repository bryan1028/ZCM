/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from "node:crypto";
import { flattenDishes, queryWords, restaurantTokens, type DishQuery } from "./dishes";
import { tokenize } from "./prices";
import type { CitySummary, PriceQuery, Store, SupportMessage } from "./store";
import type { Claim, Deal, Lead, MenuItem, PlaceRequest, PricePoint, Profile, Restaurant } from "./types";

export type Q = (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number }>;
export interface Sql { query: Q; transaction<T>(fn: (q: Q) => Promise<T>): Promise<T> }

const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : typeof v === "string" ? new Date(v).toISOString() : new Date(0).toISOString());
const num = (v: unknown): number | undefined => (v == null ? undefined : Number(v));
const nn = <T,>(v: T | null | undefined): T | undefined => (v == null ? undefined : v);

/** " word word word " so a word-prefix match is `search_text ILIKE '% prefix%'`. */
const searchText = (words: string[]) => " " + words.join(" ") + " ";

// ───────────── row mappers ─────────────
const toRestaurant = (r: any): Restaurant => ({
  id: r.id, name: r.name, country: r.country, city: r.city, citySlug: r.city_slug, address: nn(r.address), lat: nn(r.lat), lng: nn(r.lng),
  whatsapp: r.whatsapp ?? null, phone: r.phone ?? null, website: nn(r.website), cuisines: r.cuisines ?? [], diets: r.diets ?? [], menu: r.menu ?? [],
  status: r.status, source: r.source, sourceId: nn(r.source_id), plan: r.plan, leadCount: Number(r.lead_count ?? 0), rank: num(r.rank), createdAt: iso(r.created_at),
});
const toPrice = (r: any): PricePoint => ({
  id: r.id, productKey: r.product_key, productName: r.product_name, brand: nn(r.brand), barcode: nn(r.barcode), size: nn(r.size), storeName: r.store_name,
  country: r.country, city: r.city, citySlug: r.city_slug, lat: nn(r.lat), lng: nn(r.lng), price: Number(r.price), currency: r.currency,
  tokens: queryWords(r.search_text), source: r.source, status: r.status, observedAt: iso(r.observed_at), createdAt: iso(r.created_at),
  reporter: nn(r.reporter), reporterHandle: nn(r.reporter_handle), sourceId: nn(r.source_id),
});
const toDeal = (r: any): Deal => ({
  id: r.id, title: r.title, storeName: r.store_name, country: r.country, city: r.city, citySlug: r.city_slug, description: nn(r.description),
  price: num(r.price), currency: nn(r.currency), discountPct: num(r.discount_pct), url: nn(r.url), validUntil: String(r.valid_until).slice(0, 10),
  status: r.status, source: r.source, createdAt: iso(r.created_at),
});
const toLead = (r: any): Lead => ({
  id: r.id, restaurantId: r.restaurant_id, restaurantName: r.restaurant_name, country: r.country, city: r.city, itemId: nn(r.item_id), itemName: nn(r.item_name),
  source: r.source, channel: nn(r.channel), ref: r.ref, visitor: r.visitor, userId: nn(r.user_id), userHandle: nn(r.user_handle), createdAt: iso(r.created_at),
});
const toClaim = (r: any): Claim => ({
  id: r.id, restaurantId: nn(r.restaurant_id), restaurantName: r.restaurant_name, country: r.country, city: r.city, contactName: r.contact_name,
  whatsapp: r.whatsapp, email: nn(r.email), createdAt: iso(r.created_at),
});
const toProfile = (r: any): Profile => ({
  uid: r.uid, username: (r.username ?? "").toLowerCase(), email: r.email ?? "", diets: r.diets ?? [], allergies: r.allergies ?? [],
  city: nn(r.city), country: nn(r.country)?.toUpperCase(), optIn: r.opt_in === true, createdAt: iso(r.created_at), updatedAt: iso(r.updated_at),
});
const toRequest = (r: any): PlaceRequest => ({
  id: r.id, kind: r.kind, name: r.name, country: r.country, city: r.city, citySlug: r.city_slug, note: nn(r.note), whatsapp: r.whatsapp ?? null, website: nn(r.website),
  createdBy: { uid: r.created_by_uid, handle: r.created_by_handle }, supportCount: Number(r.support_count), status: r.status, createdAt: iso(r.created_at),
});

const RESTAURANT_COLS = "id,name,country,city,city_slug,address,lat,lng,whatsapp,phone,website,cuisines,diets,menu,status,source,source_id,plan,lead_count,rank,created_at";
const PRICE_COLS = "id,product_key,product_name,brand,barcode,size,store_name,country,city,city_slug,lat,lng,price,currency,search_text,source,status,observed_at,created_at,reporter,reporter_handle,source_id";

/** Collects `WHERE` fragments with numbered parameters. */
function where() {
  const parts: string[] = [], params: unknown[] = [];
  return {
    add(sql: string, ...vals: unknown[]) { let s = sql; vals.forEach((v) => { params.push(v); s = s.replace("?", `$${params.length}`); }); parts.push(s); },
    get sql() { return parts.length ? " where " + parts.join(" and ") : ""; },
    params,
  };
}
function textFilter(w: ReturnType<typeof where>, words: string[]) {
  for (const word of words) w.add("search_text ilike ?", `% ${word}%`);
}

export function createPgStore(db: Sql): Store {
  const q = db.query;
  return {
    // ───────────── Zood ─────────────
    async searchRestaurants(o) {
      const w = where(); w.add("status in ('active','unclaimed')");
      if (o.country) w.add("country = ?", o.country);
      if (o.citySlug) w.add("city_slug = ?", o.citySlug);
      if (o.diet?.length) w.add("diets @> ?::text[]", o.diet);
      textFilter(w, queryWords(o.q));
      const r = await q(`select ${RESTAURANT_COLS} from restaurants${w.sql} order by (status = 'active') desc, (jsonb_array_length(menu) > 0) desc, rank desc, name limit ${Math.min(o.limit ?? 60, 500)}`, w.params);
      return r.rows.map(toRestaurant);
    },
    async getRestaurant(id) {
      const r = await q(`select ${RESTAURANT_COLS} from restaurants where id = $1`, [id]);
      return r.rows[0] ? toRestaurant(r.rows[0]) : null;
    },
    async searchDishes(o) {
      const w = where(); w.add("status = 'active'"); w.add("jsonb_array_length(menu) > 0");
      if (o.country) w.add("country = ?", o.country);
      if (o.citySlug) w.add("city_slug = ?", o.citySlug);
      const r = await q(`select ${RESTAURANT_COLS} from restaurants${w.sql} limit 500`, w.params);
      return flattenDishes(r.rows.map(toRestaurant), o).slice(0, o.limit ?? 60);
    },
    async listCities() {
      const r = await q(`select country, city, city_slug, count(*)::int as n from restaurants where status in ('active','unclaimed') group by country, city, city_slug order by n desc, city limit 300`);
      return r.rows.map((x: any): CitySummary => ({ country: x.country, city: x.city, citySlug: x.city_slug, count: x.n }));
    },
    async setCities() { /* computed live from an indexed GROUP BY */ },
    async computeCities() { return this.listCities(); },
    async upsertImported(rs) {
      let created = 0;
      for (let i = 0; i < rs.length; i += 500) {
        const rows = rs.slice(i, i + 500).map((r) => ({
          id: (r as { id?: string }).id ?? `${r.source}-${r.sourceId}`.replace(/\//g, "_"), name: r.name, country: r.country, city: r.city, city_slug: r.citySlug, address: r.address ?? null,
          lat: r.lat ?? null, lng: r.lng ?? null, whatsapp: r.whatsapp, phone: r.phone ?? null, website: r.website ?? null, cuisines: r.cuisines, diets: r.diets,
          menu: r.menu, status: r.status, source: r.source, source_id: r.sourceId, plan: r.plan, rank: r.rank ?? 0, search_text: searchText(r.tokens ?? restaurantTokens(r)),
        }));
        const res = await q(
          `insert into restaurants (id,name,country,city,city_slug,address,lat,lng,whatsapp,phone,website,cuisines,diets,menu,status,source,source_id,plan,rank,search_text)
           select id,name,country,city,city_slug,address,lat,lng,whatsapp,phone,website,cuisines,diets,menu,status,source,source_id,plan,rank,search_text
           from jsonb_to_recordset($1::jsonb) as x(id text,name text,country text,city text,city_slug text,address text,lat double precision,lng double precision,whatsapp text,phone text,website text,cuisines text[],diets text[],menu jsonb,status text,source text,source_id text,plan text,rank real,search_text text)
           on conflict (source, source_id) where source_id is not null do nothing`, [JSON.stringify(rows)]);
        created += res.rowCount;
      }
      return { created, skipped: rs.length - created };
    },
    async createRestaurant(r) {
      const id = `own-${randomUUID()}`;
      await q(`insert into restaurants (id,name,country,city,city_slug,address,lat,lng,whatsapp,phone,website,cuisines,diets,menu,status,source,source_id,plan,rank,search_text)
               values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16,$17,$18,$19,$20)`,
        [id, r.name, r.country, r.city, r.citySlug, r.address ?? null, r.lat ?? null, r.lng ?? null, r.whatsapp, r.phone ?? null, r.website ?? null, r.cuisines, r.diets,
          JSON.stringify(r.menu), r.status, r.source, r.sourceId ?? null, r.plan, r.rank ?? 0, searchText(restaurantTokens(r))]);
      return id;
    },
    async setMenu(id, menu: MenuItem[]) {
      const cur = (await q(`select name, cuisines, diets from restaurants where id = $1`, [id])).rows[0];
      if (!cur) return;
      const diets = [...new Set([...(cur.diets ?? []), ...menu.flatMap((m) => m.diets)])];
      await q(`update restaurants set menu = $2::jsonb, diets = $3, search_text = $4 where id = $1`, [id, JSON.stringify(menu), diets, searchText(restaurantTokens({ name: cur.name, cuisines: cur.cuisines ?? [], menu }))]);
    },
    async recordLead(l) {
      await db.transaction(async (tx) => {
        await tx(`insert into leads (id,restaurant_id,restaurant_name,country,city,item_id,item_name,source,channel,ref,visitor,user_id,user_handle,created_at)
                  values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [randomUUID(), l.restaurantId, l.restaurantName, l.country, l.city, l.itemId ?? null, l.itemName ?? null, l.source, l.channel ?? null, l.ref, l.visitor, l.userId ?? null, l.userHandle ?? null, l.createdAt]);
        await tx(`update restaurants set lead_count = lead_count + 1 where id = $1`, [l.restaurantId]);
      });
    },
    async listLeads(limit) {
      return (await q(`select * from leads order by created_at desc limit $1`, [limit])).rows.map(toLead);
    },
    async addClaim(c) {
      await q(`insert into claims (id,restaurant_id,restaurant_name,country,city,contact_name,whatsapp,email,created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [randomUUID(), c.restaurantId ?? null, c.restaurantName, c.country, c.city, c.contactName, c.whatsapp, c.email ?? null, c.createdAt]);
    },
    async listClaims(limit) {
      return (await q(`select * from claims order by created_at desc limit $1`, [limit])).rows.map(toClaim);
    },

    // ───────────── Zind ─────────────
    async searchPrices(o: PriceQuery) {
      const w = where();
      if (!o.includeAll) w.add("status = 'ok'");
      if (o.country) w.add("country = ?", o.country);
      if (o.citySlug) w.add("city_slug = ?", o.citySlug);
      if (o.productKey) w.add("product_key = ?", o.productKey);
      textFilter(w, tokenize(o.q ?? ""));
      const r = await q(`select ${PRICE_COLS} from prices${w.sql} order by observed_at desc limit ${Math.min(o.limit ?? 500, 2000)}`, w.params);
      return r.rows.map(toPrice);
    },
    async addPrice(p) {
      const id = randomUUID();
      await insertPrices([{ ...p, id }]);
      return id;
    },
    async upsertPrices(ps) {
      let created = 0;
      for (let i = 0; i < ps.length; i += 1000) {
        created += await insertPrices(ps.slice(i, i + 1000).map((p) => ({ ...p, id: p.sourceId ? `${p.source}-${p.sourceId}`.replace(/\//g, "_") : randomUUID() })));
      }
      return { created, skipped: ps.length - created };
    },
    async listPrices(limit) {
      return (await q(`select ${PRICE_COLS} from prices order by created_at desc limit $1`, [limit])).rows.map(toPrice);
    },
    async setPriceStatus(id, status) {
      await q(`update prices set status = $2 where id = $1`, [id, status]);
    },
    async addDeal(d) {
      await q(`insert into deals (id,title,store_name,country,city,city_slug,description,price,currency,discount_pct,url,valid_until,status,source,created_at)
               values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [randomUUID(), d.title, d.storeName, d.country, d.city, d.citySlug, d.description ?? null, d.price ?? null, d.currency ?? null, d.discountPct ?? null, d.url ?? null, d.validUntil, d.status, d.source, d.createdAt]);
    },
    async listDeals(o) {
      const w = where();
      if (!o.includeAll) { w.add("status = 'active'"); w.add("valid_until >= current_date"); }
      if (o.country) w.add("country = ?", o.country);
      if (o.citySlug) w.add("city_slug = ?", o.citySlug);
      const r = await q(`select id,title,store_name,country,city,city_slug,description,price,currency,discount_pct,url,to_char(valid_until,'YYYY-MM-DD') as valid_until,status,source,created_at from deals${w.sql} order by valid_until limit ${Math.min(o.limit ?? 100, 300)}`, w.params);
      return r.rows.map(toDeal);
    },

    // ───────────── Accounts ─────────────
    async getProfile(uid) {
      const r = await q(`select * from profiles where uid = $1`, [uid]);
      return r.rows[0] ? toProfile(r.rows[0]) : null;
    },
    async saveProfile(uid, p) {
      await q(`insert into profiles (uid, username, email, diets, allergies, city, country, opt_in)
               values ($1, $2, coalesce($3, ''), coalesce($4::text[], '{}'), coalesce($5::text[], '{}'), $6, $7, coalesce($8::boolean, false))
               on conflict (uid) do update set
                 username = coalesce($2, profiles.username), email = coalesce($3, profiles.email), diets = coalesce($4::text[], profiles.diets),
                 allergies = coalesce($5::text[], profiles.allergies), city = coalesce($6, profiles.city), country = coalesce($7, profiles.country),
                 opt_in = coalesce($8::boolean, profiles.opt_in), updated_at = now()`,
        [uid, p.username ?? null, p.email ?? null, p.diets ?? null, p.allergies ?? null, p.city ?? null, p.country ?? null, p.optIn ?? null]);
    },
    async claimUsername(username, uid, email) {
      const r = await q(`insert into usernames (username, uid, email) values ($1,$2,$3)
                         on conflict (username) do update set email = excluded.email where usernames.uid = excluded.uid returning username`, [username, uid, email]);
      return r.rowCount > 0;
    },
    async releaseUsername(username, uid) {
      await q(`delete from usernames where username = $1 and uid = $2`, [username, uid]);
    },
    async findEmailByUsername(username) {
      return (await q(`select email from usernames where username = $1`, [username])).rows[0]?.email || null;
    },
    async listProfiles(limit) {
      return (await q(`select * from profiles order by created_at limit $1`, [limit])).rows.map(toProfile);
    },

    // ───────────── Requests ─────────────
    async upsertRequest(id, b, user) {
      return db.transaction(async (tx) => {
        const ins = await tx(`insert into requests (id,kind,name,country,city,city_slug,note,whatsapp,website,created_by_uid,created_by_handle)
                              values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) on conflict (id) do nothing returning id`,
          [id, b.kind, b.name, b.country, b.city, b.citySlug, b.note ?? null, b.whatsapp ?? null, b.website ?? null, b.createdBy.uid, b.createdBy.handle]);
        const sup = await tx(`insert into supporters (request_id, uid, handle) values ($1,$2,$3) on conflict do nothing returning uid`, [id, user.uid, user.handle]);
        if (ins.rowCount > 0) return { created: true, supported: true };
        if (sup.rowCount > 0) { await tx(`update requests set support_count = support_count + 1 where id = $1`, [id]); return { created: false, supported: true }; }
        return { created: false, supported: false };
      });
    },
    async supportRequest(id, user) {
      return db.transaction(async (tx) => {
        const cur = (await tx(`select status from requests where id = $1`, [id])).rows[0];
        if (!cur || cur.status === "hidden") return "missing" as const;
        const sup = await tx(`insert into supporters (request_id, uid, handle) values ($1,$2,$3) on conflict do nothing returning uid`, [id, user.uid, user.handle]);
        if (sup.rowCount === 0) return "already" as const;
        await tx(`update requests set support_count = support_count + 1 where id = $1`, [id]);
        return "supported" as const;
      });
    },
    async listRequests(o) {
      const w = where();
      if (!o.includeAll) w.add("status = 'open'");
      if (o.kind) w.add("kind = ?", o.kind);
      if (o.country) w.add("country = ?", o.country);
      if (o.citySlug) w.add("city_slug = ?", o.citySlug);
      const r = await q(`select * from requests${w.sql} order by support_count desc, created_at desc limit ${Math.min(o.limit ?? 100, 5000)}`, w.params);
      return r.rows.map(toRequest);
    },
    async setRequestStatus(id, status) {
      await q(`update requests set status = $2 where id = $1`, [id, status]);
    },
    async requestsBy(uid) {
      return (await q(`select * from requests where created_by_uid = $1 order by created_at desc limit 100`, [uid])).rows.map(toRequest);
    },
    async supportedBy(uid, ids) {
      if (!ids.length) return new Set<string>();
      const r = await q(`select request_id from supporters where uid = $1 and request_id = any($2::text[])`, [uid, ids]);
      return new Set(r.rows.map((x: any) => x.request_id as string));
    },

    // ───────────── Social ─────────────
    async findUidByUsername(username) {
      return (await q(`select uid from usernames where username = $1`, [username])).rows[0]?.uid || null;
    },
    async follow(me, them) {
      if (me.uid === them.uid) return;
      await q(`insert into follows (follower_uid, follower_handle, followee_uid, followee_handle) values ($1,$2,$3,$4) on conflict do nothing`, [me.uid, me.handle, them.uid, them.handle]);
    },
    async unfollow(meUid, themUid) {
      await q(`delete from follows where follower_uid = $1 and followee_uid = $2`, [meUid, themUid]);
    },
    async isFollowing(meUid, themUid) {
      return (await q(`select 1 from follows where follower_uid = $1 and followee_uid = $2`, [meUid, themUid])).rows.length > 0;
    },
    async following(uid) {
      return (await q(`select followee_uid, followee_handle from follows where follower_uid = $1 order by at desc limit 200`, [uid])).rows.map((x: any) => ({ uid: x.followee_uid, handle: x.followee_handle }));
    },
    async followerCount(uid) {
      return Number((await q(`select count(*) as n from follows where followee_uid = $1`, [uid])).rows[0].n);
    },
    async activityBy(uids) {
      const ids = uids.slice(0, 30);
      if (!ids.length) return { requests: [], prices: [] };
      const [rq, pr] = await Promise.all([
        q(`select * from requests where created_by_uid = any($1::text[]) and status = 'open' order by created_at desc limit 20`, [ids]),
        q(`select ${PRICE_COLS} from prices where reporter = any($1::text[]) and status = 'ok' order by created_at desc limit 20`, [ids]),
      ]);
      return { requests: rq.rows.map(toRequest), prices: pr.rows.map(toPrice) };
    },

    // ───────────── Lifecycle & support ─────────────
    async deleteAccountData(uid) {
      await db.transaction(async (tx) => {
        await tx(`delete from profiles where uid = $1`, [uid]);
        await tx(`delete from usernames where uid = $1`, [uid]);
        await tx(`delete from follows where follower_uid = $1 or followee_uid = $1`, [uid]);
        await tx(`update leads set user_id = null, user_handle = null where user_id = $1`, [uid]);
        await tx(`update prices set reporter = null, reporter_handle = null where reporter = $1`, [uid]);
        await tx(`update requests set created_by_uid = 'deleted', created_by_handle = 'former-member' where created_by_uid = $1`, [uid]);
        await tx(`update supporters set handle = 'former-member' where uid = $1`, [uid]);
      });
    },
    async addSupportMessage(m: SupportMessage) {
      await q(`insert into support_messages (id,email,message,name,user_handle,created_at) values ($1,$2,$3,$4,$5,$6)`, [randomUUID(), m.email, m.message, m.name ?? null, m.userHandle ?? null, m.createdAt]);
    },
    async listSupportMessages(limit) {
      return (await q(`select * from support_messages order by created_at desc limit $1`, [limit])).rows.map((r: any): SupportMessage => ({
        id: r.id, email: r.email, message: r.message, name: nn(r.name), userHandle: nn(r.user_handle), createdAt: iso(r.created_at),
      }));
    },
  };

  async function insertPrices(ps: (Omit<PricePoint, "id"> & { id: string })[]): Promise<number> {
    const rows = ps.map((p) => ({
      id: p.id, product_key: p.productKey, product_name: p.productName, brand: p.brand ?? null, barcode: p.barcode ?? null, size: p.size ?? null, store_name: p.storeName,
      country: p.country, city: p.city, city_slug: p.citySlug, lat: p.lat ?? null, lng: p.lng ?? null, price: p.price, currency: p.currency, search_text: searchText(p.tokens),
      source: p.source, status: p.status, observed_at: p.observedAt, created_at: p.createdAt, reporter: p.reporter ?? null, reporter_handle: p.reporterHandle ?? null, source_id: p.sourceId ?? null,
    }));
    const res = await q(
      `insert into prices (${PRICE_COLS.replace("created_at", "created_at")})
       select ${PRICE_COLS} from jsonb_to_recordset($1::jsonb) as x(id text,product_key text,product_name text,brand text,barcode text,size text,store_name text,country text,city text,city_slug text,lat double precision,lng double precision,price numeric,currency text,search_text text,source text,status text,observed_at timestamptz,created_at timestamptz,reporter text,reporter_handle text,source_id text)
       on conflict (source, source_id) where source_id is not null do nothing`, [JSON.stringify(rows)]);
    return res.rowCount;
  }
}

/** Real Postgres (Supabase). Use the TRANSACTION POOLER connection string (port 6543) from the Supabase dashboard. */
export async function createPoolSql(connectionString: string): Promise<Sql> {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString, max: 3, ssl: connectionString.includes("localhost") ? undefined : { rejectUnauthorized: false }, idleTimeoutMillis: 10_000 });
  const run = (c: { query: (t: string, p?: unknown[]) => Promise<any> }): Q => async (text, params) => { const r = await c.query(text, params as unknown[]); return { rows: r.rows, rowCount: r.rowCount ?? 0 }; };
  return {
    query: run(pool),
    async transaction(fn) {
      const c = await pool.connect();
      try { await c.query("begin"); const out = await fn(run(c)); await c.query("commit"); return out; }
      catch (e) { await c.query("rollback").catch(() => undefined); throw e; }
      finally { c.release(); }
    },
  };
}

/** Same as createPoolSql but connects on first use, so it can be created synchronously. */
export function createLazyPoolSql(connectionString: string): Sql {
  let pool: Promise<Sql> | undefined;
  const get = () => (pool ??= createPoolSql(connectionString));
  return { query: async (t, p) => (await get()).query(t, p), transaction: async (fn) => (await get()).transaction(fn) };
}
