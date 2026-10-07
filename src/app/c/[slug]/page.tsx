import Link from "next/link";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { signedUrls } from "@/lib/images";
import { siteUrl } from "@/lib/nav";
import { getCommunity } from "@/lib/community";
import { fmtDay } from "@/lib/time";
import ListingCard, { type CardListing } from "@/components/listing-card";
import Empty from "@/components/empty";

// Community home: announcements from admins, an invite prompt, and what's new.
export default async function Feed({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const community = await getCommunity(slug);

  const [{ data: announcements }, { data: listings }, { data: code }, { data: me }] = await Promise.all([
    supabase.from("announcements").select("id, title, body, pinned, created_at").eq("community_id", community!.id)
      .order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(3),
    supabase.from("listings")
      .select("id, title, description, category, kind, price_cents, price_unit, featured_until, available, image_urls, video_urls, sellers(display_name, business_name, account_type, whatsapp), communities!inner(slug, currency)")
      .eq("communities.slug", slug).eq("status", "active").order("created_at", { ascending: false }).limit(20),
    supabase.rpc("get_invite_code", { cid: community!.id }),
    supabase.from("profiles").select("username").eq("id", user!.id).single(),
  ]);
  const { data: ratings } = await supabase.from("listing_ratings").select("listing_id, avg_rating, review_count")
    .in("listing_id", (listings ?? []).map((l) => l.id));
  const ratingOf = new Map((ratings ?? []).map((r) => [r.listing_id, r]));
  const thumbs = await signedUrls(supabase, "zcm-listing-images", (listings ?? []).flatMap((l) => l.image_urls.slice(0, 1)));

  const link = code ? `${siteUrl((await headers()).get("host"))}/invite/${code}?ref=${me?.username ?? ""}` : null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Hi @{me?.username} 👋</h1>
          <p className="muted">What&apos;s happening in {community!.name}</p>
        </div>
      </div>

      <div className="listing-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", marginBottom: 14 }}>
        <Link href={`/c/${slug}/services`} className="card" style={{ color: "inherit" }}>
          <div style={{ fontSize: 28 }} aria-hidden>🛠️</div><b>Services</b><div className="muted small">Gardeners, cleaners, repairs</div>
        </Link>
        <Link href={`/c/${slug}/products`} className="card" style={{ color: "inherit" }}>
          <div style={{ fontSize: 28 }} aria-hidden>🛍️</div><b>Products</b><div className="muted small">Baked goods, produce, crafts</div>
        </Link>
      </div>

      {(announcements ?? []).length > 0 && (
        <div className="stack" style={{ marginBottom: 14 }}>
          {(announcements ?? []).map((a) => (
            <div className={`card ${a.pinned ? "accent" : ""}`} key={a.id}>
              <div className="row row-start">
                <strong>{a.pinned ? "📌 " : "📣 "}{a.title}</strong>
                <span className="muted small nowrap">{fmtDay(a.created_at, community!.timezone)}</span>
              </div>
              {a.body && <p style={{ whiteSpace: "pre-wrap", margin: "6px 0 0" }}>{a.body}</p>}
            </div>
          ))}
        </div>
      )}

      {link && (
        <div className="card row" style={{ marginBottom: 6 }}>
          <div>
            <b>Know a neighbour who&apos;d love this?</b>
            <div className="muted small">They&apos;ll still be verified by an admin.</div>
          </div>
          <a className="btn sm nowrap" href={`https://wa.me/?text=${encodeURIComponent(`Join the ${community!.name} community marketplace: ${link}`)}`}>Invite</a>
        </div>
      )}

      <div className="page-head" style={{ marginTop: 22 }}><h2 style={{ margin: 0 }}>Recently added</h2></div>
      {(listings ?? []).length === 0 ? (
        <Empty emoji="🌱" title="Nothing listed yet" href={`/c/${slug}/sell`} cta="List something">Be the first neighbour to post a service or product.</Empty>
      ) : (
        <div className="listing-grid">
          {(listings ?? []).map((l) => (
            <ListingCard key={l.id} l={l as unknown as CardListing} slug={slug}
              thumb={thumbs.get(l.image_urls[0])} rating={ratingOf.get(l.id)} />
          ))}
        </div>
      )}
    </>
  );
}
