import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { DIETS, type Diet } from "@/lib/types";
import { slugify } from "@/lib/util";

export const dynamic = "force-dynamic";

/** Public read-only search. The ChatGPT app (MCP server) will wrap this. */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const diet = p.getAll("diet").filter((d): d is Diet => DIETS.some((x) => x.id === d));
  const limit = Math.min(Number(p.get("limit")) || 20, 50);
  const rs = await getStore().searchRestaurants({
    q: p.get("q") ?? undefined,
    country: p.get("country")?.toUpperCase() || undefined,
    citySlug: p.get("city") ? slugify(p.get("city")!) : undefined,
    diet,
    limit,
  });
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin;
  return NextResponse.json({
    results: rs.map((r) => ({
      id: r.id, name: r.name, city: r.city, country: r.country, address: r.address, cuisines: r.cuisines, diets: r.diets,
      hasMenu: r.menu.length > 0,
      menuHighlights: r.menu.slice(0, 5).map((m) => ({ name: m.name, price: m.price, currency: m.currency, diets: m.diets, allergens: m.allergens })),
      url: `${base}/r/${r.id}`,
      messageUrl: r.whatsapp ? `${base}/go/${r.id}?src=chatgpt` : null,
    })),
  }, { headers: { "Access-Control-Allow-Origin": "*" } });
}
