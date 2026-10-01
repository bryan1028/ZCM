import type { Store } from "./store";
import { formatPrice } from "./util";

export interface TickerItem { emoji: string; label: string; countries: { country: string; text: string }[] }

const STAPLES = [
  { q: "milk", label: "Milk", emoji: "🥛", match: "\\mmilk\\M", reject: "chocolate|coconut|almond|oat|soy|condensed|powder|shake|baby|formula|cheese|biscuit|bar\\M" },
  { q: "eggs", label: "Eggs", emoji: "🥚", match: "\\meggs?\\M", reject: "chocolate|noodle|plant|mayo|pasta|nog" },
  { q: "bread", label: "Bread", emoji: "🍞", match: "\\mbread\\M", reject: "crumb|stick|sauce|spread" },
  { q: "rice", label: "Rice", emoji: "🍚", match: "\\mrice\\M", reject: "cake|cracker|noodle|milk|pudding|crisp|vinegar|bar\\M|flour|cooker" },
  { q: "banana", label: "Bananas", emoji: "🍌", match: "\\mbananas?\\M", reject: "chip|bread|milk|cake|yogurt|yoghurt|bar\\M|flavou?r|dried|puree" },
  { q: "sugar", label: "Sugar", emoji: "🍬", match: "\\msugar\\M", reject: "free|candy|sweetener|cereal|syrup|chocolate|cookie|biscuit|snap|pop|drink|cola|soda" },
  { q: "butter", label: "Butter", emoji: "🧈", match: "\\mbutter\\M", reject: "peanut|nut|cookie|biscuit|popcorn|bean|cup|cream|shea|almond|chocolate|body" },
  { q: "olive oil", label: "Olive oil", emoji: "🫒", match: "olive oil", reject: "spray|soap|sardine|tuna|olives|dressing" },
];

let cache: { at: number; items: TickerItem[] } | undefined;

/** Everyday groceries with the typical shelf price seen in each country (median of what people reported). Cached for 10 minutes per server. */
export async function groceryTicker(store: Pick<Store, "priceMedians">): Promise<TickerItem[]> {
  if (cache && Date.now() - cache.at < 10 * 60_000) return cache.items;
  const items: TickerItem[] = [];
  const results = await Promise.all(STAPLES.map((s) => store.priceMedians(s.match, s.reject, 5).catch(() => [])));
  STAPLES.forEach((s, i) => {
    const countries = results[i].map((m) => ({ country: m.country, text: formatPrice(Math.round(m.median * 100) / 100, m.currency) }));
    if (countries.length >= 2) items.push({ emoji: s.emoji, label: s.label, countries });
  });
  if (items.length) cache = { at: Date.now(), items };
  return items;
}

export const flag = (cc: string) => String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));
