import Link from "next/link";
import { getStore, isDemo } from "@/lib/store";
import { DIETS, type Diet } from "@/lib/types";
import { regionName, slugify } from "@/lib/util";
import { RestaurantCard, SearchForm } from "./components";

export const dynamic = "force-dynamic";

type SP = Promise<{ q?: string; city?: string; diet?: string | string[] }>;

export default async function Home({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const diets = ([] as string[]).concat(sp.diet ?? []).filter((d): d is Diet => DIETS.some((x) => x.id === d));
  const searching = Boolean(sp.q || sp.city || diets.length);
  const store = getStore();
  const [results, cities] = await Promise.all([
    searching ? store.searchRestaurants({ q: sp.q, citySlug: sp.city ? slugify(sp.city) : undefined, diet: diets }) : Promise.resolve([]),
    store.listCities(),
  ]);

  return (
    <>
      <section className="hero">
        <h1>Restaurants that match what you actually eat</h1>
        <p>Filter by diet and allergies, see real menus, and message the restaurant on WhatsApp in one tap.</p>
        <SearchForm defaults={{ q: sp.q, city: sp.city, diet: diets }} />
        <p style={{ marginTop: 14 }} className="meta">Shopping instead? <Link href="/find">Compare grocery prices</Link> or see <Link href="/deals">deals</Link>.</p>
      </section>
      {isDemo() && <div className="notice">Running on demo data. Set <code>FIREBASE_SERVICE_ACCOUNT</code> to use the live database.</div>}
      {searching ? (
        <>
          <h2>{results.length} result{results.length === 1 ? "" : "s"}</h2>
          {results.length === 0 && <p className="meta">Nothing yet. Try another city, or <Link href="/list">add a restaurant</Link>.</p>}
          <div className="grid">{results.map((r) => <RestaurantCard key={r.id} r={r} />)}</div>
        </>
      ) : (
        <>
          <h2>Browse by city</h2>
          <div className="cities">
            {cities.map((c) => (
              <Link key={`${c.country}/${c.citySlug}`} href={`/c/${c.country.toLowerCase()}/${c.citySlug}`}>
                {c.city}, {regionName(c.country)} ({c.count})
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}
