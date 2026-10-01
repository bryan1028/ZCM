import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { currentUser } from "@/lib/session";
import { shortRef } from "@/lib/util";
import type { LeadChannel, LeadSource } from "@/lib/types";

export const dynamic = "force-dynamic";

const BOT = /bot|crawler|spider|preview|facebookexternalhit|slurp|whatsapp|curl|wget|headless/i;
const SOURCES: LeadSource[] = ["web", "chatgpt"];
const DEDUPE_SECONDS = 60 * 60;

/**
 * Tracked contact link. ?mode=whatsapp (default) | call | website. Logging happens here on the server (not in the
 * browser), so counts can't be inflated by editing client code, and link previews/bots are skipped.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = getStore();
  const r = await store.getRestaurant(id);
  const mode = req.nextUrl.searchParams.get("mode");
  const channel: LeadChannel = mode === "call" ? "call" : mode === "website" ? "website" : "whatsapp";
  const home = () => NextResponse.redirect(new URL("/", req.url), 302);
  if (!r || (r.status !== "active" && r.status !== "unclaimed")) return home();

  let target: string | undefined;
  let text = "";
  const unclaimed = r.status === "unclaimed";
  const picked = channel === "whatsapp"
    ? [...new Set(req.nextUrl.searchParams.getAll("item"))].slice(0, 12).map((iid) => r.menu.find((m) => m.id === iid)).filter((m): m is NonNullable<typeof m> => Boolean(m))
    : [];
  if (unclaimed) {
    // Not on Zood yet: never hand out their contact details. Send people to the claim page instead.
    return NextResponse.redirect(new URL(`/list?claim=${encodeURIComponent(r.id)}`, req.url), 302);
  } else if (channel === "whatsapp" && r.whatsapp) {
    // We can't run orders yet, so a WhatsApp tap is an explicit order request: counted as a lead, signed with the
    // person's @handle when they're signed in, and phrased so the restaurant knows exactly what is being asked.
    const ask = picked.length === 1 ? `I'd like to order the ${picked[0].name}.` : picked.length > 1 ? `I'd like to order: ${picked.map((m) => m.name).join(", ")}.` : "I'd like to order from you.";
    text = `Hi ${r.name}! ${ask} (via Zood, ref REF)`;
  } else if (channel === "call" && r.phone) {
    target = `tel:+${r.phone}`;
  } else if (channel === "website" && r.website && /^https?:\/\//i.test(r.website)) {
    target = r.website;
  }
  if (!target && !(channel === "whatsapp" && r.whatsapp)) return home();

  const srcParam = req.nextUrl.searchParams.get("src") as LeadSource;
  const source: LeadSource = SOURCES.includes(srcParam) ? srcParam : "unknown";
  const visitor = req.cookies.get("zv")?.value ?? crypto.randomUUID();
  const dedupeKey = `zl_${id}_${channel}`;
  const recent = req.cookies.get(dedupeKey)?.value;
  const isBot = BOT.test(req.headers.get("user-agent") ?? "");
  const ref = recent ?? shortRef();
  const user = await currentUser();

  if (!isBot && !recent) {
    try {
      await store.recordLead({
        restaurantId: r.id, restaurantName: r.name, country: r.country, city: r.city,
        itemId: picked.length ? picked.map((m) => m.id).join(",").slice(0, 200) : undefined,
        itemName: picked.length ? picked.map((m) => m.name).join(", ").slice(0, 300) : undefined,
        source, channel, ref, visitor, userId: user?.uid, userHandle: user?.handle, createdAt: new Date().toISOString(),
      });
    } catch (e) {
      // Never block the user from reaching the restaurant because logging failed.
      console.error("lead log failed", e);
    }
  }

  const signed = user ? `${text.replace("REF", ref)}\n— @${user.handle} on Zood` : text.replace("REF", ref);
  const dest = target ?? `https://wa.me/${r.whatsapp}?text=${encodeURIComponent(signed)}`;
  const res = NextResponse.redirect(dest, 302);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  res.cookies.set("zv", visitor, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365, path: "/" });
  if (!recent) res.cookies.set(dedupeKey, ref, { httpOnly: true, sameSite: "lax", maxAge: DEDUPE_SECONDS, path: "/" });
  return res;
}
