import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getStore } from "@/lib/store";
import { currencyFor, menuToText } from "@/lib/menu-text";
import { claimReplyOwner, saveMyRestaurant } from "../../claim-actions";
import { RestaurantEditor } from "../../editor";

export const metadata: Metadata = { title: "Your restaurant", robots: { index: false } };
export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { new: "Received", verifying: "We're verifying", approved: "Approved", rejected: "Not approved" };

export default async function MyRestaurant({ searchParams }: { searchParams: Promise<{ sent?: string; saved?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser("/account/restaurant");
  const store = getStore();
  const [claims, mine] = await Promise.all([store.listClaimsByUser(user.uid), store.listMyRestaurants(user.uid)]);
  const threads = await Promise.all(claims.map((c) => store.listClaimMessages(c.id!)));

  return (
    <section className="hero">
      <h1>Your restaurant</h1>
      {sp.sent === "1" && <div className="notice">Claim received. We'll verify it and reply here.</div>}
      {sp.saved === "1" && <div className="notice">Saved. Your changes are live.</div>}
      {sp.saved?.startsWith("menu-") && <div className="notice">Profile saved, but the menu wasn't: {decodeURIComponent(sp.saved.slice(5))}</div>}

      {mine.map((r) => (
        <div key={r.id} style={{ marginBottom: 28 }}>
          <h2>{r.name}</h2>
          <p className="meta">
            Free trial{r.trialEndsAt ? ` until ${r.trialEndsAt.slice(0, 10)}` : ""} · <Link href={`/r/${r.id}`}>See your public page</Link> · {r.leadCount} {r.leadCount === 1 ? "customer has" : "customers have"} messaged you
          </p>
          <RestaurantEditor action={saveMyRestaurant} r={r} menuText={menuToText(r.menu)} currency={r.menu[0]?.currency ?? currencyFor(r.country)} />
        </div>
      ))}

      {claims.length === 0 && mine.length === 0 && <p>You haven't claimed a restaurant yet. Find yours on <Link href="/">Zood</Link> and tap <b>Claim it</b>, or <Link href="/list">add it</Link>.</p>}

      {claims.map((c, i) => (
        <div key={c.id} className="card" style={{ marginBottom: 14 }}>
          <h3>{c.restaurantName} <span className="tag gray">{STATUS[c.status ?? "new"]}</span></h3>
          <div className="meta">{c.city}, {c.country} · sent {c.createdAt.slice(0, 10)}</div>
          {threads[i].map((m) => (
            <p key={m.id} className="meta" style={{ whiteSpace: "pre-wrap", margin: "6px 0" }}><b>{m.fromAdmin ? "Zist team" : "You"}</b> · {m.createdAt.slice(0, 10)}<br />{m.body}</p>
          ))}
          {c.status !== "approved" && c.status !== "rejected" && (
            <form className="stack" action={claimReplyOwner}>
              <input type="hidden" name="claimId" value={c.id} />
              <label className="f">Message the team<textarea name="body" rows={2} required maxLength={2000} placeholder="Add proof or answer our questions." /></label>
              <button type="submit">Send</button>
            </form>
          )}
        </div>
      ))}
    </section>
  );
}
