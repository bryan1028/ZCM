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
  negotiable: "(negotiable)",
} as const;

export function formatPrice(cents: number | null, unit: keyof typeof PRICE_UNITS, currency = "KES") {
  if (cents == null || unit === "negotiable") return "Negotiable";
  return `${currency} ${(cents / 100).toLocaleString()} ${PRICE_UNITS[unit]}`.trim();
}
