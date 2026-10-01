import { restaurantTokens } from "./dishes";
import { DIETS, type Diet, type Restaurant } from "./types";
import { normalizeWhatsapp, slugify } from "./util";

/** One line of data/overture-places.jsonl as written by scripts/overture_extract.py. */
export interface PlaceRow {
  id: string; name: string; country: string; city: string; address?: string | null; lat?: number; lon?: number;
  phone?: string | null; whatsapp?: string | null; website?: string | null; cuisines?: string[]; diets?: string[]; rank?: number;
}

const safeUrl = (u?: string | null): string | undefined => {
  if (!u) return undefined;
  try { const x = new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`); return x.protocol === "https:" || x.protocol === "http:" ? x.toString().slice(0, 300) : undefined; } catch { return undefined; }
};

/** Map one extracted place to a listing. Returns null if it isn't usable (no name/city/country or no way to reach it). */
export function placeToRestaurant(p: PlaceRow): (Omit<Restaurant, "id">) | null {
  const name = (p.name ?? "").trim().slice(0, 120);
  const city = (p.city ?? "").trim();
  if (!p.id || !name || !city || !/^[A-Za-z]{2}$/.test(p.country ?? "")) return null;
  const phone = normalizeWhatsapp(p.phone ? `+${p.phone}` : null); // digits only, 8-15 long
  const website = safeUrl(p.website);
  if (!phone && !website) return null;
  const diets = (p.diets ?? []).filter((d): d is Diet => DIETS.some((x) => x.id === d));
  const base: Omit<Restaurant, "id"> = {
    name, country: p.country.toUpperCase(), city, citySlug: slugify(city), address: p.address?.trim().slice(0, 200) || undefined,
    lat: typeof p.lat === "number" ? p.lat : undefined, lng: typeof p.lon === "number" ? p.lon : undefined,
    // WhatsApp only when the extractor judged it a WhatsApp-capable mobile; never copy a landline into it.
    whatsapp: p.whatsapp ? normalizeWhatsapp(`+${p.whatsapp}`) : null, phone, website,
    cuisines: (p.cuisines ?? []).map((c) => c.trim().toLowerCase()).filter(Boolean).slice(0, 3), diets, menu: [],
    status: "unclaimed", source: "overture", sourceId: p.id, plan: "free", leadCount: 0, rank: typeof p.rank === "number" ? Math.min(Math.max(p.rank, 0), 1.2) : 0.5,
    createdAt: new Date().toISOString(),
  };
  return { ...base, tokens: restaurantTokens(base) };
}
