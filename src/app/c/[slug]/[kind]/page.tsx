import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signedUrls } from "@/lib/images";
import { CATEGORIES, KINDS, formatPrice, PRICE_UNITS, type KindSlug } from "@/lib/catalog";

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
    .select("id, title, description, category, price_cents, price_unit, featured_until, available, stock, image_urls, sellers(display_name, business_name, account_type, whatsapp), communities!inner(slug, currency)")
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
  const thumbs = await signedUrls(supabase, "listing-images", (listings ?? []).flatMap((l) => l.image_urls.slice(0, 1)));
  const ratingOf = new Map((ratings ?? []).map((r) => [r.listing_id, r]));

  return (
    <>
      <p className="muted">{def.blurb}</p>
      <form method="get" style={{ gridTemplateColumns: "1fr auto auto" }}>
        <input name="q" defaultValue={search} placeholder={`Search ${def.label.toLowerCase()}…`} />
        <select name="category" defaultValue={category ?? ""}>
          <option value="">All categories</option>
          {CATEGORIES[def.kind].map((c) => <option key={c}>{c}</option>)}
        </select>
        <button>Search</button>
      </form>
      {(listings ?? []).length === 0 && <div className="card">Nothing here yet. Be the first to list something!</div>}
      {(listings ?? []).map((l) => {
        const s = l.sellers as unknown as { display_name: string; business_name: string | null; account_type: string; whatsapp: string | null };
        const c = l.communities as unknown as { currency: string };
        const featured = l.featured_until && new Date(l.featured_until) > new Date();
        return (
          <article className="card" key={l.id}>
            {l.image_urls[0] && thumbs.get(l.image_urls[0]) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumbs.get(l.image_urls[0])} alt="" style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 8, marginBottom: 8 }} />
            )}
            <div className="row">
              <Link href={`/c/${slug}/l/${l.id}`}><strong>{l.title}</strong></Link>
              <span>{formatPrice(l.price_cents, l.price_unit as keyof typeof PRICE_UNITS, c.currency)}</span>
            </div>
            <p>{l.description}</p>
            <p className="muted">
              {l.category} · {s.business_name ?? s.display_name}{" "}
              {s.account_type === "business" && <span className="badge">Business</span>}{" "}
              {featured && <span className="badge">Featured</span>}{" "}
              {!l.available && <span className="badge">Unavailable</span>}{" "}
              {ratingOf.get(l.id) && <span>★ {ratingOf.get(l.id)!.avg_rating} ({ratingOf.get(l.id)!.review_count})</span>}
            </p>
            {s.whatsapp && <a href={`https://wa.me/${s.whatsapp.replace(/\D/g, "")}`}>Message on WhatsApp</a>}
          </article>
        );
      })}
    </>
  );
}
