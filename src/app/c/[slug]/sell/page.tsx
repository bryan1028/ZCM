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
  const { error } = await supabase.from("listings").insert({
    seller_id: seller!.id,
    kind: String(formData.get("kind")),
    category: String(formData.get("category")),
    title: String(formData.get("title")).trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    price_cents: price ? Math.round(Number(price) * 100) : null,
    price_unit: String(formData.get("price_unit")),
  });
  if (error) redirect(`/c/${slug}/sell?error=${encodeURIComponent(error.message)}`);
  redirect(`/c/${slug}/${formData.get("kind") === "service" ? "services" : "products"}`);
}

export default async function Sell({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ error?: string }> }) {
  const { slug } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: seller } = await supabase.from("sellers").select("id, communities!inner(slug)").eq("communities.slug", slug).maybeSingle();

  return (
    <>
      <h2>List something</h2>
      <form action={save} className="card">
        <input type="hidden" name="slug" value={slug} />
        {!seller && (
          <>
            <p className="muted">First time? Set up your seller profile.</p>
            <label>Account type
              <select name="account_type"><option value="individual">Individual</option><option value="business">Business</option></select>
            </label>
            <label>Your name (shown to neighbours)<input name="display_name" required /></label>
            <label>Business name (business accounts only)<input name="business_name" /></label>
            <label>WhatsApp number (optional)<input name="whatsapp" placeholder="2547…" /></label>
          </>
        )}
        <label>I&apos;m offering a
          <select name="kind"><option value="service">Service</option><option value="product">Product</option></select>
        </label>
        <label>Category
          <select name="category">
            {[...new Set([...CATEGORIES.service, ...CATEGORIES.product])].map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label>Title<input name="title" required minLength={3} maxLength={120} /></label>
        <label>Description<textarea name="description" rows={3} /></label>
        <label>Price (KES)<input name="price" type="number" min="0" step="1" /></label>
        <label>Price type
          <select name="price_unit">{Object.keys(PRICE_UNITS).map((u) => <option key={u} value={u}>{u.replace("_", " ")}</option>)}</select>
        </label>
        <button>Publish</button>
        {error && <p className="muted">{error}</p>}
      </form>
    </>
  );
}
