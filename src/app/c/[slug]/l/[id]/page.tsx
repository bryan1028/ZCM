import { Fragment } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { pushSoon } from "@/lib/push";
import { createClient } from "@/lib/supabase/server";
import { CATEGORY_EMOJI, formatPrice, PRICE_UNITS } from "@/lib/catalog";
import { ChatIcon, ChevronLeftIcon } from "@/components/icons";
import ActionButton from "@/components/action-button";
import MediaCarousel, { type MediaItem } from "@/components/media-carousel";
import { signedUrls } from "@/lib/images";
import { usernamesFor } from "@/lib/usernames";
import { getUser } from "@/lib/auth";
import { done } from "@/lib/after-action";
import Submit from "@/components/submit-button";

async function ctx(slug: string, id: string) {
  const supabase = await createClient();
  const { data: { user } } = await getUser(supabase);
  if (!user) redirect("/login");
  return { supabase, user, back: `/c/${slug}/l/${id}` };
}

async function startChat(formData: FormData) {
  "use server";
  const slug = String(formData.get("slug")), id = String(formData.get("id"));
  const { supabase, back } = await ctx(slug, id);
  const { data, error } = await supabase.rpc("start_conversation", { lid: id });
  redirect(error ? `${back}?error=${encodeURIComponent(error.message)}` : `/c/${slug}/inbox/${data}`);
}

async function reserve(formData: FormData) {
  "use server";
  const slug = String(formData.get("slug")), id = String(formData.get("id"));
  const { supabase, back } = await ctx(slug, id);
  const { error } = await supabase.rpc("create_reservation", {
    lid: id, qty: Math.max(1, Number(formData.get("qty")) || 1), note_text: String(formData.get("note") ?? ""),
  });
  pushSoon();
  redirect(error ? `${back}?error=${encodeURIComponent(error.message)}` : `/c/${slug}/orders`);
}

async function addReview(formData: FormData) {
  "use server";
  const slug = String(formData.get("slug")), id = String(formData.get("id"));
  const { supabase, user, back } = await ctx(slug, id);
  const rating = Number(formData.get("rating"));
  const { error } = await supabase.from("reviews").upsert(
    { listing_id: id, reviewer_id: user.id, rating, comment: String(formData.get("comment") ?? "").trim() || null },
    { onConflict: "listing_id,reviewer_id" },
  );
  if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);
  await done(back);
}

async function report(formData: FormData) {
  "use server";
  const slug = String(formData.get("slug")), id = String(formData.get("id"));
  const { supabase, user, back } = await ctx(slug, id);
  const { data: l } = await supabase.from("listings").select("community_id").eq("id", id).single();
  if (!l) redirect(back);
  const targetId = String(formData.get("target_id"));
  await supabase.from("reports").insert({
    community_id: l.community_id, reporter_id: user.id,
    target_type: String(formData.get("target_type")) === "review" ? "review" : "listing",
    target_id: targetId, reason: String(formData.get("reason")).trim(),
  });
  redirect(`${back}?reported=1`);
}

async function toggleAvailable(formData: FormData) {
  "use server";
  const slug = String(formData.get("slug")), id = String(formData.get("id"));
  const { supabase, back } = await ctx(slug, id);
  await supabase.from("listings").update({ available: formData.get("available") === "true" }).eq("id", id);
  await done(back);
}

