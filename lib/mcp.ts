import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { comparePrices } from "./prices";
import { getStore } from "./store";
import { DIETS, type Diet } from "./types";
import { slugify } from "./util";

const SITE = () => process.env.NEXT_PUBLIC_SITE_URL ?? "https://zist.it.com";
const DIET_IDS = DIETS.map((d) => d.id) as [Diet, ...Diet[]];

const ALLERGY_NOTE =
  "Menu and allergen details come from restaurants and the community and may be out of date. An empty allergen list means none were declared, not that a dish is allergen-free. Anyone with a severe allergy should confirm with the restaurant before ordering.";

const allergensField = z.array(z.string()).describe("Allergens the restaurant declared. An empty list means none were declared, NOT that the dish is allergen-free.");

export const SERVER_INSTRUCTIONS =
  "Zist finds restaurants that match a diet in a city, compares grocery prices between stores, lists deals, and gives a link to message a restaurant on WhatsApp. " +
  "Use city names only; never ask for a precise address or GPS location. Diet and allergy filters are used for the search only. " +
  "Allergen data is supplied by restaurants and may be out of date, so always remind people with severe allergies to confirm with the restaurant. " +
  "To contact a restaurant, give the user its messageUrl link; do not invent phone numbers.";

// Every tool only reads data. Contacting a restaurant is a link the user opens themselves.
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true } as const;

const city = z.string().trim().min(2).max(80).describe("City name, for example Nairobi. Do not use a street address.");
const country = z.string().trim().length(2).optional().describe("Optional 2-letter country code, for example KE.");

function ok(structured: Record<string, unknown>, text: string) {
  return { structuredContent: structured, content: [{ type: "text" as const, text }] };
}

