import { headers } from "next/headers";

export interface Place { city?: string; country?: string }

/**
 * Coarse location from the request (city + country only, from the host's IP lookup). Used ONLY to prefill the
 * "where?" box; it is never stored, and the user can change it or clear it to search the whole world.
 */
export async function detectPlace(): Promise<Place> {
  try {
    const h = await headers();
    const nf = h.get("x-nf-geo"); // Netlify: base64 JSON
    if (nf) {
      const g = JSON.parse(Buffer.from(nf, "base64").toString("utf8")) as { city?: string; country?: { code?: string } };
      return { city: g.city || undefined, country: g.country?.code?.toUpperCase() };
    }
    const dec = (v: string | null) => (v ? decodeURIComponent(v) : undefined);
    const city = dec(h.get("x-vercel-ip-city")) ?? dec(h.get("cf-ipcity"));
    const country = (h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry") ?? h.get("x-country") ?? "").toUpperCase();
    return { city: city || undefined, country: /^[A-Z]{2}$/.test(country) ? country : undefined };
  } catch {
    return {};
  }
}
