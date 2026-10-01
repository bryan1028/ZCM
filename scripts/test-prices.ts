import assert from "node:assert/strict";
import { comparePrices, isOutlier, productKey, tokenize } from "../lib/prices";
import type { PricePoint } from "../lib/types";

const now = Date.parse("2026-10-01T12:00:00Z");
const day = (n: number) => new Date(now - n * 864e5).toISOString();
const pt = (o: Partial<PricePoint>): PricePoint => ({
  id: Math.random().toString(36), productKey: "milk-1l", productName: "Fresh Milk", size: "1L", storeName: "Naivas", country: "KE", city: "Nairobi",
  citySlug: "nairobi", price: 130, currency: "KES", tokens: ["fresh", "milk"], source: "crowd", status: "ok", observedAt: day(1), createdAt: day(1), ...o,
});

// latest price per store wins; cheapest flagged; savings computed
let r = comparePrices([pt({ storeName: "Naivas", price: 150, observedAt: day(30) }), pt({ storeName: "Naivas", price: 130 }), pt({ storeName: "Carrefour", price: 145 }), pt({ storeName: "Quickmart", price: 128 })], now);
assert.equal(r.length, 1);
assert.deepEqual(r[0].stores.map((s) => [s.storeName, s.price]), [["Quickmart", 128], ["Naivas", 130], ["Carrefour", 145]]);
assert.equal(r[0].stores[0].isCheapest, true);
assert.equal(r[0].savingsPct, 12);

// stale (>120d), flagged and hidden points are ignored
r = comparePrices([pt({ observedAt: day(200) }), pt({ status: "flagged", storeName: "X" }), pt({ status: "hidden", storeName: "Y" })], now);
assert.equal(r.length, 0);

// currencies are never mixed
r = comparePrices([pt({ storeName: "A", currency: "KES", price: 130 }), pt({ storeName: "B", currency: "KES", price: 140 }), pt({ storeName: "C", currency: "USD", price: 1 })], now);
assert.equal(r[0].currency, "KES");
assert.equal(r[0].stores.length, 2);

// outliers
assert.equal(isOutlier(1300, [128, 130, 145]), true);
assert.equal(isOutlier(10, [128, 130, 145]), true);
assert.equal(isOutlier(140, [128, 130, 145]), false);
assert.equal(isOutlier(9999, [130, 140]), false); // too little data to judge

// keys & tokens
assert.equal(productKey("Milk", "Brookside", "500ml", "6161100000017"), "ean-6161100000017");
assert.equal(productKey("Fresh Milk", "Brookside", "500ml"), "brookside-fresh-milk-500ml");
assert.deepEqual(tokenize("Brookside", "Fresh Milk 1L"), ["brookside", "fresh", "milk", "1l"]);
console.log("prices: all assertions passed");
