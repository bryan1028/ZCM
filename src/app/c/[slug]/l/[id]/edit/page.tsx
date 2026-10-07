import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, PRICE_UNITS } from "@/lib/catalog";
import VideoUpload from "@/components/video-upload";
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
    <>
      <p><Link href={`/c/${slug}/mine`}>← My listings</Link></p>
      <h2>{isNew ? "Listing published — add photos" : "Edit listing"}</h2>
      {error && <p className="card">{error}</p>}
      {saved && <p className="muted">Saved.</p>}

      <div className="card">
        <strong>Photos ({l.image_urls.length})</strong>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0" }}>
          {l.image_urls.map((path: string) => (
            <form action={removePhoto} key={path} style={{ position: "relative" }}>
              <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={id} />
              <input type="hidden" name="path" value={path} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {urls.get(path) && <img src={urls.get(path)} alt="" style={{ height: 110, borderRadius: 8, display: "block" }} />}
              <button className="secondary" style={{ position: "absolute", top: 4, right: 4, padding: "2px 8px" }} aria-label="Remove photo">✕</button>
            </form>
          ))}
        </div>
        <form action={addPhoto} style={{ gridTemplateColumns: "1fr auto" }}>
          <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={id} />
          <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required />
          <button>Upload</button>
        </form>
        <p className="muted">JPEG, PNG or WebP, up to 5 MB. Free accounts can add a few photos per listing.</p>
      </div>

      <div className="card">
        <strong>Video ({l.video_urls.length})</strong>
        {l.video_urls.map((path: string) => (
          <form action={removeVideo} key={path} style={{ margin: "8px 0" }}>
            <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={id} /><input type="hidden" name="path" value={path} />
            {vids.get(path) && <video src={vids.get(path)} controls preload="metadata" playsInline style={{ width: "100%", maxHeight: 260, borderRadius: 8 }} />}
            <button className="secondary">Remove video</button>
          </form>
        ))}
        <VideoUpload communityId={l.community_id} userId={user.id} attach={attachVideo.bind(null, slug, id)} />
        <p className="muted">MP4, WebM or MOV, up to 20 MB — a ~30 second clip works well. Free accounts can add 1 video per listing.</p>
      </div>

      <form action={saveDetails} className="card">
        <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={id} />
        <label>Title<input name="title" defaultValue={l.title} required minLength={3} maxLength={120} /></label>
        <label>Description<textarea name="description" rows={3} defaultValue={l.description ?? ""} /></label>
        <label>Category
          <select name="category" defaultValue={l.category}>
            {[...new Set([...CATEGORIES[l.kind as "service" | "product"], l.category])].map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label>Price (KES)<input name="price" type="number" min="0" defaultValue={l.price_cents != null ? l.price_cents / 100 : ""} /></label>
        <label>Price type
          <select name="price_unit" defaultValue={l.price_unit}>{Object.keys(PRICE_UNITS).map((u) => <option key={u} value={u}>{u.replace("_", " ")}</option>)}</select>
        </label>
        <label>Stock (optional)<input name="stock" type="number" min="0" defaultValue={l.stock ?? ""} /></label>
        <button>Save changes</button>
      </form>
    </>
  );
}
