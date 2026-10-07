import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { signedUrls } from "@/lib/images";
import { siteUrl } from "@/lib/nav";
import ListingCard, { type CardListing } from "@/components/listing-card";

// Community home: announcements from admins, an invite prompt, and what's new.
export default async function Feed({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: community } = await supabase.from("communities").select("id, name").eq("slug", slug).single();

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
  const thumbs = await signedUrls(supabase, "listing-images", (listings ?? []).flatMap((l) => l.image_urls.slice(0, 1)));

  const link = code ? `${siteUrl((await headers()).get("host"))}/invite/${code}?ref=${me?.username ?? ""}` : null;

  return (
    <>
      {(announcements ?? []).map((a) => (
        <div className="card" key={a.id} style={{ borderLeft: "4px solid var(--accent)" }}>
          <strong>{a.pinned ? "📌 " : "📣 "}{a.title}</strong>
          {a.body && <p style={{ whiteSpace: "pre-wrap" }}>{a.body}</p>}
          <span className="muted">{new Date(a.created_at).toLocaleDateString()}</span>
        </div>
      ))}

      {link && (
        <div className="card row" style={{ alignItems: "center" }}>
          <span>Know a neighbour who&apos;d love this? <span className="muted">They&apos;ll still be verified by an admin.</span></span>
          <a href={`https://wa.me/?text=${encodeURIComponent(`Join the ${community!.name} community marketplace: ${link}`)}`}>
            <button type="button">Invite on WhatsApp</button>
          </a>
        </div>
      )}

      <h2>Recently added</h2>
      {(listings ?? []).length === 0 && <div className="card">Nothing listed yet — be the first!</div>}
      {(listings ?? []).map((l) => (
        <ListingCard key={l.id} l={l as unknown as CardListing} slug={slug}
          thumb={thumbs.get(l.image_urls[0])} rating={ratingOf.get(l.id)} />
      ))}
    </>
  );
}
