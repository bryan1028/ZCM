import assert from "node:assert/strict";
import { placeToRestaurant } from "../lib/places";

const base = { id: "abc", name: "Mama's Kitchen", country: "ng", city: "Lagos", address: "1 Allen Ave", lat: 6.6, lon: 3.35, phone: "2348012345678", whatsapp: "2348012345678", website: "mamas.example.com", cuisines: ["African", " "], diets: ["halal", "bogus"], rank: 0.9 };
let r = placeToRestaurant(base)!;
assert.equal(r.country, "NG"); assert.equal(r.citySlug, "lagos"); assert.equal(r.whatsapp, "2348012345678"); assert.equal(r.phone, "2348012345678");
assert.equal(r.website, "https://mamas.example.com/"); assert.deepEqual(r.cuisines, ["african"]); assert.deepEqual(r.diets, ["halal"]); assert.equal(r.status, "unclaimed"); assert.equal(r.source, "overture");
assert.ok(["mama", "kitchen", "african"].every((w) => r.tokens!.includes(w))); assert.equal(r.lng, 3.35);
// landline: phone only, never WhatsApp
r = placeToRestaurant({ ...base, whatsapp: null })!; assert.equal(r.whatsapp, null); assert.equal(r.phone, "2348012345678");
// website only is fine; no contact at all is dropped
assert.equal(placeToRestaurant({ ...base, phone: null, whatsapp: null })!.phone, null);
assert.equal(placeToRestaurant({ ...base, phone: null, whatsapp: null, website: null }), null);
// junk / unsafe input
assert.equal(placeToRestaurant({ ...base, name: "  " }), null); assert.equal(placeToRestaurant({ ...base, country: "NGA" }), null); assert.equal(placeToRestaurant({ ...base, city: "" }), null);
assert.equal(placeToRestaurant({ ...base, phone: null, whatsapp: null, website: "javascript:alert(1)" }), null);
assert.equal(placeToRestaurant({ ...base, phone: "12", whatsapp: null })!.phone, null);
assert.equal(placeToRestaurant({ ...base, rank: 99 })!.rank, 1.2);
console.log("places: all assertions passed");
