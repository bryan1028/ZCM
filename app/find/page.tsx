import type { Metadata } from "next";
import Link from "next/link";
import { getStore } from "@/lib/store";
import { comparePrices } from "@/lib/prices";
import { slugify } from "@/lib/util";
import { PriceCard } from "../components";

export const metadata: Metadata = {
  title: "Compare grocery prices near you",
  description: "Search any product and see its price at each store in your city, reported by shoppers.",
};
export const dynamic = "force-dynamic";

type SP = Promise<{ q?: string; city?: string; country?: string; thanks?: string }>;

export default async function Find({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const searching = Boolean(sp.q);
  const points = searching
    ? await getStore().searchPrices({ q: sp.q, citySlug: sp.city ? slugify(sp.city) : undefined, country: sp.country?.toUpperCase() || undefined })
    : [];
  const results = comparePrices(points);

  return (
    <>
      <section className="hero">
        <h1>Where is it cheapest?</h1>
        <p>Search a product to compare its price across stores in your city. Prices are reported by shoppers like you, so you can help too.</p>
        <form className="search" action="/find" method="get">
          <div className="row">
            <input type="text" name="q" placeholder="e.g. milk, maize flour, rice" defaultValue={sp.q} aria-label="Product" required />
            <input type="text" name="city" placeholder="City (e.g. Nairobi)" defaultValue={sp.city} aria-label="City" />
            <button type="submit">Compare</button>
          </div>
        </form>
        <p style={{ marginTop: 14 }}><Link href="/find/report">+ Report a price</Link> · <Link href="/deals">See deals</Link></p>
      </section>
      {sp.thanks === "1" && <div className="notice">Thanks! Your price is live.</div>}
      {sp.thanks === "review" && <div className="notice">Thanks! That price looks unusual, so we'll check it before showing it.</div>}
      {searching && (
        <>
          <h2>{results.length} product{results.length === 1 ? "" : "s"}</h2>
          {results.length === 0 && <p className="meta">No prices yet. Be the first: <Link href="/find/report">report a price</Link>.</p>}
          <div className="grid">{results.map((c) => <PriceCard key={c.productKey} c={c} />)}</div>
          <p className="meta">Only prices from the last 4 months are shown. Prices can change; check the shelf tag.</p>
        </>
      )}
    </>
  );
}
