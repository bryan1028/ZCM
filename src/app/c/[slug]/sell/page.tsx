import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, PRICE_UNITS } from "@/lib/catalog";

async function save(formData: FormData) {
  "use server";
  const slug = String(formData.get("slug"));
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: community } = await supabase.from("communities").select("id").eq("slug", slug).single();
  if (!community) redirect("/");

  // First time selling here → create the seller profile (individual or business).
  let { data: seller } = await supabase.from("sellers").select("id").eq("community_id", community.id).eq("user_id", user.id).maybeSingle();
  if (!seller) {
    const accountType = formData.get("account_type") === "business" ? "business" : "individual";
    const businessName = String(formData.get("business_name") ?? "").trim() || null;
    if (accountType === "business" && !businessName) redirect(`/c/${slug}/sell?error=${encodeURIComponent("Please enter your business name")}`);
    const { data, error } = await supabase.from("sellers").insert({
      community_id: community.id, user_id: user.id, account_type: accountType,
      display_name: String(formData.get("display_name")).trim(),
      business_name: accountType === "business" ? businessName : null,
      whatsapp: String(formData.get("whatsapp") ?? "").trim() || null,
    }).select("id").single();
    if (error) redirect(`/c/${slug}/sell?error=${encodeURIComponent(error.message)}`);
    seller = data;
  }

  const price = String(formData.get("price") ?? "").trim();
  const kind = formData.get("kind") === "service" ? "service" : "product";
  const category = String(formData.get(`category_${kind}`) ?? "");     // each kind has its own category list
  if (!CATEGORIES[kind].includes(category)) redirect(`/c/${slug}/sell?error=${encodeURIComponent("Please choose a category")}`);
  const { data: created, error } = await supabase.from("listings").insert({
    seller_id: seller!.id,
    kind,
    category,
    title: String(formData.get("title")).trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    price_cents: price ? Math.round(Number(price) * 100) : null,
    price_unit: String(formData.get("price_unit")),
    stock: formData.get("stock") ? Number(formData.get("stock")) : null,
  }).select("id").single();
  if (error) redirect(`/c/${slug}/sell?error=${encodeURIComponent(error.message)}`);
  redirect(`/c/${slug}/l/${created!.id}/edit?new=1`); // straight on to adding photos
}

export default async function Sell({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ error?: string }> }) {
  const { slug } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: seller } = await supabase.from("sellers").select("id, communities!inner(slug)").eq("communities.slug", slug).eq("user_id", user!.id).maybeSingle();

  const UNIT_LABEL: Record<string, string> = { fixed: "Fixed price", per_hour: "Per hour", per_job: "Per job", negotiable: "Negotiable" };
  return (
    <div className="page-narrow">
      <div className="page-head"><div><h1>Sell or offer something</h1><p className="muted">It takes a minute. You can add photos right after.</p></div></div>
      {error && <div className="alert error" role="alert" style={{ marginBottom: 12 }}>{error}</div>}
      <form action={save} className="stack sell-form">
        <input type="hidden" name="slug" value={slug} />

        {!seller && (
          <section className="card stack">
            <h3 style={{ margin: 0 }}>About you</h3>
            <p className="muted small" style={{ margin: 0 }}>You only set this up once.</p>
            <div className="choices">
              <label className="choice"><input type="radio" name="account_type" value="individual" defaultChecked /><span className="box"><b>👤 Individual</b><small>Selling as yourself</small></span></label>
              <label className="choice"><input type="radio" name="account_type" value="business" /><span className="box"><b>🏪 Business</b><small>A shop, crew or company</small></span></label>
            </div>
            <label>Your name <span className="hint">(shown to neighbours)</span><input name="display_name" required placeholder="e.g. Wanjiku M." /></label>
            <label className="biz-only">Business name<input name="business_name" placeholder="e.g. Otieno Gardens & Landscaping" /></label>
            <label>WhatsApp number <span className="hint">(optional)</span><input name="whatsapp" inputMode="tel" placeholder="2547…" /></label>
          </section>
        )}

        <section className="card stack">
          <h3 style={{ margin: 0 }}>What are you offering?</h3>
          <div className="choices">
            <label className="choice"><input type="radio" name="kind" value="service" defaultChecked /><span className="box"><b>🛠️ A service</b><small>Work you do for people</small></span></label>
            <label className="choice"><input type="radio" name="kind" value="product" /><span className="box"><b>🛍️ A product</b><small>Something you make or sell</small></span></label>
          </div>
          <label className="for-service">Category
            <select name="category_service">{CATEGORIES.service.map((c) => <option key={c}>{c}</option>)}</select>
          </label>
          <label className="for-product">Category
            <select name="category_product">{CATEGORIES.product.map((c) => <option key={c}>{c}</option>)}</select>
          </label>
          <label>Title<input name="title" required minLength={3} maxLength={120} placeholder="e.g. Weekly lawn care & hedge trimming" /></label>
          <label>Description <span className="hint">(optional)</span><textarea name="description" rows={4} placeholder="What's included, how it works, when you're available…" /></label>
        </section>

        <section className="card stack">
          <h3 style={{ margin: 0 }}>Price</h3>
          <div className="choices four">
            {Object.keys(PRICE_UNITS).map((u, i) => (
              <label className="choice" key={u}><input type="radio" name="price_unit" value={u} defaultChecked={i === 0} /><span className="box"><b>{UNIT_LABEL[u]}</b></span></label>
            ))}
          </div>
          <label className="price-field">Amount (KES)<input name="price" type="number" inputMode="numeric" min="0" step="1" placeholder="e.g. 1500" /></label>
          <label className="for-product">Stock <span className="hint">(optional)</span><input name="stock" type="number" inputMode="numeric" min="0" step="1" placeholder="How many do you have?" /></label>
        </section>

        <button style={{ minHeight: 50 }}>Publish listing</button>
      </form>
    </div>
  );
}
