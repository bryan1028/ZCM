import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getStore } from "@/lib/store";
import { regionName } from "@/lib/util";
import { RestaurantCard } from "@/app/components";

export const revalidate = 300;

type P = Promise<{ country: string; city: string }>;

export async function generateMetadata({ params }: { params: P }): Promise<Metadata> {
  const { country, city } = await params;
  const name = city.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    title: `Restaurants in ${name}, ${regionName(country.toUpperCase())} by diet`,
    description: `Vegan, vegetarian, gluten-free and halal restaurants in ${name}. See menus and message them on WhatsApp.`,
    alternates: { canonical: `/c/${country}/${city}` },
  };
}

export default async function CityPage({ params }: { params: P }) {
  const { country, city } = await params;
  const rs = await getStore().searchRestaurants({ country: country.toUpperCase(), citySlug: city, limit: 120 });
  const reqs = await getStore().listRequests({ country: country.toUpperCase(), citySlug: city, kind: "restaurant", limit: 6 });
  if (!rs.length && !reqs.length) notFound();
  return (
    <>
      <section className="hero">
        <h1>Restaurants in {rs[0]?.city ?? reqs[0].city}, {regionName(rs[0]?.country ?? reqs[0].country)}</h1>
        <p><Link href={`/?city=${city}`}>Filter by diet →</Link></p>
      </section>
      <div className="grid">{rs.map((r) => <RestaurantCard key={r.id} r={r} />)}</div>
      {reqs.length > 0 && (
        <>
          <h2>Requested by the community</h2>
          <p className="meta">Places people want on Zist. <Link href={`/requests?city=${city}`}>See all and back them →</Link></p>
          <div className="grid">{reqs.map((r) => (
            <article className="card" key={r.id}><h3>{r.name}</h3><div className="meta">{r.supportCount} want this · requested by <span className="sig">@{r.createdBy.handle}</span></div></article>
          ))}</div>
        </>
      )}
      <p className="meta" style={{ marginBottom: 48 }}>Don't see a place? <Link href="/requests/new">Request it</Link>.</p>
    </>
  );
}
