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
  /** E.164 digits only, no "+", e.g. 254712345678. Null if unknown. Used by the Message button. */
  whatsapp: string | null;
  /** Public contact phone (E.164 digits). May not be on WhatsApp; used by the Call button. */
  phone?: string | null;
  website?: string;
  /** Lower-case search words (name, cuisines, dish names) so text search never needs to scan a city. */
  tokens?: string[];
  /** 0-1 quality score from the source, used to list better-known places first. */
  rank?: number;
  cuisines: string[];
  diets: Diet[];
  menu: MenuItem[];
  status: RestaurantStatus;
  source: "osm" | "overture" | "owner" | "import" | "demo";
  /** Id in the source dataset, so re-imports don't duplicate */
  sourceId?: string;
  plan: "free" | "trial" | "paid";
  leadCount: number;
  createdAt: string;
}

export type LeadSource = "web" | "chatgpt" | "unknown";
export type LeadChannel = "whatsapp" | "call" | "website";

export interface Lead {
  id?: string;
  restaurantId: string;
  restaurantName: string;
  country: string;
  city: string;
  itemId?: string;
  itemName?: string;
  source: LeadSource;
  /** How they reached out. Missing on older leads, which were all WhatsApp. */
  channel?: LeadChannel;
  /** Short code placed in the WhatsApp message so owners can confirm it. */
  ref: string;
  /** Anonymous visitor id (cookie), used to de-duplicate repeat taps. */
  visitor: string;
  /** Set when the visitor was signed in. */
  userId?: string;
  userHandle?: string;
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
  /** Public signature of the signed-in reporter. */
  reporterHandle?: string;
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
  city: string;
  citySlug: string;
  country: string;
  currency: string;
  stores: { storeName: string; price: number; observedAt: string; source: PriceSource; isCheapest: boolean; by?: string }[];
  min: number;
  max: number;
  /** % saved by buying at the cheapest store vs the most expensive; 0 if only one store */
  savingsPct: number;
}

// ───────────── Accounts & community requests ─────────────

export interface Profile {
  uid: string;
  /** Public signature, lower-case: 3-20 chars [a-z0-9_] */
  username: string;
  email: string;
  diets: Diet[];
  allergies: string[];
  city?: string;
  country?: string;
  /** Explicit consent to be emailed when Zist launches in their area. Never default to true. */
  optIn: boolean;
  createdAt: string;
  updatedAt: string;
}

export type RequestKind = "restaurant" | "store";

/** "Please add this place." Signed by its creator; other users add their support. */
export interface PlaceRequest {
  id: string;
  kind: RequestKind;
  name: string;
  country: string;
  city: string;
  citySlug: string;
  note?: string;
  whatsapp?: string | null;
  website?: string;
  createdBy: { uid: string; handle: string };
  supportCount: number;
  status: "open" | "listed" | "hidden";
  createdAt: string;
}

export interface SessionUser {
  uid: string;
  handle: string;
  email: string;
  profile: Profile;
}
