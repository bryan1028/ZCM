import Link from "next/link";
import { DIETS, type Restaurant } from "@/lib/types";
import { regionName } from "@/lib/util";

const dietLabel = (id: string) => DIETS.find((d) => d.id === id)?.label ?? id;

export function RestaurantCard({ r, source = "web" }: { r: Restaurant; source?: string }) {
  return (
    <article className="card">
      <h3><Link href={`/r/${r.id}`}>{r.name}</Link></h3>
      <div className="meta">{[r.address, regionName(r.country)].filter(Boolean).join(" · ")}</div>
      <div>
        {r.diets.map((d) => <span key={d} className="tag">{dietLabel(d)}</span>)}
        {r.cuisines.slice(0, 2).map((c) => <span key={c} className="tag gray">{c}</span>)}
        {r.status === "unclaimed" && <span className="tag warn">Menu not added yet</span>}
      </div>
      <div style={{ marginTop: "auto", display: "flex", gap: 8 }}>
        <Link className="btn ghost" href={`/r/${r.id}`}>{r.menu.length ? "See menu" : "Details"}</Link>
        {r.whatsapp && <a className="btn wa" href={`/go/${r.id}?src=${source}`} rel="nofollow noopener" target="_blank">Message</a>}
      </div>
    </article>
  );
}

export function SearchForm({ defaults }: { defaults: { q?: string; city?: string; diet?: string[] } }) {
  return (
    <form className="search" action="/" method="get">
      <div className="row">
        <input type="text" name="city" placeholder="City (e.g. Nairobi)" defaultValue={defaults.city} aria-label="City" />
        <input type="text" name="q" placeholder="Dish or cuisine" defaultValue={defaults.q} aria-label="Dish or cuisine" />
        <button type="submit">Search</button>
      </div>
      <div className="chips">
        {DIETS.map((d) => (
          <label key={d.id}>
            <input type="checkbox" name="diet" value={d.id} defaultChecked={defaults.diet?.includes(d.id)} />
            <span>{d.label}</span>
          </label>
        ))}
      </div>
    </form>
  );
}

import type { PriceComparison } from "@/lib/types";
import { agoLabel } from "@/lib/prices";
import { formatPrice } from "@/lib/util";

export function PriceCard({ c }: { c: PriceComparison }) {
  return (
    <article className="card">
      <h3>{[c.brand, c.productName, c.size].filter(Boolean).join(" ")}</h3>
      {c.stores.length > 1 && c.savingsPct > 0 && <div className="meta">Save up to <b>{c.savingsPct}%</b> at {c.stores[0].storeName}</div>}
      <div style={{ display: "grid", gap: 6 }}>
        {c.stores.map((s) => (
          <div key={s.storeName} className="bar-row">
            <div className="bar-label">{s.storeName}</div>
            <div className="bar-track"><div className={s.isCheapest ? "bar cheapest" : "bar"} style={{ width: `${Math.max(18, (s.price / c.max) * 100)}%` }}>{formatPrice(s.price, c.currency)}</div></div>
            <div className="meta bar-age">{agoLabel(s.observedAt)}{s.source === "openprices" ? " · Open Prices" : s.by ? ` · @${s.by}` : ""}</div>
          </div>
        ))}
      </div>
    </article>
  );
}
