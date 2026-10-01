import type { Metadata } from "next";
import { getStore } from "@/lib/store";
import { regionName } from "@/lib/util";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const countBy = <T,>(xs: T[], key: (x: T) => string) => {
  const m = new Map<string, number>();
  for (const x of xs) m.set(key(x), (m.get(key(x)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

export default async function Admin() {
  const store = getStore();
  const [leads, claims] = await Promise.all([store.listLeads(1000), store.listClaims(50)]);
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

      <h2>By restaurant</h2>
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
    </section>
  );
}
