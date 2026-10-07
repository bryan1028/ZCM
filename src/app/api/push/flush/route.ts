import { NextResponse, type NextRequest } from "next/server";
import { flushPendingPushes } from "@/lib/push";

// Optional: hit this from a scheduler to deliver notifications created by database jobs (e.g. expiry).
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await flushPendingPushes();
  return NextResponse.json({ ok: true });
}
