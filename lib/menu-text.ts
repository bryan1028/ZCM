import { randomUUID } from "node:crypto";
import { DIETS, type Diet, type MenuItem } from "./types";

const CURRENCY: Record<string, string> = {
  AE: "AED", AR: "ARS", AU: "AUD", BD: "BDT", BR: "BRL", CA: "CAD", CO: "COP", DE: "EUR", EG: "EGP", ES: "EUR", ET: "ETB", FR: "EUR", GB: "GBP", GH: "GHS",
  ID: "IDR", IN: "INR", IT: "EUR", JP: "JPY", KE: "KES", KR: "KRW", MA: "MAD", MX: "MXN", MY: "MYR", NG: "NGN", NL: "EUR", PE: "PEN", PH: "PHP", PK: "PKR",
  RW: "RWF", SA: "SAR", SG: "SGD", TH: "THB", TR: "TRY", TZ: "TZS", UG: "UGX", US: "USD", ZA: "ZAR",
};
export const currencyFor = (country: string) => CURRENCY[country.toUpperCase()] ?? "USD";

/**
 * One dish per line: `Name | price | description | diets | allergens`. Only the name is required.
 * diets: comma list of DIETS ids (e.g. vegan, halal). allergens: comma list the dish CONTAINS (e.g. nuts, dairy).
 */
export function parseMenuText(text: string, currency: string): { items: MenuItem[]; errors: string[] } {
  const items: MenuItem[] = []; const errors: string[] = [];
  const cur = /^[A-Za-z]{3}$/.test(currency) ? currency.toUpperCase() : "USD";
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 200);
  lines.forEach((line, i) => {
    const [name, price, description, diets, allergens] = line.split("|").map((x) => x.trim());
    if (!name) return;
    let p: number | undefined;
    if (price) { p = Number(price.replace(/[^0-9.]/g, "")); if (!Number.isFinite(p) || p <= 0) { errors.push(`Line ${i + 1}: "${price}" isn't a price`); p = undefined; } }
    const d = (diets ?? "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
    const bad = d.filter((x) => !DIETS.some((t) => t.id === x));
    if (bad.length) errors.push(`Line ${i + 1}: unknown diet ${bad.join(", ")}`);
    items.push({
      id: randomUUID().slice(0, 8), name: name.slice(0, 80), description: description ? description.slice(0, 200) : undefined, price: p, currency: cur,
      diets: d.filter((x): x is Diet => DIETS.some((t) => t.id === x)),
      allergens: (allergens ?? "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean).slice(0, 12),
    });
  });
  return { items, errors };
}

/** Inverse of parseMenuText, to prefill the editor. */
export const menuToText = (menu: MenuItem[]) =>
  menu.map((m) => [m.name, m.price ?? "", m.description ?? "", m.diets.join(","), m.allergens.join(",")].join(" | ").replace(/( \| )+$/, "")).join("\n");
