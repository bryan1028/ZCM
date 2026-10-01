import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dishEmoji } from "@/lib/dishes";
import { ContactButtons } from "../../components";
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
    description: `${r.name} in ${r.city}: menu${r.diets.length ? `, ${r.diets.map(label).join(", ")} options` : ""}. Pick what you want and message them on WhatsApp.`,
    alternates: { canonical: `/r/${r.id}` },
  };
}

export default async function RestaurantPage({ params }: { params: P }) {
  const { id } = await params;
  const r = await getStore().getRestaurant(id);
  if (!r || (r.status !== "active" && r.status !== "unclaimed")) notFound();

  const jsonLd = {
    "@context": "https://schema.org", "@type": "Restaurant", name: r.name, servesCuisine: r.cuisines,
    address: { "@type": "PostalAddress", streetAddress: r.address, addressLocality: r.city, addressCountry: r.country },
    ...(r.lat != null && r.lng != null ? { geo: { "@type": "GeoCoordinates", latitude: r.lat, longitude: r.lng } } : {}),
  };
  const unclaimed = r.status === "unclaimed";
  const canOrder = (unclaimed || Boolean(r.whatsapp)) && r.menu.length > 0;

  return (
    <article className="theme-zood" style={{ padding: "28px 0 56px" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <p className="meta"><Link href={`/?city=${encodeURIComponent(r.city)}`}>← back to Zood</Link></p>
      <h1>{r.name}</h1>
      <div className="meta">{[r.address, `${r.city}, ${regionName(r.country)}`].filter(Boolean).join(" · ")}</div>
      <p>{r.diets.map((d) => <span key={d} className="tag">{label(d)}</span>)}{r.cuisines.map((c) => <span key={c} className="tag gray">{c}</span>)}</p>
      {r.leadCount > 0 && <p className="meta">🔥 {r.leadCount} {r.leadCount === 1 ? "person wants" : "people want"} to order from {unclaimed ? "here" : "this restaurant"} through Zood</p>}

      {r.status === "unclaimed" && (
        <div className="notice">Is this your restaurant? {r.leadCount > 0 ? <>{r.leadCount} {r.leadCount === 1 ? "person has" : "people have"} already asked to order from you on Zood. </> : null}<Link href={`/list?claim=${r.id}`}>Claim it</Link> for a free trial: edit your profile and menu, and start receiving customers directly, with no commission.</div>
      )}
      <p style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><ContactButtons r={r} /></p>
      {unclaimed && <p className="meta">This restaurant hasn't joined Zood yet. Tapping the button tells us you want to order here; we use it to invite them.</p>}

      <h2>Pick your meal</h2>
      {r.menu.length === 0 && <p className="meta">The menu hasn't landed yet. Tell us you want to order here and we'll ask them to put it up.</p>}

      {/* No JavaScript needed: tick dishes, press the button, and WhatsApp opens with everything you picked. */}
      <form action={`/go/${r.id}`} method="get" target={unclaimed ? undefined : "_blank"}>
        <input type="hidden" name="src" value="web" />
        {r.menu.map((m) => (
          <label className="menu-item pick" key={m.id}>
            {canOrder && <input type="checkbox" name="item" value={m.id} aria-label={`Pick ${m.name}`} />}
            <span className="dish-emoji sm" aria-hidden>{dishEmoji(r.cuisines, m.name)}</span>
            <span style={{ flex: 1 }}>
              <b>{m.name}</b>
              {m.description && <span className="meta" style={{ display: "block" }}>{m.description}</span>}
              <span>
                {m.diets.map((d) => <span key={d} className="tag">{label(d)}</span>)}
                {m.allergens.length > 0 ? m.allergens.map((a) => <span key={a} className="tag warn">has {a}</span>) : <span className="tag gray">no allergens listed</span>}
              </span>
            </span>
            <span style={{ whiteSpace: "nowrap" }}>{formatPrice(m.price, m.currency)}</span>
          </label>
        ))}
        {canOrder && (
          <div className="tray">
            <span className="meta">Tick what you want, then</span>
            <button type="submit" className="wa-btn">{unclaimed ? `🙋 I want these at ${r.name}` : `💬 Message ${r.name} with my picks`}</button>
          </div>
        )}
      </form>
      <p className="meta">Allergen tags come from the restaurant. "No allergens listed" is not "allergen-free". With a serious allergy, ask them first.</p>
    </article>
  );
}
