import type { Metadata } from "next";
import { getStore } from "@/lib/store";
import { regionName } from "@/lib/util";
import { adminClaimAction } from "../claim-actions";
import { addDeal, setPriceStatus, setRequestStatusAction } from "../actions";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const countBy = <T,>(xs: T[], key: (x: T) => string) => {
  const m = new Map<string, number>();
  for (const x of xs) m.set(key(x), (m.get(key(x)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

export default async function Admin() {
  await requireAdmin();
  const store = getStore();
  const [leads, claims, prices, deals, profiles, requests, support] = await Promise.all([store.listLeads(1000), store.listClaims(50), store.listPrices(60), store.listDeals({ includeAll: true, limit: 30 }), store.listProfiles(20000), store.listRequests({ includeAll: true, limit: 500 }), store.listSupportMessages(30)]);
  const [claimRestaurants, claimThreads] = await Promise.all([
    Promise.all(claims.map((c) => (c.restaurantId ? store.getRestaurant(c.restaurantId) : Promise.resolve(null)))),
    Promise.all(claims.map((c) => (c.id ? store.listClaimMessages(c.id) : Promise.resolve([])))),
  ]);
  const day = Date.now() - 864e5;
  const week = Date.now() - 7 * 864e5;
  const since = (t: number) => leads.filter((l) => Date.parse(l.createdAt) >= t).length;
  const recent = leads.filter((l) => Date.parse(l.createdAt) >= Date.now() - 30 * 864e5);
  const byPlace = new Map<string, { id: string; name: string; city: string; country: string; asks: number; visitors: Set<string> }>();
  const byCity = new Map<string, { asks: number; places: Set<string> }>();
  for (const l of recent) {
    const e = byPlace.get(l.restaurantId) ?? { id: l.restaurantId, name: l.restaurantName, city: l.city, country: l.country, asks: 0, visitors: new Set<string>() };
    e.asks++; e.visitors.add(l.visitor); byPlace.set(l.restaurantId, e);
    const c = byCity.get(`${l.city}|${l.country}`) ?? { asks: 0, places: new Set<string>() };
    c.asks++; c.places.add(l.restaurantId); byCity.set(`${l.city}|${l.country}`, c);
  }
  const pitch = [...byPlace.values()].sort((a, b) => b.visitors.size - a.visitors.size || b.asks - a.asks).slice(0, 25)
    .map((p) => ({ ...p, people: p.visitors.size, cityAsks: byCity.get(`${p.city}|${p.country}`)?.asks ?? 0, cityPlaces: byCity.get(`${p.city}|${p.country}`)?.places.size ?? 0 }));
  const uniqueVisitors = new Set(leads.map((l) => l.visitor)).size;

  return (
    <section style={{ padding: "28px 0 56px" }}>
      <h1>Lead dashboard</h1>
      <p className="meta">A lead is one person tapping "I want to order here" (restaurants not on Zood yet: counted, never forwarded) or "Message" (restaurants that have joined: sent to their WhatsApp). Repeat taps by the same visitor within an hour and bots are not counted.</p>
      <div className="stats">
        <div className="stat"><b>{leads.length}</b>leads (last 1000)</div>
        <div className="stat"><b>{since(day)}</b>last 24h</div>
        <div className="stat"><b>{since(week)}</b>last 7 days</div>
        <div className="stat"><b>{uniqueVisitors}</b>unique visitors</div>
        <div className="stat"><b>{leads.filter((l) => l.source === "chatgpt").length}</b>from ChatGPT</div>
      </div>

      <h2 style={{ marginTop: 28 }}>Restaurants to pitch (real demand, last 30 days)</h2>
      <p className="meta">Only real numbers: people who tapped "I want to order here". Use the line in the last column when you contact a restaurant. Cities with more demand per listing make a stronger pitch.</p>
      <div className="table-scroll"><table>
        <thead><tr><th>Restaurant</th><th>City</th><th>Asks</th><th>People</th><th>Pitch line</th></tr></thead>
        <tbody>{pitch.map((p) => (
          <tr key={p.id}><td><a href={`/r/${p.id}`}>{p.name}</a></td><td>{p.city}, {p.country}</td><td>{p.asks}</td><td>{p.people}</td>
            <td className="meta">{`${p.people} ${p.people === 1 ? "person" : "people"} asked to order from ${p.name} on Zood in the last 30 days${p.cityAsks > p.asks ? `; across ${p.city}, ${p.cityAsks} orders were requested from ${p.cityPlaces} restaurants` : ""}. Claim your listing for a free trial to edit your profile and menu.`}</td></tr>
        ))}{!pitch.length && <tr><td colSpan={5} className="meta">No taps yet.</td></tr>}</tbody>
      </table></div>

      <h2 style={{ marginTop: 28 }}>Demand (your proof of concept)</h2>
      <div className="stats">
        <div className="stat"><b>{profiles.length}</b>accounts</div>
        <div className="stat"><b>{profiles.filter((p) => p.optIn).length}</b>opted in to email</div>
        <div className="stat"><b>{requests.length}</b>places requested</div>
        <div className="stat"><b>{requests.reduce((n, r) => n + r.supportCount, 0)}</b>total backings</div>
      </div>
      <p><a className="btn ghost" href="/admin/export?type=users">Download opted-in emails (CSV)</a> <a className="btn ghost" href="/admin/export?type=requests">Download requests (CSV)</a></p>
      <h3>Accounts by city</h3>
      <div className="table-scroll"><table>
        <thead><tr><th>City</th><th>Accounts</th><th>Opted in</th></tr></thead>
        <tbody>{[...profiles.reduce((m, p) => { const k = `${p.city || "(none)"}, ${p.country || "?"}`; const e = m.get(k) ?? { n: 0, o: 0 }; e.n++; if (p.optIn) e.o++; return m.set(k, e); }, new Map<string, { n: number; o: number }>())].sort((a, b) => b[1].n - a[1].n).slice(0, 15).map(([k, v]) => <tr key={k}><td>{k}</td><td>{v.n}</td><td>{v.o}</td></tr>)}</tbody>
      </table></div>
      <h3 style={{ marginTop: 20 }}>Most-wanted places</h3>
      <div className="table-scroll"><table>
        <thead><tr><th>Backers</th><th>Place</th><th>Type</th><th>By</th><th>Status</th><th></th></tr></thead>
        <tbody>{requests.slice(0, 40).map((r) => (
          <tr key={r.id}>
            <td>{r.supportCount}</td><td>{r.name} — {r.city}, {r.country}</td><td>{r.kind}</td><td>@{r.createdBy.handle}</td><td>{r.status}</td>
            <td>
              <form className="inline" action={setRequestStatusAction}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value={r.status === "hidden" ? "open" : "hidden"} /><button type="submit">{r.status === "hidden" ? "Unhide" : "Hide"}</button></form>{" "}
              {r.status !== "listed" && <form className="inline" action={setRequestStatusAction}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="listed" /><button type="submit">Mark listed</button></form>}
            </td>
          </tr>
        ))}</tbody>
      </table></div>

      <h2 id="support" style={{ marginTop: 28 }}>Inbox: support ({support.length})</h2>
      <div className="table-scroll"><table>
        <thead><tr><th>When</th><th>From</th><th>Message</th></tr></thead>
        <tbody>{support.map((m, i) => <tr key={m.id ?? i}><td>{m.createdAt.slice(0, 10)}</td><td><a href={`mailto:${m.email}`}>{m.email}</a>{m.userHandle ? ` (@${m.userHandle})` : ""}</td><td style={{ whiteSpace: "pre-wrap" }}>{m.message}</td></tr>)}</tbody>
      </table></div>

      <h2 style={{ marginTop: 28 }}>By restaurant</h2>
      <div className="table-scroll"><table>
        <thead><tr><th>Restaurant</th><th>Leads</th></tr></thead>
        <tbody>{countBy(leads, (l) => `${l.restaurantName} — ${l.city}, ${regionName(l.country)}`).slice(0, 30).map(([k, n]) => <tr key={k}><td>{k}</td><td>{n}</td></tr>)}</tbody>
      </table></div>

      <h2 style={{ marginTop: 28 }}>Recent leads</h2>
      <div className="table-scroll"><table>
        <thead><tr><th>When</th><th>Restaurant</th><th>Item</th><th>Via</th><th>Signed by</th><th>Source</th><th>Ref</th></tr></thead>
        <tbody>{leads.slice(0, 50).map((l, i) => (
          <tr key={l.id ?? i}><td>{l.createdAt.replace("T", " ").slice(0, 16)}</td><td>{l.restaurantName}</td><td>{l.itemName ?? ""}</td><td>{(l.channel ?? "whatsapp") === "whatsapp" ? "wants to order (WhatsApp)" : l.channel}</td><td>{l.userHandle ? `@${l.userHandle}` : "anonymous"}</td><td>{l.source}</td><td>{l.ref}</td></tr>
        ))}</tbody>
      </table></div>

      <h2 id="claims" style={{ marginTop: 28 }}>Inbox: restaurants ({claims.filter((c) => c.status === "new" || c.status === "verifying" || !c.status).length} open)</h2>
      <p className="meta">Verify before approving: call the restaurant on its <b>listed</b> number (not the claimant's), or check that the claimant's email domain matches the restaurant's website and the proof link shows them as owner. Approving starts a 90-day free trial and gives them the menu editor.</p>
      {claims.map((c, i) => {
        const r = claimRestaurants[i];
        const domain = c.email?.split("@")[1]?.toLowerCase();
        const siteHost = r?.website ? (() => { try { return new URL(r.website).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; } })() : "";
        const match = domain && siteHost && (siteHost === domain || siteHost.endsWith("." + domain) || domain.endsWith("." + siteHost));
        return (
          <div key={c.id ?? i} className="card" style={{ marginBottom: 12 }}>
            <h3>{c.restaurantName} <span className="tag gray">{c.status ?? "new"}</span> {c.restaurantId && <a className="meta" href={`/admin/restaurant/${encodeURIComponent(c.restaurantId)}`}>edit menu</a>}</h3>
            <div className="meta">{c.city}, {c.country} · {c.createdAt.slice(0, 10)}{c.restaurantId ? ` · listing: ${r?.status ?? "?"}` : " · no listing"}</div>
            <div className="meta">
              Claimant: <b>{c.contactName}</b> ({c.role ?? "?"}){c.userHandle ? ` @${c.userHandle}` : " (not signed in)"} ·{" "}
              {c.email && <a href={`mailto:${c.email}`}>{c.email}</a>} · <a href={`https://wa.me/${c.whatsapp}`} target="_blank" rel="noopener">+{c.whatsapp}</a>
            </div>
            <div className="meta">Listed contact: {r?.phone ? `+${r.phone}` : "no phone"} · {r?.website ? <a href={r.website} target="_blank" rel="noopener">{r.website}</a> : "no website"} · email/website domain match: <b>{match ? "yes" : "no"}</b></div>
            {c.proof && <div className="meta" style={{ whiteSpace: "pre-wrap" }}>Proof: {c.proof}</div>}
            {claimThreads[i].map((m) => <p key={m.id} className="meta" style={{ whiteSpace: "pre-wrap", margin: "4px 0" }}><b>{m.fromAdmin ? "Us" : "Them"}</b> · {m.createdAt.slice(0, 16).replace("T", " ")}<br />{m.body}</p>)}
            {c.id && c.status !== "approved" && (
              <form className="stack" action={adminClaimAction}>
                <input type="hidden" name="claimId" value={c.id} />
                <label className="f">Reply (shown to them on their account page)<textarea name="body" rows={2} maxLength={2000} /></label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="submit" name="op" value="reply">Send reply</button>
                  <button type="submit" name="op" value="verifying" className="ghost">Mark verifying</button>
                  <button type="submit" name="op" value="approve">Approve + start trial</button>
                  <button type="submit" name="op" value="reject" className="danger">Reject</button>
                </div>
              </form>
            )}
          </div>
        );
      })}
      {claims.length === 0 && <p className="meta">No claims yet.</p>}

      <h2 style={{ marginTop: 28 }}>Zist Find: price reports</h2>
      <p className="meta">{prices.filter((p) => p.status === "flagged").length} flagged for review. Flagged and hidden prices are not shown to the public.</p>
      <div className="table-scroll"><table>
        <thead><tr><th>When</th><th>Product</th><th>Store</th><th>Price</th><th>Src</th><th>Status</th><th></th></tr></thead>
        <tbody>{prices.map((p) => (
          <tr key={p.id}>
            <td>{p.createdAt.slice(0, 10)}</td><td>{[p.brand, p.productName, p.size].filter(Boolean).join(" ")}</td><td>{p.storeName}, {p.city}</td>
            <td>{p.currency} {p.price}</td><td>{p.source}</td><td>{p.status}</td>
            <td>
              <form className="inline" action={setPriceStatus}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="status" value={p.status === "ok" ? "hidden" : "ok"} /><button type="submit">{p.status === "ok" ? "Hide" : "Approve"}</button></form>
            </td>
          </tr>
        ))}</tbody>
      </table></div>

      <h2 style={{ marginTop: 28 }}>Zist Find: deals ({deals.length})</h2>
      <form className="stack" action={addDeal} style={{ marginBottom: 16 }}>
        <label className="f">Title<input type="text" name="title" required /></label>
        <label className="f">Store<input type="text" name="store" required /></label>
        <div style={{ display: "flex", gap: 10 }}>
          <label className="f" style={{ flex: 2 }}>City<input type="text" name="city" required /></label>
          <label className="f" style={{ flex: 1 }}>Country (2)<input type="text" name="country" required maxLength={2} /></label>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <label className="f" style={{ flex: 1 }}>Price<input type="text" name="price" inputMode="decimal" /></label>
          <label className="f" style={{ flex: 1 }}>Currency<input type="text" name="currency" maxLength={3} /></label>
          <label className="f" style={{ flex: 1 }}>% off<input type="text" name="discountPct" inputMode="numeric" /></label>
        </div>
        <label className="f">Valid until<input type="date" name="validUntil" required /></label>
        <label className="f">Link (optional)<input type="text" name="url" /></label>
        <button type="submit">Add deal</button>
      </form>
    </section>
  );
}