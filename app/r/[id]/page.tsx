import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dishEmoji } from "@/lib/dishes";
import { ContactButtons } from "../../components";
import { currentUser } from "@/lib/session";
import { wantedKey } from "@/lib/wanted";
import { pledgeCountry } from "@/lib/geo";
import { wantRestaurantAction } from "../../request-actions";
import { getStore } from "@/lib/store";
import { DIETS } from "@/lib/types";
import { formatPrice, regionName } from "@/lib/util";

export const dynamic = "force-dynamic";
type P = Promise<{ id: string }>;
const label = (id: string) => DIETS.find((d) => d.id === id)?.label ?? id;

export async function generateMetadata({ params }: { params: P }): Promise<Metadata> {
  const r = await getStore().getRestaurant((await params).id);
  if (!r) return {};
  return {
    title: `${r.name} — ${r.city}`,
    description: `${r.name} in ${r.city}: menu${r.diets.length ? `, ${r.diets.map(label).join(", ")} options` : ""}. Pick what you want and message them on WhatsApp.`,
    alternates: { canonical: `/r/${r.id}` },
    // A listing without a menu isn't useful to diners; keep it out of search until the owner adds one.
    ...(r.menu.length === 0 || r.status !== "active" ? { robots: { index: false, follow: true } } : {}),
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
  const [user, reqs] = unclaimed ? await Promise.all([currentUser(), getStore().listRequests({ kind: "restaurant", citySlug: r.citySlug, limit: 300 })]) : [null, []];
  const home = unclaimed ? await pledgeCountry(user?.profile.country) : undefined;
  const wkey = wantedKey(r);
  const signatures = reqs.find((x) => x.id === wkey)?.supportCount ?? 0;
  const signed = user ? (await getStore().supportedBy(user.uid, [wkey])).has(wkey) : false;
  const canOrder = !unclaimed && Boolean(r.whatsapp) && r.menu.length > 0;

  return (
    <article className="theme-zood" style={{ padding: "28px 0 56px" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <p className="meta"><Link href={`/?city=${encodeURIComponent(r.city)}`}>← back to Zood</Link></p>
      <h1>{r.name}</h1>
      <div className="meta">{[r.address, `${r.city}, ${regionName(r.country)}`].filter(Boolean).join(" · ")}</div>
      <p>{r.diets.map((d) => <span key={d} className="tag">{label(d)}</span>)}{r.cuisines.map((c) => <span key={c} className="tag gray">{c}</span>)}</p>
      {!unclaimed && r.leadCount > 0 && <p className="meta">🔥 {r.leadCount} {r.leadCount === 1 ? "person has" : "people have"} reached out through Zood</p>}

      {unclaimed && (
        <div className="wanted">
          <h2 style={{ fontSize: 22 }}>Want {r.name} on Zood?</h2>
          <p className="meta" style={{ marginTop: -4 }}>{signatures > 0 ? `${signatures} ${signatures === 1 ? "person has" : "people have"} pledged.` : "Be the first to pledge."} Pledge to order from them once they're here. Every pledge tells them people want to find them on Zood.</p>
          {signed ? <span className="btn sign done">✓ You pledged</span> : home && home !== r.country ? <span className="meta">📍 Pledges come from people in {regionName(r.country)}.</span> : (
            <form action={wantRestaurantAction}>
              <input type="hidden" name="id" value={r.id} /><input type="hidden" name="returnTo" value={`/r/${r.id}`} />
              <button type="submit" className="sign">🤝 Pledge to order</button>
            </form>
          )}
        </div>
      )}
      {unclaimed && (
        <div className="notice">
          <b>Is this your restaurant?</b> Zood is the tool that brings it straight to people looking for it, with no commission.{" "}
          <Link className="btn" href={`/list?claim=${r.id}`}>Claim your free trial</Link>
          <span className="meta" style={{ display: "block", marginTop: 6 }}>Edit your profile and menu, and get customers messaging you directly. We verify every claim first.</span>
        </div>
      )}
      {!unclaimed && <p style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><ContactButtons r={r} /></p>}

      {r.menu.length === 0 ? <p className="meta">This restaurant hasn't put its menu on Zood yet.</p> : <h2>Pick your meal</h2>}

      {/* No JavaScript needed: tick dishes, press the button, and WhatsApp opens with everything you picked. */}
      <form action={`/go/${r.id}`} method="get" target="_blank">
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
            <button type="submit" className="wa-btn">💬 Message {r.name} with my picks</button>
          </div>
        )}
      </form>
      <p className="meta">Allergen tags come from the restaurant. "No allergens listed" is not "allergen-free". With a serious allergy, ask them first.</p>
    </article>
  );
}