export function createZistServer(): McpServer {
  const server = new McpServer({ name: "zist", version: "1.0.0" }, { instructions: SERVER_INSTRUCTIONS });

  server.registerTool(
    "search_restaurants",
    {
      title: "Search restaurants by diet",
      description:
        "Use this when the user wants restaurants in a city that suit a diet (vegan, vegetarian, gluten-free, halal, kosher, dairy-free, nut-free) or a cuisine or dish. Returns matching restaurants with menu highlights and a link to message each one.",
      inputSchema: {
        city,
        country,
        diets: z.array(z.enum(DIET_IDS)).max(4).optional().describe("Diets the restaurant must cater for."),
        query: z.string().trim().max(60).optional().describe("Optional cuisine or dish, for example thai or burger."),
        limit: z.number().int().min(1).max(10).optional().describe("Maximum results, default 5."),
      },
      outputSchema: {
        results: z.array(z.object({
          id: z.string(), name: z.string(), city: z.string(), address: z.string().optional(),
          cuisines: z.array(z.string()), diets: z.array(z.string()), hasMenu: z.boolean(),
          menuHighlights: z.array(z.object({ name: z.string(), price: z.number().optional(), currency: z.string().optional(), diets: z.array(z.string()), allergens: allergensField })),
          pageUrl: z.string(), messageUrl: z.string().nullable(),
        })),
        note: z.string(),
      },
      annotations: { ...READ_ONLY, title: "Search restaurants by diet" },
    },
    async ({ city: c, country: cc, diets, query, limit }) => {
      const rs = await getStore().searchRestaurants({ citySlug: slugify(c), country: cc?.toUpperCase(), diet: diets, q: query, limit: limit ?? 5 });
      const results = rs.map((r) => ({
        id: r.id, name: r.name, city: r.city, address: r.address, cuisines: r.cuisines, diets: r.diets, hasMenu: r.menu.length > 0,
        menuHighlights: r.menu.slice(0, 3).map((m) => ({ name: m.name, price: m.price, currency: m.currency, diets: m.diets, allergens: m.allergens })),
        pageUrl: `${SITE()}/r/${r.id}`, messageUrl: r.whatsapp ? `${SITE()}/go/${r.id}?src=chatgpt` : null,
      }));
      const text = results.length
        ? `Found ${results.length} restaurant${results.length === 1 ? "" : "s"} in ${c}:\n` + results.map((r) => `- ${r.name}${r.address ? ` (${r.address})` : ""}${r.diets.length ? ` — ${r.diets.join(", ")}` : ""}${r.messageUrl ? ` — message: ${r.messageUrl}` : ""}`).join("\n") + `\n${ALLERGY_NOTE}`
        : `No restaurants found in ${c} for that search. People can request a place at ${SITE()}/requests/new.`;
      return ok({ results, note: ALLERGY_NOTE }, text);
    },
  );

  server.registerTool(
    "get_restaurant",
    {
      title: "Get restaurant details and menu",
      description: "Use this when the user wants the menu, dietary tags or allergens for one restaurant returned by search_restaurants. Takes the restaurant id from that search.",
      inputSchema: { id: z.string().trim().min(3).max(160).describe("Restaurant id from search_restaurants.") },
      outputSchema: {
        found: z.boolean(),
        restaurant: z.object({
          id: z.string(), name: z.string(), city: z.string(), address: z.string().optional(), cuisines: z.array(z.string()), diets: z.array(z.string()),
          menu: z.array(z.object({ name: z.string(), description: z.string().optional(), price: z.number().optional(), currency: z.string().optional(), diets: z.array(z.string()), allergens: allergensField })),
          pageUrl: z.string(), messageUrl: z.string().nullable(),
        }).optional(),
        note: z.string(),
      },
      annotations: { ...READ_ONLY, title: "Get restaurant details and menu" },
    },
    async ({ id }) => {
      const r = await getStore().getRestaurant(id);
      if (!r || (r.status !== "active" && r.status !== "unclaimed")) return ok({ found: false, note: ALLERGY_NOTE }, "No restaurant found with that id. Use search_restaurants first.");
      const restaurant = {
        id: r.id, name: r.name, city: r.city, address: r.address, cuisines: r.cuisines, diets: r.diets,
        menu: r.menu.map((m) => ({ name: m.name, description: m.description, price: m.price, currency: m.currency, diets: m.diets, allergens: m.allergens })),
        pageUrl: `${SITE()}/r/${r.id}`, messageUrl: r.whatsapp ? `${SITE()}/go/${r.id}?src=chatgpt` : null,
      };
      const text = `${r.name} (${r.city}). ` + (r.menu.length ? `${r.menu.length} menu item${r.menu.length === 1 ? "" : "s"}.` : "The menu has not been added yet.") +
        (restaurant.messageUrl ? ` Message them: ${restaurant.messageUrl}` : " No WhatsApp number is listed yet.") + ` ${ALLERGY_NOTE}`;
      return ok({ found: true, restaurant, note: ALLERGY_NOTE }, text);
    },
  );

  server.registerTool(
    "compare_prices",
    {
      title: "Compare grocery prices",
      description: "Use this when the user wants to know where a grocery product is cheapest in a city. Returns the latest community-reported price at each store.",
      inputSchema: { product: z.string().trim().min(2).max(60).describe("Product name, for example milk or maize flour."), city, country },
      outputSchema: {
        comparisons: z.array(z.object({
          product: z.string(), size: z.string().optional(), currency: z.string(), savingsPercent: z.number(),
          stores: z.array(z.object({ store: z.string(), price: z.number(), reportedAt: z.string(), cheapest: z.boolean() })),
        })),
        reportPriceUrl: z.string(), note: z.string(),
      },
      annotations: { ...READ_ONLY, title: "Compare grocery prices" },
    },
    async ({ product, city: c, country: cc }) => {
      const points = await getStore().searchPrices({ q: product, citySlug: slugify(c), country: cc?.toUpperCase() });
      const comparisons = comparePrices(points).slice(0, 5).map((x) => ({
        product: [x.brand, x.productName].filter(Boolean).join(" "), size: x.size, currency: x.currency, savingsPercent: x.savingsPct,
        stores: x.stores.map((s) => ({ store: s.storeName, price: s.price, reportedAt: s.observedAt.slice(0, 10), cheapest: s.isCheapest })),
      }));
      const note = "Prices are reported by shoppers and can be out of date; only prices from the last 120 days are included.";
      const text = comparisons.length
        ? comparisons.map((x) => `${x.product}${x.size ? ` ${x.size}` : ""}: ` + x.stores.map((s) => `${s.store} ${s.price} ${x.currency}`).join(", ")).join("\n") + `\n${note}`
        : `No prices for "${product}" in ${c} yet. Anyone can add one at ${SITE()}/find/report.`;
      return ok({ comparisons, reportPriceUrl: `${SITE()}/find/report`, note }, text);
    },
  );

  server.registerTool(
    "find_deals",
    {
      title: "Find current deals",
      description: "Use this when the user wants current supermarket or shop deals in a city.",
      inputSchema: { city, country },
      outputSchema: { deals: z.array(z.object({ title: z.string(), store: z.string(), description: z.string().optional(), discountPercent: z.number().optional(), price: z.number().optional(), currency: z.string().optional(), validUntil: z.string() })), dealsUrl: z.string() },
      annotations: { ...READ_ONLY, title: "Find current deals" },
    },
    async ({ city: c, country: cc }) => {
      const ds = (await getStore().listDeals({ citySlug: slugify(c), country: cc?.toUpperCase(), limit: 10 }));
      const deals = ds.map((d) => ({ title: d.title, store: d.storeName, description: d.description, discountPercent: d.discountPct, price: d.price, currency: d.currency, validUntil: d.validUntil }));
      return ok({ deals, dealsUrl: `${SITE()}/deals` }, deals.length ? deals.map((d) => `- ${d.title} (${d.store}, until ${d.validUntil})`).join("\n") : `No active deals listed for ${c}.`);
    },
  );

  server.registerTool(
    "list_requested_places",
    {
      title: "List places the community wants",
      description: "Use this when the user asks which restaurants or stores people have asked Zist to add in a city, or wants to ask for a place to be added. Returns open requests with how many people back each.",
      inputSchema: { city, country, kind: z.enum(["restaurant", "store"]).optional().describe("Filter to restaurants or stores.") },
      outputSchema: { requests: z.array(z.object({ name: z.string(), kind: z.string(), city: z.string(), backers: z.number() })), requestUrl: z.string() },
      annotations: { ...READ_ONLY, title: "List places the community wants" },
    },
    async ({ city: c, country: cc, kind }) => {
      const rs = await getStore().listRequests({ citySlug: slugify(c), country: cc?.toUpperCase(), kind, limit: 10 });
      const requests = rs.map((r) => ({ name: r.name, kind: r.kind, city: r.city, backers: r.supportCount })); // handles are intentionally not returned
      return ok({ requests, requestUrl: `${SITE()}/requests/new` },
        (requests.length ? requests.map((r) => `- ${r.name} (${r.kind}): ${r.backers} want this`).join("\n") : `No open requests in ${c} yet.`) + `\nTo request a place or back one, sign in at ${SITE()}/requests.`);
    },
  );

  return server;
}
