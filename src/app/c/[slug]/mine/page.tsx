import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatPrice, type PRICE_UNITS } from "@/lib/catalog";

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
  if (!seller) return <div className="card">You haven&apos;t listed anything yet. <Link href={`/c/${slug}/sell`}>Create your first listing</Link>.</div>;

  const { data: listings } = await supabase.from("listings")
    .select("id, title, status, kind, price_cents, price_unit").eq("seller_id", seller.id).neq("status", "removed").order("created_at", { ascending: false });
  const { data: counts } = await supabase.from("listing_view_counts").select("listing_id, views, unique_viewers")
    .in("listing_id", (listings ?? []).map((l) => l.id));
  const views = new Map((counts ?? []).map((c) => [c.listing_id, c]));
  const currency = (seller.communities as unknown as { currency: string }).currency;
  const back = `/c/${slug}/mine`;

  return (
    <>
      <div className="row"><h2>My listings</h2><span className="badge">{seller.account_type} · {seller.plan}</span></div>
      {error && <p className="card">{error}</p>}
      {(listings ?? []).map((l) => (
        <div className="card" key={l.id}>
          <div className="row">
            <Link href={`/c/${slug}/l/${l.id}`}><strong>{l.title}</strong></Link>
            <span className="badge">{l.status}</span>
          </div>
          <p className="muted">
            {formatPrice(l.price_cents, l.price_unit as keyof typeof PRICE_UNITS, currency)} · 👁 {views.get(l.id)?.views ?? 0} views
          </p>
          <form action={setStatus} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input type="hidden" name="id" value={l.id} /><input type="hidden" name="back" value={back} />
            <Link href={`/c/${slug}/l/${l.id}/edit`}><button type="button" className="secondary">Edit / photos</button></Link>
            {l.status === "active" && <button className="secondary" name="status" value="paused">Pause</button>}
            {l.status !== "active" && <button className="secondary" name="status" value="active">Activate</button>}
            {l.status !== "sold" && <button className="secondary" name="status" value="sold">Mark sold</button>}
            <button className="secondary" formAction={remove}>Delete</button>
          </form>
        </div>
      ))}
      {(listings ?? []).length === 0 && <div className="card">Nothing listed. <Link href={`/c/${slug}/sell`}>Add a listing</Link>.</div>}
    </>
  );
}
