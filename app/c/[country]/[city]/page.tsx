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
  if (!rs.length) notFound();
  return (
    <>
      <section className="hero">
        <h1>Restaurants in {rs[0].city}, {regionName(rs[0].country)}</h1>
        <p><Link href={`/?city=${city}`}>Filter by diet →</Link></p>
      </section>
      <div className="grid">{rs.map((r) => <RestaurantCard key={r.id} r={r} />)}</div>
    </>
  );
}
