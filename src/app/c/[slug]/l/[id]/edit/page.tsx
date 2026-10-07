import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, PRICE_UNITS } from "@/lib/catalog";
import { ChevronLeftIcon } from "@/components/icons";
import VideoUpload from "@/components/video-upload";
import ImageInput from "@/components/image-input";
import { extFor, MAX_UPLOAD_BYTES, signedUrls } from "@/lib/images";

async function ctx(slug: string, id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user, here: `/c/${slug}/l/${id}/edit` };
}
const fail = (here: string, msg: string): never => redirect(`${here}?error=${encodeURIComponent(msg)}`);

async function saveDetails(formData: FormData) {
  "use server";
  const slug = String(formData.get("slug")), id = String(formData.get("id"));
  const { supabase, here } = await ctx(slug, id);
  const price = String(formData.get("price") ?? "").trim();
  const stock = String(formData.get("stock") ?? "").trim();
  if ((price && !(Number(price) >= 0)) || (stock && !(Number(stock) >= 0))) return fail(here, "Price and stock must be numbers, zero or more");
  const { error } = await supabase.from("listings").update({
    title: String(formData.get("title")).trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    category: String(formData.get("category")),
    price_cents: price ? Math.round(Number(price) * 100) : null,
    price_unit: String(formData.get("price_unit")),
    stock: stock ? Number(stock) : null,
  }).eq("id", id);
  if (error) fail(here, error.message);
  redirect(`${here}?saved=1`);
}

async function addPhoto(formData: FormData) {
  "use server";
  const slug = String(formData.get("slug")), id = String(formData.get("id"));
  const { supabase, user, here } = await ctx(slug, id);
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return fail(here, "Choose a photo first");
  const ext = extFor(file);
  if (!ext) return fail(here, "Photos must be JPEG, PNG or WebP");
  if (file.size > MAX_UPLOAD_BYTES) return fail(here, "Photo is larger than 5 MB");

  const { data: l } = await supabase.from("listings").select("community_id, image_urls").eq("id", id).single();
  if (!l) return fail(here, "Listing not found");
  const path = `${l.community_id}/${user.id}/${randomUUID()}.${ext}`;
  const up = await supabase.storage.from("zcm-listing-images").upload(path, file, { contentType: file.type });
  if (up.error) return fail(here, up.error.message);
  const { error } = await supabase.from("listings").update({ image_urls: [...l.image_urls, path] }).eq("id", id);
  if (error) {                       // e.g. over the plan's image limit → don't leave an orphan file behind
    await supabase.storage.from("zcm-listing-images").remove([path]);
    return fail(here, error.message);
  }
  redirect(here);
}

async function removePhoto(formData: FormData) {
  "use server";
  const slug = String(formData.get("slug")), id = String(formData.get("id"));
  const { supabase, here } = await ctx(slug, id);
  const path = String(formData.get("path"));
  const { data: l } = await supabase.from("listings").select("image_urls").eq("id", id).single();
  if (l) {
    await supabase.from("listings").update({ image_urls: l.image_urls.filter((p: string) => p !== path) }).eq("id", id);
    await supabase.storage.from("zcm-listing-images").remove([path]);
  }
  redirect(here);
}

async function attachVideo(slug: string, id: string, path: string): Promise<{ error?: string }> {
  "use server";
  const { supabase, user } = await ctx(slug, id);
  // the path must sit in this user's own folder for this listing's community
  const { data: l } = await supabase.from("listings").select("community_id, video_urls").eq("id", id).single();
  if (!l || !path.startsWith(`${l.community_id}/${user.id}/`)) return { error: "Invalid upload" };
  const { error } = await supabase.from("listings").update({ video_urls: [...l.video_urls, path] }).eq("id", id);
  return error ? { error: error.message } : {};
}

async function removeVideo(formData: FormData) {
  "use server";
  const slug = String(formData.get("slug")), id = String(formData.get("id"));
  const { supabase, here } = await ctx(slug, id);
  const path = String(formData.get("path"));
  const { data: l } = await supabase.from("listings").select("video_urls").eq("id", id).single();
  if (l) {
    await supabase.from("listings").update({ video_urls: l.video_urls.filter((p: string) => p !== path) }).eq("id", id);
    await supabase.storage.from("zcm-listing-videos").remove([path]);
  }
  redirect(here);
}

