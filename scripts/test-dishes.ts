import assert from "node:assert/strict";
import { dishEmoji, flattenDishes, queryWords } from "../lib/dishes";
import type { Restaurant } from "../lib/types";

const r = (o: Partial<Restaurant> & { id: string; name: string }): Restaurant => ({
  country: "KE", city: "Nairobi", citySlug: "nairobi", whatsapp: "254700000001", cuisines: [], diets: [], menu: [], status: "active", source: "demo", plan: "free", leadCount: 0, createdAt: "", ...o,
});
const m = (id: string, name: string, o: Partial<Restaurant["menu"][number]> = {}) => ({ id, name, diets: [], allergens: [], ...o });

const rs = [
  r({ id: "haandi", name: "Haandi", cuisines: ["indian"], menu: [m("1", "Jeera Aloo", { diets: ["vegetarian"], allergens: ["dairy"], description: "Baby potatoes with cumin", price: 1200 }), m("2", "Chicken Tikka", { price: 1950 }), m("3", "Meat Samosas", { allergens: ["gluten"] })] }),
  r({ id: "green", name: "Green Bowl", cuisines: ["vegan"], menu: [m("1", "Jackfruit Tacos", { diets: ["vegan", "vegetarian"], price: 650 }), m("2", "Chicken-free Wings", { diets: ["vegan"], description: "plant based, tastes like chicken" })] }),
  r({ id: "nomsg", name: "Cafe Nowhere", whatsapp: null, menu: [m("1", "Chicken Sandwich")] }),
  r({ id: "hidden", name: "Hidden", status: "paused", menu: [m("1", "Secret Chicken")] }),
  r({ id: "paris", name: "Chez Paul", country: "FR", city: "Paris", citySlug: "paris", cuisines: ["french"], menu: [m("1", "Croque Monsieur", { allergens: ["dairy", "gluten"] })] }),
];

// words
assert.deepEqual(queryWords("  Spicy  Chicken! "), ["spicy", "chicken"]);
// text search: dish-name matches rank above description matches, hidden restaurants never appear
let h = flattenDishes(rs, { q: "chicken" });
assert.deepEqual(h.map((x) => x.item.name), ["Chicken Tikka", "Chicken-free Wings", "Chicken Sandwich"]); // same whole-word score: messageable first, then cheapest-known
assert.ok(h.every((x) => x.restaurantId !== "hidden"), "paused restaurants are excluded");
assert.equal(h[0].item.name, "Chicken Tikka"); // whole-word name match first (messageable before not)
assert.ok(h.find((x) => x.restaurantId === "nomsg")!.canMessage === false, "no WhatsApp => canMessage false");
assert.ok(h.findIndex((x) => x.restaurantId === "nomsg") > h.findIndex((x) => x.restaurantId === "haandi"), "messageable dishes rank above non-messageable ties");
// cuisine / restaurant context counts
assert.deepEqual(flattenDishes(rs, { q: "indian" }).map((x) => x.item.name).sort(), ["Chicken Tikka", "Jeera Aloo", "Meat Samosas"]);
assert.deepEqual(flattenDishes(rs, { q: "potato" }).map((x) => x.item.name), ["Jeera Aloo"]); // via description
// all words must match
assert.deepEqual(flattenDishes(rs, { q: "chicken indian" }).map((x) => x.item.name), ["Chicken Tikka"]);
// diets are per dish
assert.deepEqual(flattenDishes(rs, { diets: ["vegan"] }).map((x) => x.item.name).sort(), ["Chicken-free Wings", "Jackfruit Tacos"]);
assert.deepEqual(flattenDishes(rs, { diets: ["vegan", "vegetarian"] }).map((x) => x.item.name), ["Jackfruit Tacos"]);
// allergen avoidance removes dishes that DECLARE the allergen; undeclared dishes stay (and are never called safe)
const noDairy = flattenDishes(rs, { avoid: ["dairy"] }).map((x) => x.item.name);
assert.ok(!noDairy.includes("Jeera Aloo") && !noDairy.includes("Croque Monsieur") && noDairy.includes("Chicken Tikka"));
assert.deepEqual(flattenDishes(rs, { avoid: ["Gluten", "DAIRY"] }).map((x) => x.item.name).includes("Meat Samosas"), false, "case-insensitive");
// no query: everything visible, cheapest-known first among equal scores, messageable first
assert.equal(flattenDishes(rs, {}).length, 7);
// emoji
assert.equal(dishEmoji(["indian"]), "🍛"); assert.equal(dishEmoji([], "Margherita pizza"), "🍕"); assert.equal(dishEmoji(["zzz"]), "🍽️");
console.log("dishes: all assertions passed");
