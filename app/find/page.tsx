import type { Metadata } from "next";
import Link from "next/link";
import { detectPlace } from "@/lib/geo";
import { comparePrices } from "@/lib/prices";
import { getStore } from "@/lib/store";
import { regionName, slugify } from "@/lib/util";
import { PriceCard } from "../components";
import { StapleStrip } from "../pins";
import { CityInput } from "../cityinput";
import { flag, groceryTicker } from "@/lib/ticker";

export const metadata: Metadata = {
  title: "Zind — find what anything costs",
  description: "Type any item and see its price at every store Zind knows, in any city.",
};
export const dynamic = "force-dynamic";

type SP = Promise<{ q?: string; city?: string; thanks?: string }>;
const TRY = ["milk", "rice", "bread", "eggs", "cooking oil", "toothpaste"];

export default async function Zind({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const place = await detectPlace();
  const submitted = "q" in sp || "city" in sp;
  const city = (submitted ? sp.city : place.city ?? "")?.trim() ?? "";
  const citySlug = city ? slugify(city) : undefined;
  const q = sp.q?.trim() || undefined;
  // First visit with no city known: start in the visitor's country (Zind widens by itself if nothing is there).
  const scopeCountry = !submitted && !city ? place.country : undefined;
  const where = city || (scopeCountry ? regionName(scopeCountry) : "");

  const store = getStore();
  let comps = comparePrices(await store.searchPrices({ q, citySlug, country: scopeCountry, limit: 800 }), Date.now(), q, citySlug);
  let widened = false;
  if (!comps.length && (citySlug || scopeCountry)) { comps = comparePrices(await store.searchPrices({ q, limit: 800 }), Date.now(), q, citySlug); widened = comps.length > 0; }
  comps = comps.slice(0, 24);
  const [ticker, priceCities] = await Promise.all([groceryTicker(store), store.priceCities()]);

  return (
    <div className="theme-zind">
      {ticker.length > 0 && <StapleStrip items={ticker} />}

      <section className="bighero zind heroed">
        <div className="herotext">
        <span className="kicker">The Wikipedia of prices</span>
        <h1>Someone is always at a store. Tell the world what it costs.</h1>
        <p>Zind is an open, crowd-sourced price tracker. Search any item to see who's cheapest, then add the prices and deals you spot, so everyone can see what things really cost.</p>
        <form className="search" action="/find" method="get">
          <div className="row">
            <input type="text" name="q" placeholder="rice, milk, dettol, anything…" defaultValue={q} aria-label="What are you hunting for?" autoFocus={!submitted} />
            <CityInput id="zind-cities" cities={priceCities} defaultValue={city} noun="prices" />
            <button type="submit" className="light">Zind it</button>
          </div>
          <div className="cities" aria-label="Try">
            {TRY.map((t) => <Link key={t} href={`/find?q=${encodeURIComponent(t)}${city ? `&city=${encodeURIComponent(city)}` : ""}`}>{t}</Link>)}
          </div>
        </form>
        </div>
      </section>

      {ticker.length > 0 && (
        <>
          <div className="ticker" role="marquee" aria-label="Everyday grocery prices around the world">
            <div className="track">
              {[0, 1].map((k) => ticker.map((t) => (
                <span key={`${k}${t.label}`} aria-hidden={k === 1}>
                  {t.emoji} <b>{t.label}</b>{t.countries.map((c) => <em key={c.country}> {flag(c.country)} <b className="up">{c.text}</b></em>)}
                </span>
              )))}
            </div>
          </div>
          <p className="meta" style={{ marginTop: -8 }}>Typical shelf prices people have reported, by country. Pack sizes vary, so search an item for exact comparisons.</p>
        </>
      )}

      {sp.thanks === "1" && <div className="notice">Thanks, that sighting is live! 🎉</div>}
      {sp.thanks === "review" && <div className="notice">Thanks! That price looks unusual, so we'll double-check it before showing it.</div>}
      {widened && <div className="notice">Zind hasn't sniffed around <b>{where}</b> yet 🐾 Here's what it found elsewhere. <Link href="/find/report">Be its nose: add a price</Link>.</div>}

      <h2>{comps.length ? (q ? `${comps.length} find${comps.length === 1 ? "" : "s"} for “${q}”` : where && !widened ? `Fresh sniffs in ${where}` : "Fresh sniffs from around the world") : "Zind sniffed everywhere and found nothing 🐽"}</h2>
      {!comps.length && <p className="meta">No one has reported “{q ?? "that"}”{where ? ` in ${where}` : ""} yet. <Link href="/find/report">Be the first to add a price</Link>, or try a simpler word.</p>}
      <div className="grid">{comps.map((c) => <PriceCard key={`${c.productKey}|${c.citySlug}`} c={c} />)}</div>
      <p className="meta">Prices come from shoppers and from the open Open Prices dataset. Only the last 4 months are shown, and prices change, so check the shelf tag.</p>
      <p style={{ margin: "14px 0 48px" }}><Link className="btn" href="/find/report">➕ Add a price you saw</Link> <Link className="btn ghost" href="/deals">See deals</Link> <Link className="btn ghost" href="/">Hungry instead? Zood it</Link></p>
      <section className="mission">
        <h2>Prices should be public. Help us keep them that way.</h2>
        <p className="lead">
          Think Wikipedia, but for what things cost. Our goal is price transparency, especially now that personalised, dynamic pricing is on the way: the best defence is a shared, open record of real shelf prices.
          Zind is only as good as the people adding to it, and like the stock market it moves every day.
          Later, our AI tools and human editors will compile those updates into daily prices and deals anyone can use.
        </p>
        <div className="steps">
          <div className="step"><span className="n">1</span><b>Spot a price</b>You're at a store anyway. Notice the price of something.</div>
          <div className="step"><span className="n">2</span><b>Add it in 10 seconds</b>Item, store, price. Spot an offer or a deal? Add that too.</div>
          <div className="step"><span className="n">3</span><b>Everyone benefits</b>Your sighting shows up for shoppers in your city, today.</div>
        </div>
        <div className="ctas">
          <Link className="btn" href="/find/report">➕ Add a price you saw</Link>
          <Link className="btn ghost" href="/deals">🏷️ See deals &amp; offers</Link>
          <Link className="btn ghost" href="/signup">Join the price spotters</Link>
        </div>
      </section>
    </div>
  );
}
