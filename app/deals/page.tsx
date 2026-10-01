import type { Metadata } from "next";
import Link from "next/link";
import { getStore } from "@/lib/store";
import { formatPrice, slugify } from "@/lib/util";

export const metadata: Metadata = { title: "Deals near you", description: "Current supermarket and shop deals in your city." };
export const dynamic = "force-dynamic";

export default async function Deals({ searchParams }: { searchParams: Promise<{ city?: string }> }) {
  const { city } = await searchParams;
  const deals = await getStore().listDeals({ citySlug: city ? slugify(city) : undefined });
  return (
    <>
      <section className="hero">
        <h1>Deals</h1>
        <form className="search" action="/deals" method="get">
          <div className="row"><input type="text" name="city" placeholder="City (e.g. Nairobi)" defaultValue={city} aria-label="City" /><button type="submit">Filter</button></div>
        </form>
      </section>
      {deals.length === 0 && <p className="meta">No active deals{city ? ` in ${city}` : ""}. <Link href="/find">Compare prices instead</Link>.</p>}
      <div className="grid">
        {deals.map((d) => (
          <article className="card" key={d.id}>
            <div className="meta">{d.storeName} · {d.city}</div>
            <h3>{d.title}</h3>
            {d.description && <div className="meta">{d.description}</div>}
            <div>
              {d.discountPct && <span className="tag warn">{d.discountPct}% off</span>}
              {d.price != null && <span className="tag">{formatPrice(d.price, d.currency)}</span>}
              <span className="tag gray">until {d.validUntil}</span>
            </div>
            {d.url && <a href={d.url} rel="nofollow noopener" target="_blank">View offer →</a>}
          </article>
        ))}
      </div>
    </>
  );
}
