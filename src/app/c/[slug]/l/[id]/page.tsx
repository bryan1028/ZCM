import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { pushSoon } from "@/lib/push";
import { createClient } from "@/lib/supabase/server";
import { formatPrice, PRICE_UNITS } from "@/lib/catalog";
import { signedUrls } from "@/lib/images";
import { usernamesFor } from "@/lib/usernames";

async function ctx(slug: string, id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
  redirect(error ? `${back}?error=${encodeURIComponent(error.message)}` : back);
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
  redirect(back);
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

  await supabase.rpc("record_view", { lid: id }); // no-op for the seller's own views

  const [{ data: reviews }, { data: views }] = await Promise.all([
    supabase.from("reviews").select("id, rating, comment, reviewer_id, created_at").eq("listing_id", id).order("created_at", { ascending: false }),
    mine ? supabase.from("listing_view_counts").select("views, unique_viewers").eq("listing_id", id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const names = await usernamesFor(supabase, l.community_id, [s.user_id, ...(reviews ?? []).map((r) => r.reviewer_id)]);
  const photos = await signedUrls(supabase, "listing-images", l.image_urls);
  const videos = await signedUrls(supabase, "listing-videos", l.video_urls);
  const myReview = (reviews ?? []).find((r) => r.reviewer_id === user.id);

  return (
    <>
      <p><Link href={`/c/${slug}/${l.kind === "service" ? "services" : "products"}`}>← Back</Link></p>
      <article className="card">
        <div className="row">
          <h2 style={{ margin: 0 }}>{l.title}</h2>
          <strong>{formatPrice(l.price_cents, l.price_unit as keyof typeof PRICE_UNITS, currency)}</strong>
        </div>
        {l.image_urls.length > 0 && (
          <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 8 }}>
            {l.image_urls.map((path: string) => photos.get(path) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={path} src={photos.get(path)} alt={l.title} style={{ height: 220, borderRadius: 8 }} />
            ))}
          </div>
        )}
        {l.video_urls.map((path: string) => videos.get(path) && (
          <video key={path} src={videos.get(path)} controls preload="metadata" playsInline style={{ width: "100%", maxHeight: 360, borderRadius: 8, marginBottom: 8 }} />
        ))}
        <p>{l.description}</p>
        <p className="muted">
          {l.category} · {s.business_name ?? s.display_name} (@{names.get(s.user_id) ?? "neighbour"}) {s.account_type === "business" && <span className="badge">Business</span>}
          {l.stock != null && <> · {l.stock} in stock</>} {!l.available && <span className="badge">Unavailable</span>}
        </p>
        {!mine && (
          <form action={startChat} style={{ marginBottom: 8 }}>
            <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={id} />
            <button>Message @{names.get(s.user_id) ?? "seller"}</button>
          </form>
        )}
        {!mine && l.available && (
          <form action={reserve} style={{ margin: "8px 0", gridTemplateColumns: "80px 1fr auto" }}>
            <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={id} />
            <input name="qty" type="number" min="1" defaultValue="1" aria-label="Quantity" />
            <input name="note" placeholder="Note (pickup time, flat no.)" maxLength={500} />
            <button>{l.kind === "service" ? "Book" : "Reserve"}</button>
          </form>
        )}
        {mine && <p><Link href={`/c/${slug}/l/${id}/edit`}>Edit listing & photos</Link></p>}
        {s.whatsapp && <a href={`https://wa.me/${s.whatsapp.replace(/\D/g, "")}`}>Message on WhatsApp</a>}
        {mine && (
          <form action={toggleAvailable} style={{ marginTop: 12 }}>
            <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={id} />
            <p className="muted">👁 {views?.views ?? 0} views · {views?.unique_viewers ?? 0} neighbours</p>
            <button className="secondary" name="available" value={String(!l.available)}>
              Mark as {l.available ? "unavailable" : "available"}
            </button>
          </form>
        )}
      </article>

      <h3>Reviews</h3>
      {(reviews ?? []).length === 0 && <p className="muted">No reviews yet.</p>}
      {(reviews ?? []).map((r) => (
        <div className="card" key={r.id}>
          <div className="row"><strong>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</strong>
            <span className="muted">@{names.get(r.reviewer_id) ?? "neighbour"}</span></div>
          {r.comment && <p>{r.comment}</p>}
          {r.reviewer_id !== user.id && (
            <details><summary className="muted">Report review</summary>
              <ReportForm slug={slug} id={id} type="review" target={r.id} />
            </details>
          )}
        </div>
      ))}

      {!mine && (
        <form action={addReview} className="card">
          <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={id} />
          <strong>{myReview ? "Update your review" : "Leave a review"}</strong>
          <label>Rating
            <select name="rating" defaultValue={myReview?.rating ?? 5}>{[5, 4, 3, 2, 1].map((n) => <option key={n}>{n}</option>)}</select>
          </label>
          <label>Comment<textarea name="comment" rows={2} defaultValue={myReview?.comment ?? ""} /></label>
          <button>Save review</button>
          {error && <p className="muted">{error}</p>}
        </form>
      )}
      {!mine && (
        <details><summary className="muted">Report this listing</summary>
          <ReportForm slug={slug} id={id} type="listing" target={id} />
        </details>
      )}
      {reported && <p className="muted">Thanks — an admin will take a look.</p>}
    </>
  );
}

function ReportForm({ slug, id, type, target }: { slug: string; id: string; type: string; target: string }) {
  return (
    <form action={report}>
      <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={id} />
      <input type="hidden" name="target_type" value={type} /><input type="hidden" name="target_id" value={target} />
      <label>What&apos;s wrong?<textarea name="reason" rows={2} required minLength={3} /></label>
      <button className="secondary">Send report</button>
    </form>
  );
}
