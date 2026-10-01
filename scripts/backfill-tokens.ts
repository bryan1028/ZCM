/** Add search `tokens` to restaurants that lack them (the original migrated ones). Idempotent. Needs FIREBASE_SERVICE_ACCOUNT. */
import { adminDb } from "../lib/firebase-admin";
import { restaurantTokens } from "../lib/dishes";
import type { Restaurant } from "../lib/types";

(async () => {
  const db = adminDb();
  const snap = await db.collection("restaurants").get();
  let n = 0, batch = db.batch();
  for (const d of snap.docs) {
    const r = d.data() as Restaurant;
    if (Array.isArray(r.tokens) && r.tokens.length) continue;
    batch.update(d.ref, { tokens: restaurantTokens({ name: r.name, cuisines: r.cuisines ?? [], menu: r.menu ?? [] }) });
    if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); }
  }
  if (n % 400) await batch.commit();
  console.log(`backfilled tokens on ${n} of ${snap.size} restaurants`);
})().catch((e) => { console.error(e); process.exit(1); });
