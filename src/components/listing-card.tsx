import Link from "next/link";
import { formatPrice, PRICE_UNITS } from "@/lib/catalog";

export type CardListing = {
  id: string; title: string; description: string | null; category: string; kind: string;
  price_cents: number | null; price_unit: string; featured_until: string | null; available: boolean;
  image_urls: string[]; video_urls: string[];
  sellers: unknown; communities: unknown;
};

export default function ListingCard({ l, slug, thumb, rating }: {
  l: CardListing; slug: string; thumb?: string; rating?: { avg_rating: number; review_count: number };
}) {
  const s = l.sellers as { display_name: string; business_name: string | null; account_type: string; whatsapp: string | null };
  const c = l.communities as { currency: string };
  const featured = l.featured_until && new Date(l.featured_until) > new Date();
  return (
    <article className="card">
      {thumb && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb} alt="" style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 8, marginBottom: 8 }} />
      )}
      <div className="row">
        <Link href={`/c/${slug}/l/${l.id}`}><strong>{l.title}</strong></Link>
        <span>{formatPrice(l.price_cents, l.price_unit as keyof typeof PRICE_UNITS, c.currency)}</span>
      </div>
      <p>{l.description}</p>
      <p className="muted">
        {l.kind === "service" ? "Service" : "Product"} · {l.category} · {s.business_name ?? s.display_name}{" "}
        {s.account_type === "business" && <span className="badge">Business</span>}{" "}
        {featured && <span className="badge">Featured</span>}{" "}
        {!l.available && <span className="badge">Unavailable</span>}{" "}
        {l.video_urls.length > 0 && <span className="badge">▶ video</span>}{" "}
        {rating && <span>★ {rating.avg_rating} ({rating.review_count})</span>}
      </p>
      {s.whatsapp && <a href={`https://wa.me/${s.whatsapp.replace(/\D/g, "")}`}>Message on WhatsApp</a>}
    </article>
  );
}
