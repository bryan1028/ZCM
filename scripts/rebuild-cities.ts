/** Recompute the city list shown on Zood (one doc, meta/cities). Run after any bulk import. */
import { getStore } from "../lib/store";

(async () => {
  const store = getStore();
  const list = await store.computeCities();
  await store.setCities(list);
  console.log(`${list.length} cities. Top:`, JSON.stringify(list.slice(0, 8).map((c) => `${c.city}, ${c.country} (${c.count})`)));
})().catch((e) => { console.error(e); process.exit(1); });
