import { CATEGORIES } from "./catalog";

export type SellValues = Record<string, string>;
export type SellCheck =
  | { ok: false; error: string; field?: string }
  | { ok: true; kind: "service" | "product"; category: string; title: string; priceUnit: string; priceCents: number | null; stock: number | null };

// Pure checks for the "sell something" form: forgiving about how people type prices ("1,500", "KES 1500", "150.50"),
// and every failure names the field so the page can say exactly what to fix.
export function checkListing(values: SellValues, hasSeller: boolean): SellCheck {
  const kind = values.kind === "product" ? "product" : "service";
  const category = values[`category_${kind}`] ?? "";
  const title = (values.title ?? "").trim();
  const priceUnit = ["fixed", "per_hour", "per_job", "negotiable"].includes(values.price_unit) ? values.price_unit : "fixed";

  if (!hasSeller) {
    if (!(values.display_name ?? "").trim()) return { ok: false, error: "Please enter your name so neighbours know who you are", field: "display_name" };
    if (values.account_type === "business" && !(values.business_name ?? "").trim()) return { ok: false, error: "Please enter your business name", field: "business_name" };
  }
  if (!CATEGORIES[kind].includes(category)) return { ok: false, error: "Please choose a category", field: `category_${kind}` };
  if (title.length < 3) return { ok: false, error: "Give your listing a title (at least 3 characters)", field: "title" };
  if (title.length > 120) return { ok: false, error: "That title is too long (120 characters max)", field: "title" };

  let priceCents: number | null = null;
  const rawPrice = (values.price ?? "").replace(/kes|ksh|\s|,/gi, "");
  if (priceUnit !== "negotiable" && rawPrice) {
    const n = Number(rawPrice);
    if (!Number.isFinite(n) || n < 0) return { ok: false, error: "Amount should be a number like 1500 or 150.50", field: "price" };
    priceCents = Math.round(n * 100);
  }
  let stock: number | null = null;
  const rawStock = (values.stock ?? "").trim();
  if (kind === "product" && rawStock) {
    const n = Number(rawStock);
    if (!Number.isInteger(n) || n < 0) return { ok: false, error: "Stock should be a whole number, like 12", field: "stock" };
    stock = n;
  }
  return { ok: true, kind, category, title, priceUnit, priceCents, stock };
}
