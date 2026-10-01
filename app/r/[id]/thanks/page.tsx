import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getStore } from "@/lib/store";
import { currentUser } from "@/lib/session";
import { VisionStory } from "@/app/vision";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Noted: you want to order here", robots: { index: false, follow: false } };

export default async function Thanks({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ d?: string }> }) {
  const { id } = await params;
  const { d } = await searchParams;
  const r = await getStore().getRestaurant(id);
  if (!r || (r.status !== "active" && r.status !== "unclaimed")) notFound();
  const user = await currentUser();
  const dish = (d ?? "").slice(0, 200);

  return (
    <section className="theme-zood" style={{ padding: "28px 0 56px", maxWidth: 640 }}>
      <h1>You want to order from {r.name} 🙋</h1>
      <p>
        Noted{dish ? <>: <b>{dish}</b></> : ""}. {r.name} hasn't joined Zood yet, so we haven't messaged them and they haven't seen this.
        What happens next: we count it, and when enough people ask, we invite them to join, with your request as the reason.
        {r.leadCount > 1 ? <> You're one of <b>{r.leadCount}</b> people who've asked for them so far.</> : null}
      </p>
      <VisionStory product="zood" />
      <p style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {user
          ? <span className="meta">We'll let you know at your account email when {r.name} (or somewhere nearby) goes live.</span>
          : <Link className="btn" href="/signup">Sign up so we can tell you when they're live</Link>}
        <Link className="btn ghost" href="/requests/new">Zummon another place</Link>
        <Link className="btn ghost" href={`/?city=${encodeURIComponent(r.city)}`}>Back to {r.city}</Link>
      </p>
    </section>
  );
}
