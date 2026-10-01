import { NextResponse } from "next/server";
import { detectPlace } from "@/lib/geo";

export const dynamic = "force-dynamic";

/** The caller's own coarse place (city/country), for prefilling forms. Nothing is stored. */
export async function GET() {
  return NextResponse.json(await detectPlace(), { headers: { "Cache-Control": "private, no-store" } });
}