export default async function Edit({ params, searchParams }: {
  params: Promise<{ slug: string; id: string }>; searchParams: Promise<{ error?: string; saved?: string; new?: string }>;
}) {
  const { slug, id } = await params;
  const { error, saved, new: isNew } = await searchParams;
  const { supabase, user } = await ctx(slug, id);
  const { data: l } = await supabase.from("listings")
    .select("id, kind, community_id, title, description, category, price_cents, price_unit, stock, image_urls, video_urls, sellers!inner(user_id)").eq("id", id).maybeSingle();
  if (!l || (l.sellers as unknown as { user_id: string }).user_id !== user.id) notFound();
  const urls = await signedUrls(supabase, "zcm-listing-images", l.image_urls);
  const vids = await signedUrls(supabase, "zcm-listing-videos", l.video_urls);

  return (
    <div className="page-narrow">
      <p style={{ margin: "0 0 10px" }}><Link href={`/c/${slug}/mine`} className="row gap-sm" style={{ justifyContent: "flex-start", display: "inline-flex" }}><ChevronLeftIcon size={18} />My listings</Link></p>
      <div className="page-head"><div>
        <h1>{isNew ? "Published! Add some photos" : "Edit listing"}</h1>
        <p className="muted">{isNew ? "Listings with photos get far more attention." : l.title}</p>
      </div></div>
      {error && <div className="alert error" role="alert" style={{ marginBottom: 12 }}>{error}</div>}
      {saved && <div className="alert ok" role="status" style={{ marginBottom: 12 }}>Changes saved.</div>}

      <section className="card stack" style={{ marginBottom: 14 }}>
        <div className="row"><h3 style={{ margin: 0 }}>Photos</h3><span className="muted small">{l.image_urls.length} added</span></div>
        {l.image_urls.length > 0 && (
          <div className="photo-grid">
            {l.image_urls.map((path: string) => (
              <form action={removePhoto} key={path} className="photo">
                <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={id} />
                <input type="hidden" name="path" value={path} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {urls.get(path) && <img src={urls.get(path)} alt="" />}
                <button aria-label="Remove photo" title="Remove">✕</button>
              </form>
            ))}
          </div>
        )}
        <form action={addPhoto} className="stack">
          <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={id} />
          <ImageInput name="photo" required />
          <button>Upload photo</button>
        </form>
        <p className="muted small" style={{ margin: 0 }}>JPEG, PNG or WebP. Big photos are shrunk automatically to save data.</p>
      </section>

      <section className="card stack" style={{ marginBottom: 14 }}>
        <div className="row"><h3 style={{ margin: 0 }}>Video</h3><span className="muted small">{l.video_urls.length} added</span></div>
        {l.video_urls.map((path: string) => (
          <form action={removeVideo} key={path} className="stack">
            <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={id} /><input type="hidden" name="path" value={path} />
            {vids.get(path) && <video src={vids.get(path)} controls preload="metadata" playsInline style={{ width: "100%", maxHeight: 280, borderRadius: 12 }} />}
            <button className="danger sm" style={{ justifySelf: "start" }}>Remove video</button>
          </form>
        ))}
        <VideoUpload communityId={l.community_id} userId={user.id} attach={attachVideo.bind(null, slug, id)} />
        <p className="muted small" style={{ margin: 0 }}>MP4, WebM or MOV, up to 20 MB. A ~30 second clip works well.</p>
      </section>

      <form action={saveDetails} className="card stack">
        <h3 style={{ margin: 0 }}>Details</h3>
        <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={id} />
        <label>Title<input name="title" defaultValue={l.title} required minLength={3} maxLength={120} /></label>
        <label>Description<textarea name="description" rows={4} defaultValue={l.description ?? ""} /></label>
        <label>Category
          <select name="category" defaultValue={l.category}>
            {[...new Set([...CATEGORIES[l.kind as "service" | "product"], l.category])].map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <div className="row" style={{ alignItems: "flex-end" }}>
          <label className="grow">Price (KES)<input name="price" type="number" inputMode="numeric" min="0" defaultValue={l.price_cents != null ? l.price_cents / 100 : ""} /></label>
          <label className="grow">Price type
            <select name="price_unit" defaultValue={l.price_unit}>{Object.keys(PRICE_UNITS).map((u) => <option key={u} value={u}>{u.replace("_", " ")}</option>)}</select>
          </label>
        </div>
        <label>Stock <span className="hint">(optional)</span><input name="stock" type="number" inputMode="numeric" min="0" defaultValue={l.stock ?? ""} /></label>
        <button>Save changes</button>
      </form>
      <p style={{ textAlign: "center", marginTop: 14 }}><Link href={`/c/${slug}/l/${id}`} className="muted">View listing →</Link></p>
    </div>
  );
}
