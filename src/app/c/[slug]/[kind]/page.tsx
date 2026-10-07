import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { KINDS, formatPrice, PRICE_UNITS, type KindSlug } from "@/lib/catalog";

export default async function Listings({ params, searchParams }: {
  params: Promise<{ slug: string; kind: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { slug, kind } = await params;
  const { category } = await searchParams;
  if (!(kind in KINDS)) notFound();
  const def = KINDS[kind as KindSlug];

  const supabase = await createClient();
  let q = supabase
    .from("listings")
    .select("id, title, description, category, price_cents, price_unit, featured_until, sellers(display_name, business_name, account_type, whatsapp), communities!inner(slug, currency)")
    .eq("communities.slug", slug).eq("kind", def.kind).eq("status", "active")
    .order("featured_until", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (category) q = q.eq("category", category);
  const { data: listings } = await q;

  return (
    <>
      <p className="muted">{def.blurb}</p>
      {(listings ?? []).length === 0 && <div className="card">Nothing here yet. Be the first to list something!</div>}
      {(listings ?? []).map((l) => {
        const s = l.sellers as unknown as { display_name: string; business_name: string | null; account_type: string; whatsapp: string | null };
        const c = l.communities as unknown as { currency: string };
        const featured = l.featured_until && new Date(l.featured_until) > new Date();
        return (
          <article className="card" key={l.id}>
            <div className="row">
              <strong>{l.title}</strong>
              <span>{formatPrice(l.price_cents, l.price_unit as keyof typeof PRICE_UNITS, c.currency)}</span>
            </div>
            <p>{l.description}</p>
            <p className="muted">
              {l.category} · {s.business_name ?? s.display_name}{" "}
              {s.account_type === "business" && <span className="badge">Business</span>}{" "}
              {featured && <span className="badge">Featured</span>}
            </p>
            {s.whatsapp && <a href={`https://wa.me/${s.whatsapp.replace(/\D/g, "")}`}>Message on WhatsApp</a>}
          </article>
        );
      })}
    </>
  );
}
