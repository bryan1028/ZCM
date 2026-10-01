import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getStore } from "@/lib/store";
import { DIETS } from "@/lib/types";
import { formatPrice, regionName } from "@/lib/util";

export const revalidate = 300;
type P = Promise<{ id: string }>;
const label = (id: string) => DIETS.find((d) => d.id === id)?.label ?? id;

export async function generateMetadata({ params }: { params: P }): Promise<Metadata> {
  const r = await getStore().getRestaurant((await params).id);
  if (!r) return {};
  return {
    title: `${r.name} — ${r.city}`,
    description: `${r.name} in ${r.city}: menu${r.diets.length ? `, ${r.diets.map(label).join(", ")} options` : ""}. Message on WhatsApp.`,
    alternates: { canonical: `/r/${r.id}` },
  };
}

export default async function RestaurantPage({ params }: { params: P }) {
  const { id } = await params;
  const r = await getStore().getRestaurant(id);
  if (!r || (r.status !== "active" && r.status !== "unclaimed")) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: r.name,
    servesCuisine: r.cuisines,
    address: { "@type": "PostalAddress", streetAddress: r.address, addressLocality: r.city, addressCountry: r.country },
    ...(r.lat != null && r.lng != null ? { geo: { "@type": "GeoCoordinates", latitude: r.lat, longitude: r.lng } } : {}),
  };

  return (
    <article style={{ padding: "28px 0 56px" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <p className="meta"><Link href={`/c/${r.country.toLowerCase()}/${r.citySlug}`}>← {r.city}</Link></p>
      <h1>{r.name}</h1>
      <div className="meta">{[r.address, regionName(r.country)].filter(Boolean).join(" · ")}</div>
      <p>{r.diets.map((d) => <span key={d} className="tag">{label(d)}</span>)}{r.cuisines.map((c) => <span key={c} className="tag gray">{c}</span>)}</p>

      {r.whatsapp ? (
        <p><a className="btn wa" href={`/go/${r.id}?src=web`} rel="nofollow noopener" target="_blank">Message on WhatsApp</a></p>
      ) : (
        <div className="notice">We don't have a WhatsApp number for this restaurant yet.</div>
      )}
      {r.status === "unclaimed" && (
        <div className="notice">Is this your restaurant? <Link href={`/list?claim=${r.id}`}>Claim it</Link> to add your menu and receive customer messages.</div>
      )}

      <h2>Menu</h2>
      {r.menu.length === 0 && <p className="meta">The menu hasn't been added yet.</p>}
      {r.menu.map((m) => (
        <div className="menu-item" key={m.id}>
          <div>
            <h3>{m.name}</h3>
            {m.description && <div className="meta">{m.description}</div>}
            <div style={{ marginTop: 4 }}>
              {m.diets.map((d) => <span key={d} className="tag">{label(d)}</span>)}
              {m.allergens.length > 0 && <span className="tag warn">Contains: {m.allergens.join(", ")}</span>}
            </div>
          </div>
          <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
            <div>{formatPrice(m.price, m.currency)}</div>
            {r.whatsapp && <a className="meta" href={`/go/${r.id}?item=${encodeURIComponent(m.id)}&src=web`} rel="nofollow noopener" target="_blank">Ask about this</a>}
          </div>
        </div>
      ))}
    </article>
  );
}
