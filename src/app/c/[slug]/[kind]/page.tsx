import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signedUrls } from "@/lib/images";
import { CATEGORIES, CATEGORY_EMOJI, KINDS, type KindSlug } from "@/lib/catalog";
import { SearchIcon } from "@/components/icons";
import Empty from "@/components/empty";
import ListingCard, { type CardListing } from "@/components/listing-card";

export default async function Listings({ params, searchParams }: {
  params: Promise<{ slug: string; kind: string }>;
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const { slug, kind } = await params;
  const { category, q: search } = await searchParams;
  if (!(kind in KINDS)) notFound();
  const def = KINDS[kind as KindSlug];

  const supabase = await createClient();
  let q = supabase
    .from("listings")
    .select("id, title, description, category, price_cents, price_unit, featured_until, available, stock, image_urls, video_urls, kind, sellers(display_name, business_name, account_type, whatsapp), communities!inner(slug, currency)")
    .eq("communities.slug", slug).eq("kind", def.kind).eq("status", "active")
    .order("featured_until", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (category) q = q.eq("category", category);
  // strip characters that have meaning inside a PostgREST .or() filter / ilike pattern
  const term = search?.replace(/[%,()*\\]/g, " ").trim();
  if (term) q = q.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
  const { data: listings } = await q;
  const { data: ratings } = await supabase.from("listing_ratings").select("listing_id, avg_rating, review_count")
    .in("listing_id", (listings ?? []).map((l) => l.id));
  const thumbs = await signedUrls(supabase, "zcm-listing-images", (listings ?? []).flatMap((l) => l.image_urls.slice(0, 1)));
  const ratingOf = new Map((ratings ?? []).map((r) => [r.listing_id, r]));

  const href = (cat?: string) => {
    const qs = new URLSearchParams();
    if (cat) qs.set("category", cat);
    if (term) qs.set("q", term);
    const str = qs.toString();
    return `/c/${slug}/${kind}${str ? `?${str}` : ""}`;
  };
  const count = (listings ?? []).length;

  return (
    <>
      <div className="segmented" role="tablist" aria-label="Browse">
        {Object.entries(KINDS).map(([k, v]) => (
          <Link key={k} href={`/c/${slug}/${k}`} {...(k === kind ? { "aria-current": "page" as const } : {})}>{v.label}</Link>
        ))}
      </div>

      <div className="page-head" style={{ marginTop: 18 }}>
        <div>
          <h1>{def.label}</h1>
          <p className="muted">{def.blurb}</p>
        </div>
        <span className="muted nowrap">{count} {count === 1 ? "listing" : "listings"}</span>
      </div>

      <form method="get" action={`/c/${slug}/${kind}`} className="inline-form" style={{ flexWrap: "nowrap", marginBottom: 12 }}>
        {category && <input type="hidden" name="category" value={category} />}
        <div style={{ position: "relative", flex: 1 }}>
          <SearchIcon size={18} style={{ position: "absolute", left: 14, top: 14, color: "var(--muted)" }} />
          <input name="q" defaultValue={search} placeholder={`Search ${def.label.toLowerCase()}…`} style={{ paddingLeft: 42 }} aria-label="Search" />
        </div>
        <button className="secondary" aria-label="Search">Search</button>
      </form>

      <div className="chips" role="list" aria-label="Categories">
        <Link className="chip" href={href()} aria-current={!category}>All</Link>
        {CATEGORIES[def.kind].map((c) => (
          <Link key={c} className="chip" href={href(c)} aria-current={category === c}>{CATEGORY_EMOJI[c] ?? ""} {c}</Link>
        ))}
      </div>

      {count === 0 ? (
        <Empty emoji={kind === "services" ? "🛠️" : "🛍️"} title={term || category ? "No matches" : `No ${def.label.toLowerCase()} yet`}
          href={term || category ? href() : `/c/${slug}/sell`} cta={term || category ? "Clear filters" : "Be the first to list"}>
          {term || category ? "Try a different search or category." : "Neighbours will see yours as soon as you post it."}
        </Empty>
      ) : (
        <div className="listing-grid" style={{ marginTop: 6 }}>
          {(listings ?? []).map((l) => (
            <ListingCard key={l.id} l={l as unknown as CardListing} slug={slug}
              thumb={thumbs.get(l.image_urls[0])} rating={ratingOf.get(l.id)} />
          ))}
        </div>
      )}
    </>
  );
}
