import type { Diet, MenuItem, Restaurant } from "./types";

/** Allergens people can ask to avoid (same list the old Zist used). */
export const ALLERGENS = ["dairy", "gluten", "nuts", "shellfish", "fish", "soy", "eggs", "sesame"] as const;

export interface DishQuery {
  q?: string;
  diets?: Diet[];
  /** Hide dishes whose declared allergens include any of these. */
  avoid?: string[];
}

export interface DishHit {
  restaurantId: string;
  restaurantName: string;
  city: string;
  country: string;
  address?: string;
  cuisines: string[];
  /** True when the restaurant has a WhatsApp number on file, so "Message to order" works. */
  canMessage: boolean;
  /** Restaurant hasn't joined Zood: the button records interest instead of opening WhatsApp. */
  unclaimed: boolean;
  item: MenuItem;
  score: number;
}

const norm = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function queryWords(q?: string): string[] {
  return norm(q ?? "").split(/[^a-z0-9]+/).filter((w) => w.length > 1);
}

/**
 * Flatten restaurants into individual dishes and keep the ones that match.
 * Every query word must appear somewhere (dish name, description, cuisine or restaurant name);
 * dish-name matches rank above description matches, which rank above cuisine/restaurant matches.
 * `avoid` only removes dishes that DECLARE one of those allergens; a dish with no declared allergens is
 * not proof it is safe, and the UI never says so.
 */
export function flattenDishes(rs: Restaurant[], o: DishQuery): DishHit[] {
  const words = queryWords(o.q);
  const avoid = (o.avoid ?? []).map(norm);
  const out: DishHit[] = [];
  for (const r of rs) {
    if (r.status !== "active" && r.status !== "unclaimed") continue;
    for (const m of r.menu) {
      if (o.diets?.length && !o.diets.every((d) => m.diets.includes(d))) continue;
      if (avoid.length && m.allergens.some((a) => avoid.includes(norm(a)))) continue;
      let score = 0;
      if (words.length) {
        const name = norm(m.name), desc = norm(m.description ?? ""), ctx = norm([r.name, ...r.cuisines].join(" "));
        let ok = true;
        for (const w of words) {
          if (name.includes(w)) score += name.split(/[^a-z0-9]+/).includes(w) ? 4 : 3;
          else if (desc.includes(w)) score += 2;
          else if (ctx.includes(w)) score += 1;
          else { ok = false; break; }
        }
        if (!ok) continue;
      }
      out.push({
        restaurantId: r.id, restaurantName: r.name, city: r.city, country: r.country, address: r.address, cuisines: r.cuisines,
        canMessage: r.status === "unclaimed" || Boolean(r.whatsapp), unclaimed: r.status === "unclaimed", item: m, score,
      });
    }
  }
  return out.sort((a, b) => b.score - a.score || Number(b.canMessage) - Number(a.canMessage) || (a.item.price ?? 1e12) - (b.item.price ?? 1e12) || a.item.name.localeCompare(b.item.name));
}

const EMOJI: Record<string, string> = {
  indian: "🍛", italian: "🍝", japanese: "🍱", korean: "🥢", thai: "🍜", chinese: "🥡", cafe: "☕", african: "🥘", kenyan: "🍖",
  mediterranean: "🫒", mexican: "🌮", american: "🍔", seafood: "🦞", steakhouse: "🥩", ethiopian: "🍲", lebanese: "🥙", vegan: "🥗",
  pizza: "🍕", burger: "🍔", sushi: "🍣", bakery: "🥐", dessert: "🍰",
};
export const dishEmoji = (cuisines: string[], name = ""): string => {
  const hay = [...cuisines, ...queryWords(name)].map(norm);
  for (const h of hay) for (const k of Object.keys(EMOJI)) if (h.includes(k)) return EMOJI[k];
  return "🍽️";
};

/** Search words for a restaurant: its name, cuisines and dish names. Stored on the doc so Firestore can match text without scanning. */
export function restaurantTokens(r: Pick<Restaurant, "name" | "cuisines" | "menu">): string[] {
  const words = new Set<string>();
  const add = (t: string) => queryWords(t).forEach((w) => words.add(w));
  add(r.name); r.cuisines.forEach(add); r.menu.forEach((m) => add(m.name));
  return [...words].slice(0, 60);
}
