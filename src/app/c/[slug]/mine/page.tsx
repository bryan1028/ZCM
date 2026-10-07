import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatPrice, type PRICE_UNITS } from "@/lib/catalog";
import { signedUrls } from "@/lib/images";
import Empty from "@/components/empty";
import ActionButton from "@/components/action-button";

async function setStatus(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const status = String(formData.get("status"));
  if (["active", "paused", "sold"].includes(status)) {
    const { error } = await supabase.from("listings").update({ status }).eq("id", String(formData.get("id")));
    if (error) redirect(`${formData.get("back")}?error=${encodeURIComponent(error.message)}`);
  }
  redirect(String(formData.get("back")));
}

async function feature(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const on = formData.get("on") === "true";
  const { error } = await supabase.from("listings")
    .update({ featured_until: on ? new Date(Date.now() + 7 * 86400000).toISOString() : null }).eq("id", String(formData.get("id")));
  redirect(`${formData.get("back")}${error ? `?error=${encodeURIComponent(error.message)}` : ""}`);
}

async function remove(formData: FormData) {
  "use server";
  const supabase = await createClient();
  await supabase.from("listings").update({ status: "removed" }).eq("id", String(formData.get("id")));
  redirect(String(formData.get("back")));
}

export default async function Mine({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ error?: string }> }) {
  const { slug } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: seller } = await supabase.from("sellers").select("id, account_type, plan, communities!inner(slug, currency)")
    .eq("communities.slug", slug).eq("user_id", user!.id).maybeSingle();
  if (!seller) {
    return <Empty emoji="🏷️" title="You haven't listed anything yet" href={`/c/${slug}/sell`} cta="Create your first listing">Sell a product or offer a service to your neighbours.</Empty>;
  }

  const { data: listings } = await supabase.from("listings")
    .select("id, title, status, kind, price_cents, price_unit, featured_until, image_urls").eq("seller_id", seller.id).neq("status", "removed").order("created_at", { ascending: false });
  const { data: counts } = await supabase.from("listing_view_counts").select("listing_id, views, unique_viewers")
    .in("listing_id", (listings ?? []).map((l) => l.id));
  const views = new Map((counts ?? []).map((c) => [c.listing_id, c]));
  const thumbs = await signedUrls(supabase, "zcm-listing-images", (listings ?? []).flatMap((l) => l.image_urls.slice(0, 1)));
  const { data: limits } = await supabase.from("plan_limits").select("can_feature, can_see_analytics")
    .eq("account_type", seller.account_type).eq("plan", seller.plan).single();
  const currency = (seller.communities as unknown as { currency: string }).currency;
  const back = `/c/${slug}/mine`;
  const TONE: Record<string, string> = { active: "brand", paused: "accent", sold: "info" };

  return (
    <>
      <div className="page-head">
        <div><h1>My listings</h1><p className="muted"><span className="badge">{seller.account_type} · {seller.plan}</span></p></div>
        <div className="row gap-sm">
          <Link href={`/c/${slug}/dashboard`} className="btn secondary sm">Dashboard{limits?.can_see_analytics ? "" : " 🔒"}</Link>
          <Link href={`/c/${slug}/sell`} className="btn sm">+ New</Link>
        </div>
      </div>
      {error && <div className="alert error" role="alert" style={{ marginBottom: 12 }}>{error}</div>}
      {(listings ?? []).length === 0 && <Empty emoji="🏷️" title="Nothing listed right now" href={`/c/${slug}/sell`} cta="Add a listing" />}
      <div className="list">
        {(listings ?? []).map((l) => {
          const thumb = thumbs.get(l.image_urls[0]);
          const isFeatured = !!l.featured_until && new Date(l.featured_until) > new Date();
          return (
            <div className="card stack" key={l.id}>
              <div className="row row-start" style={{ justifyContent: "flex-start" }}>
                {thumb
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img className="thumb" src={thumb} alt="" />
                  : <div className="thumb listing-ph" style={{ fontSize: 24 }} aria-hidden>🏷️</div>}
                <div className="grow">
                  <div className="row row-start">
                    <Link href={`/c/${slug}/l/${l.id}`} style={{ fontWeight: 650, color: "var(--ink)" }}>{l.title}</Link>
                    <span className={`badge ${TONE[l.status] ?? ""}`}>{l.status}</span>
                  </div>
                  <div className="muted small">
                    {formatPrice(l.price_cents, l.price_unit as keyof typeof PRICE_UNITS, currency)} · 👁 {views.get(l.id)?.views ?? 0} views
                    {isFeatured && <> · <span className="badge accent">⭐ Featured</span></>}
                  </div>
                </div>
              </div>
              <div className="inline-form">
                <Link href={`/c/${slug}/l/${l.id}/edit`} className="btn secondary sm">Edit & photos</Link>
                {l.status === "active" && <ActionButton action={setStatus} fields={{ id: l.id, back, status: "paused" }} className="secondary sm">Pause</ActionButton>}
                {l.status !== "active" && <ActionButton action={setStatus} fields={{ id: l.id, back, status: "active" }} className="secondary sm">Activate</ActionButton>}
                {l.status !== "sold" && <ActionButton action={setStatus} fields={{ id: l.id, back, status: "sold" }} className="secondary sm">Mark sold</ActionButton>}
                {limits?.can_feature && l.status === "active" && (
                  isFeatured
                    ? <ActionButton action={feature} fields={{ id: l.id, back, on: "false" }} className="secondary sm">Unfeature</ActionButton>
                    : <ActionButton action={feature} fields={{ id: l.id, back, on: "true" }} className="secondary sm">⭐ Feature 7 days</ActionButton>
                )}
              </div>
              <details>
                <summary className="muted small" style={{ cursor: "pointer" }}>Delete listing…</summary>
                <form action={remove} className="inline-form" style={{ marginTop: 8 }}>
                  <input type="hidden" name="id" value={l.id} /><input type="hidden" name="back" value={back} />
                  <span className="small">This removes it from the marketplace.</span>
                  <button className="danger sm">Yes, delete</button>
                </form>
              </details>
            </div>
          );
        })}
      </div>
    </>
  );
}
