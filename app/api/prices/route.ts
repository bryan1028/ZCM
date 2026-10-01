import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { comparePrices } from "@/lib/prices";
import { slugify } from "@/lib/util";

export const dynamic = "force-dynamic";

/** Public read-only price comparison. The ChatGPT app wraps this. */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const q = p.get("q");
  if (!q) return NextResponse.json({ error: "q is required" }, { status: 400 });
  const points = await getStore().searchPrices({ q, citySlug: p.get("city") ? slugify(p.get("city")!) : undefined, country: p.get("country")?.toUpperCase() || undefined });
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin;
  return NextResponse.json({
    results: comparePrices(points).slice(0, 10),
    reportUrl: `${base}/find/report`,
    note: "Prices are crowd-reported and may be out of date; only prices from the last 120 days are included.",
  }, { headers: { "Access-Control-Allow-Origin": "*" } });
}
