import type { Metadata } from "next";
import { getStore } from "@/lib/store";
import { regionName } from "@/lib/util";
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
  const day = Date.now() - 864e5;
  const week = Date.now() - 7 * 864e5;
  const since = (t: number) => leads.filter((l) => Date.parse(l.createdAt) >= t).length;
  const uniqueVisitors = new Set(leads.map((l) => l.visitor)).size;

  return (
    <section style={{ padding: "28px 0 56px" }}>
      <h1>Lead dashboard</h1>
      <p className="meta">A lead is one person tapping "Message" and being sent to the restaurant's WhatsApp. Repeat taps by the same visitor within an hour and bots are not counted. Confirmed conversations can be matched by the <b>ref</b> code in the restaurant's chat.</p>
      <div className="stats">
        <div className="stat"><b>{leads.length}</b>leads (last 1000)</div>
        <div className="stat"><b>{since(day)}</b>last 24h</div>
        <div className="stat"><b>{since(week)}</b>last 7 days</div>
        <div className="stat"><b>{uniqueVisitors}</b>unique visitors</div>
        <div className="stat"><b>{leads.filter((l) => l.source === "chatgpt").length}</b>from ChatGPT</div>
      </div>

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

      <h2 style={{ marginTop: 28 }}>Support messages ({support.length})</h2>
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
        <thead><tr><th>When</th><th>Restaurant</th><th>Item</th><th>Source</th><th>Ref</th></tr></thead>
        <tbody>{leads.slice(0, 50).map((l, i) => (
          <tr key={l.id ?? i}><td>{l.createdAt.replace("T", " ").slice(0, 16)}</td><td>{l.restaurantName}</td><td>{l.itemName ?? ""}</td><td>{l.source}</td><td>{l.ref}</td></tr>
        ))}</tbody>
      </table></div>

      <h2 style={{ marginTop: 28 }}>Claims &amp; new listings to verify</h2>
      <div className="table-scroll"><table>
        <thead><tr><th>When</th><th>Restaurant</th><th>Contact</th><th>WhatsApp</th></tr></thead>
        <tbody>{claims.map((c, i) => (
          <tr key={c.id ?? i}>
            <td>{c.createdAt.slice(0, 10)}</td><td>{c.restaurantName} — {c.city}, {c.country}{c.restaurantId ? " (claim)" : " (new)"}</td><td>{c.contactName}</td>
            <td><a href={`https://wa.me/${c.whatsapp}`} target="_blank" rel="noopener">+{c.whatsapp}</a></td>
          </tr>
        ))}</tbody>
      </table></div>

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