export default async function ListingPage({ params, searchParams }: {
  params: Promise<{ slug: string; id: string }>; searchParams: Promise<{ error?: string; reported?: string }>;
}) {
  const { slug, id } = await params;
  const { error, reported } = await searchParams;
  const { supabase, user } = await ctx(slug, id);

  const { data: l } = await supabase
    .from("listings")
    .select("id, kind, community_id, title, description, category, price_cents, price_unit, stock, available, image_urls, video_urls, sellers(user_id, display_name, business_name, account_type, whatsapp), communities(currency)")
    .eq("id", id).maybeSingle();
  if (!l) notFound();
  const s = l.sellers as unknown as { user_id: string; display_name: string; business_name: string | null; account_type: string; whatsapp: string | null };
  const currency = (l.communities as unknown as { currency: string }).currency;
  const mine = s.user_id === user.id;

  // One round for everything that only needs the listing, then one for usernames (which needs the reviewers).
  const [, { data: reviews }, { data: views }, photos, videos] = await Promise.all([
    supabase.rpc("record_view", { lid: id }), // no-op for the seller's own views
    supabase.from("reviews").select("id, rating, comment, reviewer_id, created_at").eq("listing_id", id).order("created_at", { ascending: false }),
    mine ? supabase.from("listing_view_counts").select("views, unique_viewers").eq("listing_id", id).maybeSingle() : Promise.resolve({ data: null }),
    signedUrls(supabase, "zcm-listing-images", l.image_urls),
    signedUrls(supabase, "zcm-listing-videos", l.video_urls),
  ]);
  const names = await usernamesFor(supabase, l.community_id, [s.user_id, ...(reviews ?? []).map((r) => r.reviewer_id)]);
  const media: MediaItem[] = [
    ...l.image_urls.flatMap((path: string) => (photos.get(path) ? [{ type: "image" as const, src: photos.get(path)! }] : [])),
    ...l.video_urls.flatMap((path: string) => (videos.get(path) ? [{ type: "video" as const, src: videos.get(path)! }] : [])),
  ];
  const myReview = (reviews ?? []).find((r) => r.reviewer_id === user.id);

  const sellerName = s.business_name ?? s.display_name;
  const sellerHandle = names.get(s.user_id) ?? "neighbour";
  const avg = (reviews ?? []).length ? (reviews ?? []).reduce((n, r) => n + r.rating, 0) / (reviews ?? []).length : null;
  const listPath = `/c/${slug}/${l.kind === "service" ? "services" : "products"}`;
  const verb = l.kind === "service" ? "Book" : "Reserve";

  return (
    <>
      <p style={{ margin: "0 0 10px" }}>
        <Link href={listPath} className="row gap-sm" style={{ justifyContent: "flex-start", display: "inline-flex" }}><ChevronLeftIcon size={18} />Back to {l.kind === "service" ? "services" : "products"}</Link>
      </p>

      <div className="detail-grid">
        <div className="detail-media">
          {media.length > 0 ? (
            <MediaCarousel items={media} alt={l.title} />
          ) : (
            <div className="carousel carousel-empty"><div className="listing-ph" style={{ fontSize: 72 }} aria-hidden>{CATEGORY_EMOJI[l.category] ?? "✨"}</div></div>
          )}
        </div>

        <div className="stack">
          <div>
            <div className="row gap-sm wrap" style={{ justifyContent: "flex-start", marginBottom: 8 }}>
              <span className="badge">{l.kind === "service" ? "Service" : "Product"} · {l.category}</span>
              {s.account_type === "business" && <span className="badge brand">Business</span>}
              {!l.available && <span className="badge danger">Unavailable</span>}
              {l.stock != null && l.stock <= 3 && l.stock > 0 && <span className="badge accent">Only {l.stock} left</span>}
            </div>
            <h1>{l.title}</h1>
            <div className="price-big" style={{ marginTop: 6 }}>{formatPrice(l.price_cents, l.price_unit as keyof typeof PRICE_UNITS, currency)}</div>
          </div>

          <div className="card flat row" style={{ justifyContent: "flex-start" }}>
            <span className="avatar avatar-lg" aria-hidden>{sellerName.slice(0, 1)}</span>
            <div className="grow">
              <div style={{ fontWeight: 650 }}>{sellerName}</div>
              <div className="muted small">@{sellerHandle}{avg != null && <> · <span className="stars">★ {avg.toFixed(1)}</span> ({reviews?.length})</>}</div>
            </div>
          </div>

          {l.description && (
            <section className="detail-desc">
              <h3>About this {l.kind === "service" ? "service" : "product"}</h3>
              <p>{l.description}</p>
            </section>
          )}
          {l.stock != null && <p className="muted small" style={{ margin: 0 }}>{l.stock} in stock</p>}

          {mine ? (
            <div className="card stack">
              <div className="row">
                <div><b>This is your listing</b><div className="muted small">👁 {views?.views ?? 0} views · {views?.unique_viewers ?? 0} neighbours</div></div>
                <Link href={`/c/${slug}/l/${id}/edit`} className="btn sm">Edit</Link>
              </div>
              <ActionButton action={toggleAvailable} fields={{ slug, id, available: String(!l.available) }} className="secondary">Mark as {l.available ? "unavailable" : "available"}</ActionButton>
            </div>
          ) : (
            <div className="sticky-cta">
              <div className="cta-bar">
                {l.available && (
                  <form action={reserve} style={{ gridTemplateColumns: "76px 1fr", gap: 8 }}>
                    <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={id} />
                    <input name="qty" type="number" min="1" defaultValue="1" aria-label="Quantity" />
                    <input name="note" placeholder="Note: pickup time, flat no." maxLength={500} aria-label="Note to seller" />
                    <Submit style={{ gridColumn: "1 / -1" }}>{verb} {l.kind === "service" ? "this service" : "now"}</Submit>
                  </form>
                )}
                <form action={startChat}>
                  <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={id} />
                  <Submit className="secondary"><ChatIcon size={18} />Message @{sellerHandle}</Submit>
                </form>
                {s.whatsapp && <a className="muted small center" href={`https://wa.me/${s.whatsapp.replace(/\D/g, "")}`}>or reach out on WhatsApp</a>}
                {error && <div className="alert error" role="alert">{error}</div>}
              </div>
            </div>
          )}
        </div>
      </div>

      <h2 style={{ marginTop: 28 }}>Reviews {avg != null && <span className="stars" style={{ fontSize: 16 }}>★ {avg.toFixed(1)} <span className="muted">({reviews?.length})</span></span>}</h2>
      {(reviews ?? []).length === 0 && <p className="muted">No reviews yet{!mine ? ". Be the first once you've dealt with this seller." : "."}</p>}
      <div className="list">
        {(reviews ?? []).map((r) => {
          const who = names.get(r.reviewer_id) ?? "neighbour";
          return (
            <div className="card flat" key={r.id}>
              <div className="row" style={{ justifyContent: "flex-start", alignItems: "flex-start" }}>
                <span className="avatar" aria-hidden>{who.slice(0, 1)}</span>
                <div className="grow">
                  <div className="row"><b>@{who}</b><span className="stars" aria-label={`${r.rating} out of 5`}>{"★".repeat(r.rating)}<span style={{ color: "var(--line)" }}>{"★".repeat(5 - r.rating)}</span></span></div>
                  {r.comment && <p style={{ margin: "4px 0 0" }}>{r.comment}</p>}
                  {r.reviewer_id !== user.id && (
                    <details style={{ marginTop: 6 }}><summary className="muted small" style={{ cursor: "pointer" }}>Report review</summary>
                      <ReportForm slug={slug} id={id} type="review" target={r.id} />
                    </details>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!mine && (
        <form action={addReview} className="card stack" style={{ marginTop: 14 }}>
          <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={id} />
          <strong>{myReview ? "Update your review" : "Leave a review"}</strong>
          <div className="star-input" role="radiogroup" aria-label="Rating">
            {[5, 4, 3, 2, 1].map((n) => (
              <Fragment key={n}>
                <input type="radio" name="rating" id={`r${n}`} value={n} defaultChecked={(myReview?.rating ?? 5) === n} />
                <label htmlFor={`r${n}`} title={`${n} star${n > 1 ? "s" : ""}`}>★</label>
              </Fragment>
            ))}
          </div>
          <label>Comment <span className="hint">(optional)</span><textarea name="comment" rows={2} defaultValue={myReview?.comment ?? ""} placeholder="How was it?" /></label>
          <Submit>Save review</Submit>
        </form>
      )}
      {!mine && (
        <details style={{ marginTop: 14 }}><summary className="muted small" style={{ cursor: "pointer" }}>Report this listing</summary>
          <ReportForm slug={slug} id={id} type="listing" target={id} />
        </details>
      )}
      {reported && <div className="alert ok" style={{ marginTop: 12 }}>Thanks, an admin will take a look.</div>}
    </>
  );
}

function ReportForm({ slug, id, type, target }: { slug: string; id: string; type: string; target: string }) {
  return (
    <form action={report} className="stack" style={{ marginTop: 8 }}>
      <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={id} />
      <input type="hidden" name="target_type" value={type} /><input type="hidden" name="target_id" value={target} />
      <label>What&apos;s wrong?<textarea name="reason" rows={2} required minLength={3} /></label>
      <Submit className="secondary sm">Send report</Submit>
    </form>
  );
}
