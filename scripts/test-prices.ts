import assert from "node:assert/strict";
import { comparePrices, displayName, isOutlier, productKey, tokenize } from "../lib/prices";
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
// the same product in two cities is two comparisons, never mixed
r = comparePrices([pt({ storeName: "A", price: 100 }), pt({ storeName: "B", price: 120 }), pt({ storeName: "Z", city: "Lagos", citySlug: "lagos", country: "NG", currency: "NGN", price: 900 })], now);
assert.equal(r.length, 2);
assert.deepEqual(r.map((x) => x.citySlug).sort(), ["lagos", "nairobi"]);
assert.equal(r.find((x) => x.citySlug === "nairobi")!.stores.length, 2);
// relevance: a lead-word match outranks a stray word; the preferred city wins ties
const mk = (name: string, key: string, o: Partial<PricePoint> = {}) => pt({ productKey: key, productName: name, tokens: tokenize(name), ...o });
r = comparePrices([mk("Milk Chocolate Bar", "mc", { storeName: "A" }), mk("Milk Chocolate Bar", "mc", { storeName: "B" }), mk("Milk", "m", { storeName: "A" })], now, "milk");
assert.equal(r[0].productName, "Milk", "exact name beats a longer name that merely starts with the word");
r = comparePrices([mk("Milk Chocolate Candies", "c", { storeName: "A" }), mk("Milk Chocolate Candies", "c", { storeName: "B" }), mk("Organic Valley 0% Milk", "o", { storeName: "A" })], now, "milk");
assert.equal(r[0].productName, "Organic Valley 0% Milk", "milk the drink (noun last) outranks milk chocolate even with fewer stores");
r = comparePrices([mk("Rice", "r", { storeName: "A", city: "Lagos", citySlug: "lagos" }), mk("Rice", "r", { storeName: "A" })], now, "rice", "nairobi");
assert.equal(r[0].citySlug, "nairobi", "preferred city first");
assert.equal(displayName({ brand: "Daawat", productName: "Daawat Basmati Rice 5Kg", size: "5kg" }), "Daawat Basmati Rice 5Kg");
assert.equal(displayName({ brand: "Brookside", productName: "Fresh Milk", size: "500ml" }), "Brookside Fresh Milk 500ml");
assert.equal(displayName({ brand: "Cooperative Regions Of Organic Producer Pools", productName: "Organic Valley 0% Milk", size: "1814g" }), "Organic Valley 0% Milk 1814g");
assert.equal(displayName({ brand: "Cooperative Regions Of Organic Producer Pools", productName: "Organic Valley 0% Milk", size: "1814g" }, false), "Organic Valley 0% Milk");
console.log("prices: all assertions passed");
