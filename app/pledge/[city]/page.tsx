import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@/lib/session";
import { pledgeCountry } from "@/lib/geo";
import { getStore } from "@/lib/store";
import { regionName, slugify } from "@/lib/util";
import { wantedKey } from "@/lib/wanted";
import { ShareBar } from "../../share";
import { WantedBoard } from "../../wanted";

export const dynamic = "force-dynamic";
type P = Promise<{ city: string }>;
const SITE = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "https://zist.it.com").replace(/\/$/, "");
const nice = (slug: string) => slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

export async function generateMetadata({ params }: { params: P }): Promise<Metadata> {
  const slug = slugify(decodeURIComponent((await params).city));
  const info = (await getStore().listCities({ includeUnlisted: true })).find((c) => c.citySlug === slug);
  const name = info?.city ?? nice(slug);
  return {
    title: `Pledge for ${name} on Zood`,
    description: info ? `${info.count} restaurants in ${name} aren't on Zood yet. Pledge to order from the ones you want and we'll invite them.` : `Zood isn't in ${name} yet. Add a restaurant you love.`,
  };
}

export default async function PledgeCity({ params, searchParams }: { params: P; searchParams: Promise<{ pledged?: string; pledge?: string }> }) {
  const slug = slugify(decodeURIComponent((await params).city));
  const sp = await searchParams;
  const store = getStore();
  const [user, cities, reqs, places] = await Promise.all([
    currentUser(),
    store.listCities({ includeUnlisted: true }),
    store.listRequests({ kind: "restaurant", citySlug: slug, limit: 300 }),
    store.searchRestaurants({ citySlug: slug, includeUnlisted: true, limit: 200 }),
  ]);
  const info = cities.find((c) => c.citySlug === slug);
  const name = info?.city ?? nice(slug);
  const pledges = reqs.reduce((n, r) => n + r.supportCount, 0);
  const counts = new Map(reqs.map((r) => [r.id, r.supportCount]));
  const unlisted = places.filter((r) => r.status === "unclaimed").sort((a, b) => (counts.get(wantedKey(b)) ?? 0) - (counts.get(wantedKey(a)) ?? 0) || (b.rank ?? 0) - (a.rank ?? 0)).slice(0, 24);
  const mine = user ? await store.supportedBy(user.uid, unlisted.map(wantedKey)) : new Set<string>();
  const home = await pledgeCountry(user?.profile.country);
  const url = `${SITE()}/pledge/${slug}`;
  const text = pledges > 0
    ? `${pledges} ${pledges === 1 ? "person has" : "people have"} pledged to order from restaurants in ${name} on Zood. Pledge for yours:`
    : `Help bring ${name}'s restaurants to Zood, where you message them directly with no middleman. Pledge for yours:`;

  return (
    <section className="theme-zood" style={{ paddingBottom: 48 }}>
      <div className="cityhero">
        <span className="kicker" style={{ background: "var(--peach)", color: "#4a1a00", borderRadius: 999, padding: "4px 12px", fontWeight: 700, fontSize: 13 }}>PLEDGE FOR YOUR CITY</span>
        <h1>{name}{info ? `, ${regionName(info.country)}` : ""}</h1>
        <p style={{ margin: 0, opacity: .95 }}>{info ? `${info.count} restaurants are waiting to be on Zood. Your pledge tells them people want to order from them directly.` : "We don't have restaurants here yet. Be the first to add one."}</p>
        <div className="bignum">
          <div><b>{pledges}</b>pledges</div>
          <div><b>{info?.count ?? 0}</b>restaurants waiting</div>
        </div>
        <ShareBar url={url} text={text} title="Spread the word" />
      </div>

      {sp.pledged && <div className="notice pledge">🤝 Pledged! Thank you. Share this page so your neighbours pledge too.</div>}
      {sp.pledge === "away" && <div className="notice pledge">Pledges are for restaurants where you are.</div>}

      {unlisted.length > 0
        ? <WantedBoard places={unlisted} requests={reqs} mine={mine} returnTo={`/pledge/${slug}`} where={name} home={home} />
        : <div className="notice pledge"><b>Zood isn't in {name} yet.</b> Add a restaurant you love there. <Link className="btn sm" href={`/requests/new?city=${encodeURIComponent(name)}`}>➕ Add a restaurant</Link></div>}

      <p className="meta">Own a restaurant in {name}? <Link href="/list">Claim it</Link> for a free trial. <Link href="/about">Why we're doing this</Link>.</p>
    </section>
  );
}
