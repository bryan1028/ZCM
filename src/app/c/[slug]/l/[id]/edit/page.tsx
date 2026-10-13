import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, UNITS_FOR, UNIT_LABEL } from "@/lib/catalog";
import { ChevronLeftIcon } from "@/components/icons";
import MediaUploader from "@/components/media-uploader";
import { signedUrls } from "@/lib/images";
import { getUser } from "@/lib/auth";
import Submit from "@/components/submit-button";

export const metadata = { title: "Edit listing" };

async function ctx(slug: string, id: string) {
  const supabase = await createClient();
  const { data: { user } } = await getUser(supabase);
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
  if (!price) return fail(here, "Please enter a price");
  if (!(Number(price) >= 0) || (stock && !(Number(stock) >= 0))) return fail(here, "Price and stock must be numbers, zero or more");
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

// Photos and videos are uploaded straight from the browser into the person's own storage folder (see MediaUploader);
// these two just record / forget the path on the listing. Row-level security and the plan-limit trigger still apply.
async function attachMedia(slug: string, id: string, kind: "image" | "video", path: string): Promise<{ error?: string }> {
  "use server";
  const { supabase, user, here } = await ctx(slug, id);
  const { data: l } = await supabase.from("listings").select("community_id, image_urls, video_urls").eq("id", id).single();
  if (!l || !path.startsWith(`${l.community_id}/${user.id}/`) || path.includes("..")) return { error: "Invalid upload" };
  const col = kind === "image" ? "image_urls" : "video_urls";
  const { error } = await supabase.from("listings").update({ [col]: [...l[col], path] }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(here);
  return {};
}

async function detachMedia(slug: string, id: string, kind: "image" | "video", path: string): Promise<{ error?: string }> {
  "use server";
  const { supabase, here } = await ctx(slug, id);
  const col = kind === "image" ? "image_urls" : "video_urls";
  const { data: l } = await supabase.from("listings").select(col).eq("id", id).single();
  if (!l) return { error: "Listing not found" };
  const { error } = await supabase.from("listings").update({ [col]: (l as unknown as Record<string, string[]>)[col].filter((p) => p !== path) }).eq("id", id);
  if (error) return { error: error.message };
  await supabase.storage.from(kind === "image" ? "zcm-listing-images" : "zcm-listing-videos").remove([path]);
  revalidatePath(here);
  return {};
}

export default async function Edit({ params, searchParams }: {
  params: Promise<{ slug: string; id: string }>; searchParams: Promise<{ error?: string; saved?: string; new?: string }>;
}) {
  const { slug, id } = await params;
  const { error, saved, new: isNew } = await searchParams;
  const { supabase, user } = await ctx(slug, id);
  const { data: l } = await supabase.from("listings")
    .select("id, kind, community_id, title, description, category, price_cents, price_unit, stock, image_urls, video_urls, sellers!inner(user_id, plan, account_type)").eq("id", id).maybeSingle();
  if (!l || (l.sellers as unknown as { user_id: string }).user_id !== user.id) notFound();
  const sl = l.sellers as unknown as { plan: string; account_type: string };
  const [urls, vids, { data: limits }] = await Promise.all([
    signedUrls(supabase, "zcm-listing-images", l.image_urls),
    signedUrls(supabase, "zcm-listing-videos", l.video_urls),
    supabase.from("plan_limits").select("max_images, max_videos").eq("plan", sl.plan).eq("account_type", sl.account_type).maybeSingle(),
  ]);

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
        <div className="row"><h3 style={{ margin: 0 }}>Photos &amp; video</h3></div>
        <MediaUploader
          communityId={l.community_id} userId={user.id}
          initial={[
            ...l.image_urls.flatMap((path: string) => (urls.get(path) ? [{ kind: "image" as const, path, url: urls.get(path)! }] : [])),
            ...l.video_urls.flatMap((path: string) => (vids.get(path) ? [{ kind: "video" as const, path, url: vids.get(path)! }] : [])),
          ]}
          maxImages={limits?.max_images ?? 6} maxVideos={limits?.max_videos ?? 1}
          attach={attachMedia.bind(null, slug, id)} detach={detachMedia.bind(null, slug, id)}
        />
        <p className="muted small" style={{ margin: 0 }}>Photos are shrunk automatically to save data. Videos: MP4, WebM or MOV up to 20 MB (about 30 seconds works well). The first photo is the cover.</p>
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
          <label className="grow">Price (KES)<input name="price" type="number" inputMode="decimal" step="any" min="0" required defaultValue={l.price_cents != null ? l.price_cents / 100 : ""} /></label>
          <label className="grow">Price type
            <select name="price_unit" defaultValue={l.price_unit}>{[...new Set([...UNITS_FOR[l.kind as "service" | "product"], l.price_unit as keyof typeof UNIT_LABEL])].map((u) => <option key={u} value={u}>{UNIT_LABEL[u]}</option>)}</select>
          </label>
        </div>
        <label>Stock <span className="hint">(optional)</span><input name="stock" type="number" inputMode="numeric" min="0" defaultValue={l.stock ?? ""} /></label>
        <Submit>Save changes</Submit>
      </form>
      <p style={{ textAlign: "center", marginTop: 14 }}><Link href={`/c/${slug}/l/${id}`} className="muted">View listing →</Link></p>
    </div>
  );
}
