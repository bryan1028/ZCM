import Link from "next/link";
import { CATEGORY_EMOJI, formatPrice, PRICE_UNITS } from "@/lib/catalog";
import { StarIcon } from "./icons";

export type CardListing = {
  id: string; title: string; description: string | null; category: string; kind: string;
  price_cents: number | null; price_unit: string; featured_until: string | null; available: boolean;
  image_urls: string[]; video_urls: string[];
  sellers: unknown; communities: unknown;
};

export default function ListingCard({ l, slug, thumb, rating }: {
  l: CardListing; slug: string; thumb?: string; rating?: { avg_rating: number; review_count: number };
}) {
  const s = l.sellers as { display_name: string; business_name: string | null; account_type: string };
  const c = l.communities as { currency: string };
  const featured = !!l.featured_until && new Date(l.featured_until) > new Date();
  const seller = s.business_name ?? s.display_name;
  return (
    <Link href={`/c/${slug}/l/${l.id}`} className="listing-card">
      <div className="listing-media">
        {thumb
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={thumb} alt="" loading="lazy" />
          : <div className="listing-ph" aria-hidden>{CATEGORY_EMOJI[l.category] ?? "✨"}</div>}
        <div className="listing-flags">
          {featured && <span className="badge accent">⭐ Featured</span>}
          {s.account_type === "business" && <span className="badge brand">Business</span>}
          {!l.available && <span className="badge">Unavailable</span>}
        </div>
        {l.image_urls.length + l.video_urls.length > 1 && (
          <span className="media-count" aria-label={`${l.image_urls.length + l.video_urls.length} photos and videos`}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="8" y="8" width="13" height="13" rx="3" /><path d="M16 4H7a3 3 0 0 0-3 3v9" /></svg>
            {l.image_urls.length + l.video_urls.length}
          </span>
        )}
        {l.video_urls.length > 0 && l.image_urls.length === 0 && <span className="media-count">▶</span>}
      </div>
      <div className="listing-body">
        <div className="listing-price">{formatPrice(l.price_cents, l.price_unit as keyof typeof PRICE_UNITS, c.currency)}</div>
        <div className="listing-title clamp-2">{l.title}</div>
        <div className="listing-meta">
          <span className="seller">{seller}</span>
        </div>
        {rating && (
          <div className="stars" aria-label={`${rating.avg_rating} stars from ${rating.review_count} reviews`}>
            <StarIcon size={12} style={{ verticalAlign: "-1px" }} /> {rating.avg_rating} <span className="muted">({rating.review_count})</span>
          </div>
        )}
      </div>
    </Link>
  );
}
