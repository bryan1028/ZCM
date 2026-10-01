import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@/lib/session";
import { getStore } from "@/lib/store";
import { regionName, slugify } from "@/lib/util";
import { supportRequestAction } from "../request-actions";

export const metadata: Metadata = {
  title: "Zummon a place",
  description: "Restaurants and stores the community wants on Zood and Zind. Back one, or zummon a new place.",
};
export const dynamic = "force-dynamic";

type SP = Promise<{ city?: string; kind?: string; done?: string }>;
const DONE: Record<string, string> = {
  created: "Zummoned! Your request is live with your signature on it.", supported: "Backed! Thanks for adding your voice.",
  already: "You've already backed this one.",
};

export default async function Requests({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const kind = sp.kind === "store" || sp.kind === "restaurant" ? sp.kind : undefined;
  const [user, rs] = await Promise.all([
    currentUser(),
    getStore().listRequests({ kind, citySlug: sp.city ? slugify(sp.city) : undefined, limit: 100 }),
  ]);
  const mine = user ? await getStore().supportedBy(user.uid, rs.map((r) => r.id)) : new Set<string>();
  const back = `/requests${sp.city ? `?city=${encodeURIComponent(sp.city)}` : ""}`;

  return (
    <>
      <section className="hero">
        <h1>Zummon a place ✨</h1>
        <p>Missing a restaurant or store? Zummon it. When enough people back a place, we go knock on their door and ask them to join.</p>
        <form className="search" action="/requests" method="get">
          <div className="row">
            <input type="text" name="city" placeholder="Any city" defaultValue={sp.city} aria-label="City" />
            <select name="kind" defaultValue={kind ?? ""} aria-label="Type"><option value="">Restaurants &amp; stores</option><option value="restaurant">Restaurants</option><option value="store">Stores</option></select>
            <button type="submit">Filter</button>
          </div>
        </form>
        <p style={{ marginTop: 14 }}><Link className="btn" href="/requests/new">✨ Zummon a place</Link></p>
      </section>
      {sp.done && DONE[sp.done] && <div className="notice">{DONE[sp.done]}</div>}
      {rs.length === 0 && <p className="meta">No requests yet{sp.city ? ` in ${sp.city}` : ""}. Be the first.</p>}
      <div className="grid">
        {rs.map((r) => (
          <article className="card" key={r.id}>
            <div className="req-row">
              <div>
                <span className="tag gray">{r.kind === "store" ? "Store" : "Restaurant"}</span>
                <h3>{r.name}</h3>
                <div className="meta">{r.city}, {regionName(r.country)}</div>
              </div>
              <div className="count"><b>{r.supportCount}</b><span className="meta">want it</span></div>
            </div>
            {r.note && <div className="meta">“{r.note}”</div>}
            <div className="meta">Requested by {r.createdBy.uid === "deleted" ? <span className="sig">@{r.createdBy.handle}</span> : <Link className="sig" href={`/u/${r.createdBy.handle}`}>@{r.createdBy.handle}</Link>}</div>
            {mine.has(r.id) ? <span className="tag">You're in 🙌</span> : user ? (
              <form action={supportRequestAction}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="returnTo" value={back} /><button type="submit">{r.kind === "store" ? "I'd shop there too" : "I'd eat there too"}</button></form>
            ) : (
              <Link className="btn ghost" href={`/login?next=${encodeURIComponent(back)}`}>Sign in to back this</Link>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
