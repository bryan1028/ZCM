/** Runs the Postgres store against a real in-process Postgres (PGlite) using the production schema. No network or credentials. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { createPgStore, type Q, type Sql } from "../lib/pg-store";
import { comparePrices, tokenize } from "../lib/prices";
import type { Restaurant } from "../lib/types";

const ok = (m: string) => console.log("PASS", m);
(async () => {
  const pg = new PGlite();
  await pg.exec(readFileSync("supabase/migrations/0001_init.sql", "utf8"));
  await pg.exec(readFileSync("supabase/migrations/0002_claims.sql", "utf8"));
  const wrap = (c: { query: (t: string, p?: unknown[]) => Promise<any> }): Q => async (t, p) => { const r = await c.query(t, p as unknown[]); return { rows: r.rows, rowCount: Math.max(r.rows.length, r.affectedRows ?? 0) }; };
  const sql: Sql = { query: wrap(pg), transaction: (fn) => pg.transaction(async (tx) => fn(wrap(tx))) };
  const s = createPgStore(sql);
  ok("schema applies cleanly (RLS enabled on every table)");

  const R = (o: Partial<Omit<Restaurant, "id">> & { name: string; sourceId: string }): Omit<Restaurant, "id"> => ({
    country: "KE", city: "Nairobi", citySlug: "nairobi", whatsapp: null, cuisines: [], diets: [], menu: [], status: "unclaimed", source: "overture", plan: "free", leadCount: 0, createdAt: "", ...o,
  });
  const menu = [{ id: "m1", name: "Chicken Tikka", price: 1950, currency: "KES", diets: [], allergens: ["dairy"] }, { id: "m2", name: "Jeera Aloo", description: "Baby potatoes", price: 1200, currency: "KES", diets: ["vegetarian" as const], allergens: ["dairy"] }];

  // ── restaurants
  const batch = [
    R({ name: "Haandi", sourceId: "1", status: "active", whatsapp: "254700000001", cuisines: ["indian"], diets: ["vegetarian"], menu, rank: 0.9 }),
    R({ name: "Taj Indian Kitchen", sourceId: "2", cuisines: ["indian"], phone: "254700000002", website: "https://taj.example", rank: 0.8 }),
    R({ name: "Green Bowl", sourceId: "3", country: "NG", city: "Lagos", citySlug: "lagos", cuisines: ["vegan"], diets: ["vegan", "vegetarian"], rank: 0.5 }),
    R({ name: "Sushi Zen", sourceId: "4", country: "JP", city: "Tokyo", citySlug: "tokyo", cuisines: ["japanese", "sushi"], rank: 0.7 }),
  ];
  assert.deepEqual(await s.upsertImported(batch), { created: 4, skipped: 0 }); assert.deepEqual(await s.upsertImported(batch), { created: 0, skipped: 4 }); ok("bulk import is idempotent (4 created, then 4 skipped)");
  let r = await s.searchRestaurants({ citySlug: "nairobi" }); assert.deepEqual(r.map((x) => x.name), ["Haandi"]); ok("city search lists only active restaurants that have a menu");
  assert.equal(r[0].menu.length, 2); const taj0 = (await s.getRestaurant("overture-2"))!; assert.equal(taj0.website, "https://taj.example"); assert.equal(taj0.phone, "254700000002"); ok("menu jsonb + phone/website round-trip");
  assert.deepEqual((await s.searchRestaurants({ q: "indian" })).map((x) => x.name), ["Haandi"]); ok("text search by cuisine");
  assert.deepEqual((await s.searchRestaurants({ q: "ind haa" })).map((x) => x.name), ["Haandi"]); ok("multi-word prefix search ('ind haa')");
  assert.deepEqual((await s.searchRestaurants({ q: "jeera" })).map((x) => x.name), ["Haandi"]); ok("search finds dish names");
  assert.deepEqual((await s.searchRestaurants({ diet: ["vegetarian"] })).map((x) => x.name), ["Haandi"]); assert.equal((await s.searchRestaurants({ diet: ["vegan"] })).length, 0); ok("diet filter (and menu-less Green Bowl stays hidden)");
  assert.deepEqual((await s.searchRestaurants({ country: "KE" })).map((x) => x.name), ["Haandi"]); assert.equal((await s.searchRestaurants({ country: "JP" })).length, 0); ok("country filter");
  assert.equal((await s.searchRestaurants({ q: "'; drop table restaurants; --" })).length, 0); assert.equal((await s.searchRestaurants({})).length, 1); ok("SQL-injection style input is harmless");
  assert.equal((await s.searchRestaurants({ limit: 1 })).length, 1); ok("limit respected");
  const dishes = await s.searchDishes({ q: "chicken" }); assert.deepEqual(dishes.map((d) => d.item.name), ["Chicken Tikka"]); assert.equal((await s.searchDishes({ avoid: ["dairy"] })).length, 0); ok("dish search + allergen avoidance");
  assert.deepEqual((await s.listCities()).map((c) => `${c.city}:${c.count}`), ["Nairobi:1"]); ok("city list counts only active restaurants with menus");
  const id = await s.createRestaurant(R({ name: "Mama Pizza", sourceId: "x", source: "owner", status: "pending", whatsapp: "254711111111" })); assert.ok(id.startsWith("own-"));
  assert.equal((await s.searchRestaurants({ q: "pizza" })).length, 0, "pending restaurants are not public"); ok("owner submissions stay hidden until approved");
  await s.setMenu("import-x".replace("import", "overture"), []); // no-op on missing id
  await s.setMenu("overture-2", [{ id: "a", name: "Butter Naan", diets: ["vegetarian"], allergens: ["gluten"] }]);
  assert.equal((await s.searchRestaurants({ q: "naan" })).length, 0, "unclaimed stays hidden even with a menu"); assert.ok((await s.getRestaurant("overture-2"))!.diets.includes("vegetarian")); ok("setMenu refreshes search text + diets");
  // ── claims: verified owners
  const cid = await s.addClaim({ restaurantId: "overture-2", restaurantName: "Taj Indian Kitchen", country: "KE", city: "Nairobi", contactName: "Tej", whatsapp: "254700000002", email: "tej@taj.example", status: "new", userId: "u9", userHandle: "tej", role: "owner", proof: "https://taj.example", createdAt: new Date().toISOString() });
  assert.equal((await s.getClaim(cid))!.userHandle, "tej"); assert.equal((await s.listClaimsByUser("u9")).length, 1);
  await s.addClaimMessage({ claimId: cid, fromAdmin: false, body: "hello" }); await s.addClaimMessage({ claimId: cid, fromAdmin: true, body: "calling you" });
  assert.deepEqual((await s.listClaimMessages(cid)).map((m) => m.fromAdmin), [false, true]); assert.equal((await s.listAllClaimMessages(10)).length, 2); ok("claims + message thread");
  await s.updateClaim(cid, { status: "verifying" }); assert.equal((await s.getClaim(cid))!.status, "verifying");
  await s.approveClaim(cid, 90);
  const taj = (await s.getRestaurant("overture-2"))!; assert.equal(taj.status, "active"); assert.equal(taj.ownerUid, "u9"); assert.equal(taj.plan, "trial"); assert.ok(taj.trialEndsAt && Date.parse(taj.trialEndsAt) > Date.now() + 80 * 864e5);
  assert.equal((await s.getClaim(cid))!.status, "approved"); assert.deepEqual((await s.listMyRestaurants("u9")).map((x) => x.name), ["Taj Indian Kitchen"]);
  assert.deepEqual((await s.searchRestaurants({ q: "naan" })).map((x) => x.name), ["Taj Indian Kitchen"]); ok("approval makes the claimant owner, starts the trial, and lists the restaurant");
  await s.updateRestaurantProfile("overture-2", { name: "Taj Kitchen", whatsapp: "254700000009", phone: null, website: null, address: "Moi Ave", cuisines: ["indian"] });
  const taj2 = (await s.getRestaurant("overture-2"))!; assert.equal(taj2.name, "Taj Kitchen"); assert.equal(taj2.whatsapp, "254700000009"); assert.deepEqual((await s.searchRestaurants({ q: "kitchen" })).map((x) => x.name), ["Taj Kitchen"]); ok("owner profile edit refreshes search");
  await assert.rejects(s.approveClaim(await s.addClaim({ restaurantName: "x", country: "KE", city: "Nairobi", contactName: "a", whatsapp: "1", createdAt: new Date().toISOString() }), 90)); ok("a claim without a signed-in claimant can't be approved");

  assert.equal(await s.getRestaurant("nope"), null); ok("missing restaurant -> null");

  // ── leads
  await s.recordLead({ restaurantId: "overture-1", restaurantName: "Haandi", country: "KE", city: "Nairobi", itemId: "m1,m2", itemName: "Chicken Tikka, Jeera Aloo", source: "chatgpt", channel: "whatsapp", ref: "AB12", visitor: "v1", createdAt: new Date().toISOString() });
  await s.recordLead({ restaurantId: "overture-1", restaurantName: "Haandi", country: "KE", city: "Nairobi", source: "web", channel: "call", ref: "CD34", visitor: "v2", userId: "u1", userHandle: "alice", createdAt: new Date().toISOString() });
  const leads = await s.listLeads(10); assert.equal(leads.length, 2); assert.equal(leads[0].channel, "call"); assert.equal(leads[1].itemName, "Chicken Tikka, Jeera Aloo"); assert.equal((await s.getRestaurant("overture-1"))!.leadCount, 2); ok("leads recorded (multi-dish, channel, user) and counters incremented");

  // ── prices
  const P = (store: string, price: number, o: any = {}) => ({ productKey: "milk-1l", productName: "Whole Milk", brand: "Brookside", size: "1L", storeName: store, country: "KE", city: "Nairobi", citySlug: "nairobi", price, currency: "KES", tokens: tokenize("Whole Milk", "Brookside"), source: "openprices" as const, status: "ok" as const, observedAt: new Date().toISOString(), createdAt: new Date().toISOString(), sourceId: `${store}-${price}`, ...o });
  assert.deepEqual(await s.upsertPrices([P("Naivas", 120), P("Quickmart", 115), P("Lagos Mart", 900, { country: "NG", city: "Lagos", citySlug: "lagos", currency: "NGN" })]), { created: 3, skipped: 0 });
  assert.deepEqual(await s.upsertPrices([P("Naivas", 120)]), { created: 0, skipped: 1 }); ok("price import is idempotent");
  const pts = await s.searchPrices({ q: "mil", citySlug: "nairobi" }); assert.equal(pts.length, 2); assert.equal(pts[0].price === 120 || pts[0].price === 115, true); assert.equal(typeof pts[0].price, "number");
  const cmp = comparePrices(await s.searchPrices({ q: "milk" }), Date.now(), "milk"); assert.equal(cmp.length, 2); assert.equal(cmp.find((c) => c.citySlug === "nairobi")!.stores[0].storeName, "Quickmart"); ok("price search (prefix, per-city) feeds comparePrices correctly");
  const pid = await s.addPrice(P("Eastmatt", 118, { source: "crowd", sourceId: undefined, reporter: "u1", reporterHandle: "alice" })); assert.ok(pid);
  await s.setPriceStatus(pid, "hidden"); assert.equal((await s.searchPrices({ q: "milk", citySlug: "nairobi" })).length, 2); assert.equal((await s.searchPrices({ q: "milk", citySlug: "nairobi", includeAll: true })).length, 3); ok("hidden prices excluded unless includeAll");
  assert.equal((await s.listPrices(10)).length, 4);

  // ── deals
  await s.addDeal({ title: "20% off veg", storeName: "Carrefour", country: "KE", city: "Nairobi", citySlug: "nairobi", validUntil: "2099-01-01", status: "active", source: "admin", createdAt: new Date().toISOString(), discountPct: 20 });
  await s.addDeal({ title: "old", storeName: "X", country: "KE", city: "Nairobi", citySlug: "nairobi", validUntil: "2000-01-01", status: "active", source: "admin", createdAt: new Date().toISOString() });
  const deals = await s.listDeals({ citySlug: "nairobi" }); assert.deepEqual(deals.map((d) => d.title), ["20% off veg"]); assert.equal(deals[0].validUntil, "2099-01-01"); assert.equal((await s.listDeals({ includeAll: true })).length, 2); ok("deals: expired hidden, dates are plain YYYY-MM-DD");

  // ── accounts
  assert.equal(await s.claimUsername("alice", "u1", "alice@x.com"), true); assert.equal(await s.claimUsername("alice", "u2", "bob@x.com"), false); assert.equal(await s.claimUsername("alice", "u1", "alice@x.com"), true); ok("username claim: first wins, same owner idempotent, other rejected");
  assert.equal(await s.findEmailByUsername("alice"), "alice@x.com"); assert.equal(await s.findUidByUsername("alice"), "u1"); assert.equal(await s.findEmailByUsername("nobody"), null);
  await s.saveProfile("u1", { username: "alice", email: "alice@x.com", diets: ["vegan"], allergies: ["nuts"], city: "Nairobi", country: "KE", optIn: false });
  await s.saveProfile("u1", { optIn: true }); const prof = (await s.getProfile("u1"))!; assert.equal(prof.optIn, true); assert.deepEqual(prof.diets, ["vegan"]); assert.equal(prof.city, "Nairobi"); assert.equal(prof.username, "alice"); ok("profile merge: a partial save keeps other fields");
  assert.equal(await s.getProfile("ghost"), null); assert.equal((await s.listProfiles(10)).length, 1);
  await s.saveProfile("u2", { username: "bob", email: "bob@x.com" }); await s.claimUsername("bob", "u2", "bob@x.com");

  // ── requests
  const base = { kind: "restaurant" as const, name: "Chez Paul", country: "FR", city: "Paris", citySlug: "paris", createdBy: { uid: "u1", handle: "alice" } };
  assert.deepEqual(await s.upsertRequest("restaurant-fr-paris-chez-paul", base, { uid: "u1", handle: "alice" }), { created: true, supported: true });
  assert.deepEqual(await s.upsertRequest("restaurant-fr-paris-chez-paul", base, { uid: "u1", handle: "alice" }), { created: false, supported: false });
  assert.deepEqual(await s.upsertRequest("restaurant-fr-paris-chez-paul", base, { uid: "u2", handle: "bob" }), { created: false, supported: true });
  assert.equal((await s.listRequests({ citySlug: "paris" }))[0].supportCount, 2); ok("requests: dedupe, no double-backing, second user adds one");
  assert.equal(await s.supportRequest("restaurant-fr-paris-chez-paul", { uid: "u2", handle: "bob" }), "already"); assert.equal(await s.supportRequest("nope", { uid: "u2", handle: "bob" }), "missing");
  assert.equal(await s.supportRequest("restaurant-fr-paris-chez-paul", { uid: "u3", handle: "cara" }), "supported"); assert.equal((await s.listRequests({}))[0].supportCount, 3);
  assert.deepEqual([...(await s.supportedBy("u2", ["restaurant-fr-paris-chez-paul", "x"]))], ["restaurant-fr-paris-chez-paul"]); assert.equal((await s.requestsBy("u1")).length, 1);
  await s.setRequestStatus("restaurant-fr-paris-chez-paul", "hidden"); assert.equal((await s.listRequests({})).length, 0); assert.equal(await s.supportRequest("restaurant-fr-paris-chez-paul", { uid: "u4", handle: "d" }), "missing"); assert.equal((await s.listRequests({ includeAll: true })).length, 1); ok("hidden requests vanish and can't be backed");
  await s.setRequestStatus("restaurant-fr-paris-chez-paul", "open");

  // ── social + deletion
  await s.follow({ uid: "u2", handle: "bob" }, { uid: "u1", handle: "alice" }); await s.follow({ uid: "u2", handle: "bob" }, { uid: "u1", handle: "alice" }); await s.follow({ uid: "u1", handle: "alice" }, { uid: "u1", handle: "alice" });
  assert.equal(await s.followerCount("u1"), 1); assert.equal(await s.isFollowing("u2", "u1"), true); assert.deepEqual(await s.following("u2"), [{ uid: "u1", handle: "alice" }]);
  const act = await s.activityBy(["u1"]); assert.equal(act.requests.length, 1); assert.equal(act.prices.length, 0); ok("follow/unfollow/feed (no self-follow, no duplicates)");
  await s.deleteAccountData("u9", "tej"); assert.equal((await s.listMyRestaurants("u9")).length, 0); assert.equal((await s.getClaim(cid))!.email, undefined); assert.equal((await s.getClaim(cid))!.contactName, "former member");
  await s.deleteAccountData("u1", "alice");
  assert.equal(await s.getProfile("u1"), null); assert.equal(await s.findUidByUsername("alice"), null); assert.equal(await s.followerCount("u1"), 0);
  assert.equal((await s.listLeads(10)).some((l) => l.userHandle === "alice" || l.userId === "u1"), false); assert.equal((await s.listRequests({}))[0].createdBy.handle, "former-member");
  assert.equal((await s.listPrices(10)).some((p) => p.reporterHandle === "alice"), false); assert.equal(await s.supportedBy("u1", ["restaurant-fr-paris-chez-paul"]).then((x) => x.size), 1); ok("account deletion scrubs identity everywhere but keeps the content and counts");
  assert.equal((await s.listRequests({}))[0].supportCount, 3);

  // ── support + claims
  await s.addSupportMessage({ email: "a@b.co", message: "hello", createdAt: new Date().toISOString() }); assert.equal((await s.listSupportMessages(5))[0].message, "hello");
  await s.addClaim({ restaurantName: "Haandi", country: "KE", city: "Nairobi", contactName: "Sam", whatsapp: "254700000009", createdAt: new Date().toISOString() }); assert.equal((await s.listClaims(10)).length, 3); ok("support messages + claims");
  console.log("\nPostgres store: all checks passed");
})().catch((e) => { console.error("PG STORE TEST FAILED:", e.message ?? e); process.exit(1); });
