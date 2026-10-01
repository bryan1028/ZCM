import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { shortRef } from "@/lib/util";
import type { LeadSource } from "@/lib/types";

export const dynamic = "force-dynamic";

const BOT = /bot|crawler|spider|preview|facebookexternalhit|slurp|whatsapp|curl|wget|headless/i;
const SOURCES: LeadSource[] = ["web", "chatgpt"];
const DEDUPE_SECONDS = 60 * 60;

/**
 * Click-to-chat redirect. Logging happens here on the server (not in the browser),
 * so counts can't be inflated by editing client code, and link previews/bots are skipped.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = getStore();
  const r = await store.getRestaurant(id);
  if (!r || !r.whatsapp || (r.status !== "active" && r.status !== "unclaimed")) {
    return NextResponse.redirect(new URL("/", req.url), 302);
  }

  const itemId = req.nextUrl.searchParams.get("item") ?? undefined;
  const item = itemId ? r.menu.find((m) => m.id === itemId) : undefined;
  const srcParam = req.nextUrl.searchParams.get("src") as LeadSource;
  const source: LeadSource = SOURCES.includes(srcParam) ? srcParam : "unknown";

  const visitor = req.cookies.get("zv")?.value ?? crypto.randomUUID();
  const dedupeKey = `zl_${id}`;
  const recent = req.cookies.get(dedupeKey)?.value;
  const isBot = BOT.test(req.headers.get("user-agent") ?? "");
  const ref = recent ?? shortRef();

  if (!isBot && !recent) {
    try {
      await store.recordLead({
        restaurantId: r.id,
        restaurantName: r.name,
        country: r.country,
        city: r.city,
        itemId: item?.id,
        itemName: item?.name,
        source,
        ref,
        visitor,
        createdAt: new Date().toISOString(),
      });
    } catch (e) {
      // Never block the user from reaching the restaurant because logging failed.
      console.error("lead log failed", e);
    }
  }

  const text = `Hi ${r.name}! I found you on Zist (ref ${ref}).` + (item ? ` I'm interested in the ${item.name}.` : "");
  const res = NextResponse.redirect(`https://wa.me/${r.whatsapp}?text=${encodeURIComponent(text)}`, 302);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  res.cookies.set("zv", visitor, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365, path: "/" });
  if (!recent) res.cookies.set(dedupeKey, ref, { httpOnly: true, sameSite: "lax", maxAge: DEDUPE_SECONDS, path: "/" });
  return res;
}
