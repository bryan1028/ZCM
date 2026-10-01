import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Who is signed in? Lets cached pages show a signed-in header without becoming dynamic themselves. */
export async function GET() {
  const u = await currentUser();
  return NextResponse.json({ handle: u?.handle ?? null }, { headers: { "Cache-Control": "private, no-store" } });
}
