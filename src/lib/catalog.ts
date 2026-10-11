// Categories are code-level config for now; move to a table when communities want their own.
export const KINDS = {
  services: { kind: "service", label: "Services", blurb: "Gardeners, cleaners, handymen and more" },
  products: { kind: "product", label: "Products", blurb: "Cookies, produce, crafts and more" },
} as const;
export type KindSlug = keyof typeof KINDS;

export const CATEGORIES: Record<"service" | "product", string[]> = {
  service: ["Gardening", "Cleaning", "Laundry", "Childcare", "Repairs", "Tutoring", "Transport", "Other"],
  product: ["Baked goods", "Food & drink", "Produce", "Crafts", "Clothing", "Second-hand", "Other"],
};

export const PRICE_UNITS = {
  fixed: "",
  per_hour: "/ hour",
  per_job: "/ job",
  per_item: "/ item",
  per_kg: "/ kg",
} as const;

/** How a listing can be priced, depending on what it is: onions go by the kilo, a vehicle has one fixed price, a gardener charges per hour. */
export const UNITS_FOR: Record<"service" | "product", (keyof typeof PRICE_UNITS)[]> = {
  service: ["fixed", "per_hour", "per_job"],
  product: ["fixed", "per_item", "per_kg"],
};
export const UNIT_LABEL: Record<keyof typeof PRICE_UNITS, string> = {
  fixed: "Fixed price", per_hour: "Per hour", per_job: "Per job", per_item: "Per item", per_kg: "Per kg",
};
export const UNIT_HINT: Record<keyof typeof PRICE_UNITS, string> = {
  fixed: "one price for the whole thing", per_hour: "charged by the hour", per_job: "one price per job", per_item: "price of each one", per_kg: "price of each kilo",
};

export function formatPrice(cents: number | null, unit: keyof typeof PRICE_UNITS, currency = "KES") {
  if (cents == null) return "Price not set";
  return `${currency} ${(cents / 100).toLocaleString("en-KE", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })} ${PRICE_UNITS[unit]}`.trim();
}

export const CATEGORY_EMOJI: Record<string, string> = {
  Gardening: "🌿", Cleaning: "🧼", Laundry: "🧺", Childcare: "🧸", Repairs: "🔧", Tutoring: "📚", Transport: "🚗",
  "Baked goods": "🍪", "Food & drink": "🍲", Produce: "🥕", Crafts: "🧶", Clothing: "👕", "Second-hand": "♻️", Other: "✨",
};
