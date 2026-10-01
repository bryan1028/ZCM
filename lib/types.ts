export type Diet = "vegan" | "vegetarian" | "gluten_free" | "halal" | "kosher" | "dairy_free" | "nut_free";

export const DIETS: { id: Diet; label: string }[] = [
  { id: "vegan", label: "Vegan" },
  { id: "vegetarian", label: "Vegetarian" },
  { id: "gluten_free", label: "Gluten-free" },
  { id: "halal", label: "Halal" },
  { id: "kosher", label: "Kosher" },
  { id: "dairy_free", label: "Dairy-free" },
  { id: "nut_free", label: "Nut-free" },
];

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price?: number;
  currency?: string;
  diets: Diet[];
  /** Allergens the dish CONTAINS, as declared by the restaurant. */
  allergens: string[];
}

/**
 * unclaimed: seeded from public data, no owner yet (menu may be empty)
 * pending:   owner submitted / claimed, waiting for admin verification
 * active:    verified, shown everywhere
 * paused:    hidden (unpaid, or owner asked)
 */
export type RestaurantStatus = "unclaimed" | "pending" | "active" | "paused";

export interface Restaurant {
  id: string;
  name: string;
  /** ISO 3166-1 alpha-2, upper case */
  country: string;
  /** Display name, e.g. "Nairobi" */
  city: string;
  /** URL slug of the city, e.g. "nairobi" */
  citySlug: string;
  address?: string;
  lat?: number;
  lng?: number;
  geohash?: string;
  /** E.164 digits only, no "+", e.g. 254712345678. Null if unknown. */
  whatsapp: string | null;
  cuisines: string[];
  diets: Diet[];
  menu: MenuItem[];
  status: RestaurantStatus;
  source: "osm" | "owner" | "import" | "demo";
  /** Id in the source dataset, so re-imports don't duplicate */
  sourceId?: string;
  plan: "free" | "trial" | "paid";
  leadCount: number;
  createdAt: string;
}

export type LeadSource = "web" | "chatgpt" | "unknown";

export interface Lead {
  id?: string;
  restaurantId: string;
  restaurantName: string;
  country: string;
  city: string;
  itemId?: string;
  itemName?: string;
  source: LeadSource;
  /** Short code placed in the WhatsApp message so owners can confirm it. */
  ref: string;
  /** Anonymous visitor id (cookie), used to de-duplicate repeat taps. */
  visitor: string;
  createdAt: string;
}

export interface Claim {
  id?: string;
  restaurantId?: string;
  restaurantName: string;
  country: string;
  city: string;
  contactName: string;
  whatsapp: string;
  email?: string;
  createdAt: string;
}

// ───────────── Zist Find: prices & deals ─────────────

export type PriceSource = "crowd" | "openprices" | "admin";

/** One observed shelf price: "this product cost X at this store on this date". */
export interface PricePoint {
  id: string;
  /** Barcode if known, else slug(name+brand). Groups the same product across stores. */
  productKey: string;
  productName: string;
  brand?: string;
  barcode?: string;
  /** Pack size as written, e.g. "1L", "2kg". Prices are only compared within the same productKey. */
  size?: string;
  storeName: string;
  country: string;
  city: string;
  citySlug: string;
  lat?: number;
  lng?: number;
  price: number;
  /** ISO 4217, e.g. KES */
  currency: string;
  /** Lowercase search tokens from name+brand, used for queries */
  tokens: string[];
  source: PriceSource;
  /** ok: shown. flagged: looks like an outlier, hidden until reviewed. hidden: removed by admin. */
  status: "ok" | "flagged" | "hidden";
  /** When the price was seen (ISO). */
  observedAt: string;
  createdAt: string;
  /** Anonymous reporter id, used for rate limiting and spotting abuse. */
  reporter?: string;
  sourceId?: string;
}

export interface Deal {
  id: string;
  title: string;
  storeName: string;
  country: string;
  city: string;
  citySlug: string;
  description?: string;
  price?: number;
  currency?: string;
  discountPct?: number;
  url?: string;
  /** ISO date; deals are hidden after this */
  validUntil: string;
  status: "active" | "hidden";
  source: "admin" | "crowd";
  createdAt: string;
}

export interface PriceComparison {
  productKey: string;
  productName: string;
  brand?: string;
  size?: string;
  currency: string;
  stores: { storeName: string; price: number; observedAt: string; source: PriceSource; isCheapest: boolean }[];
  min: number;
  max: number;
  /** % saved by buying at the cheapest store vs the most expensive; 0 if only one store */
  savingsPct: number;
}
