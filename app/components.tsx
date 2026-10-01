import Link from "next/link";
import { DIETS, type PriceComparison, type Restaurant } from "@/lib/types";
import { dishEmoji, type DishHit } from "@/lib/dishes";
import { agoLabel, displayName } from "@/lib/prices";
import { formatPrice, regionName } from "@/lib/util";

const dietLabel = (id: string) => DIETS.find((d) => d.id === id)?.label ?? id;
const MSG = "Message to order";

/** A single dish, front and centre: what it is, what it costs, what's in it, and one tap to ask for it on WhatsApp. */
export function DishCard({ h }: { h: DishHit }) {
  const m = h.item;
  return (
    <article className="card dish">
      <div className="dish-top">
        <div className="dish-emoji" aria-hidden>{dishEmoji(h.cuisines, m.name)}</div>
        <div className="dish-body">
          <h3>{m.name}</h3>
          <div className="meta"><Link href={`/r/${h.restaurantId}`}>{h.restaurantName}</Link> · {h.city}, {regionName(h.country)}</div>
        </div>
      </div>
      {m.description && <div className="meta">{m.description}</div>}
      <div>
        {m.diets.map((d) => <span key={d} className="tag">{dietLabel(d)}</span>)}
        {m.allergens.length > 0 ? m.allergens.map((a) => <span key={a} className="tag warn">has {a}</span>) : <span className="tag gray">no allergens listed</span>}
      </div>
      <div className="dish-priceline">
        {m.price != null && <span className="dish-price">{formatPrice(m.price, m.currency)}</span>}
        <div className="dish-actions">
          {h.canMessage
            ? <a className="btn wa" href={`/go/${h.restaurantId}?item=${encodeURIComponent(m.id)}&src=web`} rel="nofollow noopener" target="_blank">💬 {MSG}</a>
            : <span className="meta">Not on WhatsApp yet</span>}
          <Link className="btn ghost sm" href={`/r/${h.restaurantId}`}>Pick more</Link>
        </div>
      </div>
    </article>
  );
}

export function RestaurantCard({ r, source = "web" }: { r: Restaurant; source?: string }) {
  return (
    <article className="card">
      <h3><Link href={`/r/${r.id}`}>{r.name}</Link></h3>
      <div className="meta">{[r.address, `${r.city}, ${regionName(r.country)}`].filter(Boolean).join(" · ")}</div>
      <div>
        {r.diets.map((d) => <span key={d} className="tag">{dietLabel(d)}</span>)}
        {r.cuisines.slice(0, 2).map((c) => <span key={c} className="tag gray">{c}</span>)}
        {r.status === "unclaimed" && <span className="tag warn">menu coming soon</span>}
      </div>
      <div style={{ marginTop: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link className="btn ghost sm" href={`/r/${r.id}`}>{r.menu.length ? "See the menu" : "Details"}</Link>
        <ContactButtons r={r} source={source} compact />
      </div>
    </article>
  );
}

/** Message (WhatsApp) when we have a WhatsApp number, otherwise Call; plus Website. All three are tracked links. */
export function ContactButtons({ r, source = "web", compact = false }: { r: Pick<Restaurant, "id" | "whatsapp" | "phone" | "website">; source?: string; compact?: boolean }) {
  const cls = compact ? " sm" : "";
  return (
    <>
      {r.whatsapp && <a className={`btn wa${cls}`} href={`/go/${r.id}?src=${source}`} rel="nofollow noopener" target="_blank">💬 Message</a>}
      {r.phone && <a className={`btn ghost${cls}`} href={`/go/${r.id}?mode=call&src=${source}`} rel="nofollow">📞 Call</a>}
      {r.website && <a className={`btn ghost${cls}`} href={`/go/${r.id}?mode=website&src=${source}`} rel="nofollow noopener" target="_blank">🌐 Website</a>}
    </>
  );
}

/** One item, priced at every store that has been seen with it, cheapest in green. */
export function PriceCard({ c }: { c: PriceComparison }) {
  return (
    <article className="card">
      <div className="req-row">
        <div>
          <h3>{displayName(c)}</h3>
          <div className="meta">📍 {c.city}, {regionName(c.country)}</div>
        </div>
        <div className="count"><b>{formatPrice(c.min, c.currency)}</b><span className="meta">{c.stores.length > 1 ? "lowest" : "only seen"}</span></div>
      </div>
      {c.stores.length > 1 && c.savingsPct > 0 && <div className="meta">Buy at <b>{c.stores[0].storeName}</b> and save up to <b>{c.savingsPct}%</b></div>}
      {c.stores.length === 1 && <div className="meta">Only one store has been sniffed so far. <Link href="/find/report">Add another price</Link></div>}
      <div style={{ display: "grid", gap: 6 }}>
        {c.stores.map((s) => (
          <div key={s.storeName} className="bar-row">
            <div className="bar-label">{s.storeName}</div>
            <div className="bar-track"><div className={s.isCheapest && c.stores.length > 1 ? "bar cheapest" : "bar"} style={{ width: `${Math.max(18, (s.price / c.max) * 100)}%` }}>{formatPrice(s.price, c.currency)}</div></div>
            <div className="meta bar-age">{agoLabel(s.observedAt)}{s.source === "openprices" ? " · Open Prices" : s.by ? ` · @${s.by}` : ""}</div>
          </div>
        ))}
      </div>
    </article>
  );
}
