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
