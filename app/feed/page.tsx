import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getStore } from "@/lib/store";
import { agoLabel } from "@/lib/prices";
import { formatPrice } from "@/lib/util";

export const metadata: Metadata = { title: "Your feed", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Feed() {
  const me = await requireUser("/feed");
  const store = getStore();
  const people = await store.following(me.uid);
  const byUid = new Map(people.map((p) => [p.uid, p.handle]));
  const { requests, prices } = await store.activityBy(people.map((p) => p.uid));
  type Item = { at: string; node: React.ReactNode };
  const items: Item[] = [
    ...requests.map((r): Item => ({ at: r.createdAt, node: <><Link href={`/u/${r.createdBy.handle}`} className="sig">@{r.createdBy.handle}</Link> requested <b>{r.name}</b> in {r.city} · {r.supportCount} want this</> })),
    ...prices.map((p): Item => ({ at: p.createdAt, node: <><Link href={`/u/${p.reporterHandle ?? byUid.get(p.reporter ?? "") ?? ""}`} className="sig">@{p.reporterHandle ?? byUid.get(p.reporter ?? "")}</Link> saw <b>{p.productName}</b> for {formatPrice(p.price, p.currency)} at {p.storeName}</> })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30);

  return (
    <section className="hero">
      <h1>Your feed</h1>
      <p className="meta">What the {people.length} {people.length === 1 ? "person" : "people"} you follow have added.</p>
      {people.length === 0 && <div className="notice">You're not following anyone yet. Open a username on any request to find people to follow, then come back here.</div>}
      {items.map((it, i) => <p key={i} style={{ borderTop: "1px solid var(--border)", padding: "10px 0", margin: 0 }}>{it.node} <span className="meta">· {agoLabel(it.at)}</span></p>)}
      {people.length > 0 && items.length === 0 && <p className="meta">Nothing new yet.</p>}
    </section>
  );
}
