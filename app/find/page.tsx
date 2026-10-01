import type { Metadata } from "next";
import Link from "next/link";
import { VisionStory } from "../vision";
import { detectPlace } from "@/lib/geo";
import { comparePrices } from "@/lib/prices";
import { getStore } from "@/lib/store";
import { regionName, slugify } from "@/lib/util";
import { ZindMark } from "../brand";
import { PriceCard } from "../components";

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

  return (
    <div className="theme-zind">
      <section className="hero brandhero">
        <ZindMark size={72} />
        <div>
          <h1>Zind it for less.</h1>
          <p>Type any item. Zind sniffs out what it costs at every store it knows.</p>
        </div>
      </section>

      <form className="search" action="/find" method="get">
        <div className="row">
          <input type="text" name="q" placeholder="rice, milk, dettol, anything…" defaultValue={q} aria-label="What are you hunting for?" autoFocus={!submitted} />
          <input type="text" name="city" placeholder="Where? any city on Earth" defaultValue={city} aria-label="City" />
          <button type="submit">Zind it</button>
        </div>
        <div className="cities" aria-label="Try">
          {TRY.map((t) => <Link key={t} href={`/find?q=${encodeURIComponent(t)}${city ? `&city=${encodeURIComponent(city)}` : ""}`}>{t}</Link>)}
        </div>
      </form>

      {sp.thanks === "1" && <div className="notice">Thanks, that sighting is live! 🎉</div>}
      {sp.thanks === "review" && <div className="notice">Thanks! That price looks unusual, so we'll double-check it before showing it.</div>}
      {widened && <div className="notice">Zind hasn't sniffed around <b>{where}</b> yet 🐾 Here's what it found elsewhere. <Link href="/find/report">Be its nose: add a price</Link>.</div>}

      <h2>{comps.length ? (q ? `${comps.length} find${comps.length === 1 ? "" : "s"} for “${q}”` : where && !widened ? `Fresh sniffs in ${where}` : "Fresh sniffs from around the world") : "Zind sniffed everywhere and found nothing 🐽"}</h2>
      {!comps.length && <p className="meta">No one has reported “{q ?? "that"}”{where ? ` in ${where}` : ""} yet. <Link href="/find/report">Be the first to add a price</Link>, or try a simpler word.</p>}
      <div className="grid">{comps.map((c) => <PriceCard key={`${c.productKey}|${c.citySlug}`} c={c} />)}</div>
      <p className="meta">Prices come from shoppers and from the open Open Prices dataset. Only the last 4 months are shown, and prices change, so check the shelf tag.</p>
      <p style={{ margin: "14px 0 48px" }}><Link className="btn" href="/find/report">➕ Add a price you saw</Link> <Link className="btn ghost" href="/deals">See deals</Link> <Link className="btn ghost" href="/">Hungry instead? Zood it</Link></p>
      <VisionStory product="zind" />
    </div>
  );
}
