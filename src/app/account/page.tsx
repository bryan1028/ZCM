import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Page from "@/components/page";
import { getUser } from "@/lib/auth";
import Submit from "@/components/submit-button";

export const metadata = { title: "Your account" };

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// Fix a typo in your name, WhatsApp number or business name without starting over. (The username stays: it is how neighbours know you.)
async function saveProfile(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await getUser(supabase);
  if (!user) redirect("/login");
  const fail = (m: string): never => redirect(`/account?error=${encodeURIComponent(m)}`);
  const fullName = String(formData.get("full_name") ?? "").trim();
  if (fullName.length < 2) fail("Please enter your name");
  const { error: pe } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id);
  if (pe) fail(pe.message);
  const { data: sellers } = await supabase.from("sellers").select("id, account_type").eq("user_id", user.id);
  for (const sl of sellers ?? []) {
    const display = String(formData.get(`display_${sl.id}`) ?? "").trim();
    const business = String(formData.get(`business_${sl.id}`) ?? "").trim();
    const wa = String(formData.get(`whatsapp_${sl.id}`) ?? "").replace(/[^\d+]/g, "");
    if (!display) fail("Your seller name can't be empty");
    if (sl.account_type === "business" && !business) fail("Your business name can't be empty");
    if (wa && wa.replace(/\D/g, "").length < 9) fail("That WhatsApp number looks too short. Include the country code, like 2547…");
    const { error } = await supabase.from("sellers").update({ display_name: display, business_name: sl.account_type === "business" ? business : null, whatsapp: wa || null }).eq("id", sl.id);
    if (error) fail(error.message);
  }
  redirect("/account?saved=1");
}

// Permanently deletes the signed-in person's account and everything they own.
async function deleteAccount(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await getUser(supabase);
  if (!user) redirect("/login");
  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== "DELETE") {
    redirect(`/account?error=${encodeURIComponent("Type DELETE to confirm")}`);
  }

  // 1. Remove their uploaded files first (Storage rules only let people delete files in their own folders).
  const { data: sellers } = await supabase.from("sellers").select("id").eq("user_id", user.id);
  const sellerIds = (sellers ?? []).map((s) => s.id);
  if (sellerIds.length) {
    const { data: listings } = await supabase.from("listings").select("image_urls, video_urls").in("seller_id", sellerIds);
    const images = (listings ?? []).flatMap((l) => l.image_urls as string[]);
    const videos = (listings ?? []).flatMap((l) => l.video_urls as string[]);
    if (images.length) await supabase.storage.from("zcm-listing-images").remove(images);
    if (videos.length) await supabase.storage.from("zcm-listing-videos").remove(videos);
  }
  const { data: proofs } = await supabase.from("payments").select("proof_path, reservations!inner(buyer_id)").eq("reservations.buyer_id", user.id);
  const proofPaths = (proofs ?? []).map((p) => p.proof_path as string);
  if (proofPaths.length) await supabase.storage.from("zcm-payment-proofs").remove(proofPaths);

  // 2. Delete the account (the database refuses if they are the only admin of a community).
  const { error } = await supabase.rpc("delete_my_account");
  if (error) redirect(`/account?error=${encodeURIComponent(error.message)}`);
  await supabase.auth.signOut().catch(() => {});
  redirect("/login?goodbye=1");
}

export default async function Account({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { error, saved } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await getUser(supabase);
  const { data: me } = await supabase.from("profiles").select("username, full_name").eq("id", user!.id).maybeSingle();
  const { data: sellerRows } = await supabase.from("sellers").select("id, account_type, display_name, business_name, whatsapp, communities(name)").eq("user_id", user!.id);
  const { data: memberships } = await supabase.from("memberships").select("status, role, communities(slug, name)").eq("user_id", user!.id);

  return (
    <Page>
      <h1>Your account</h1>
      <p className="muted" style={{ margin: "6px 0 16px" }}>@{me?.username} · {user!.email}</p>
      {error && <div className="alert error" role="alert" style={{ marginBottom: 12 }}>{error}</div>}
      {saved && <div className="alert ok" role="status" style={{ marginBottom: 12 }}>Saved.</div>}

      <div className="list" style={{ marginBottom: 16 }}>
        {(memberships ?? []).map((m) => {
          const c = m.communities as unknown as { slug: string; name: string };
          return (
            <Link key={c.slug} className="item" href={`/c/${c.slug}`}>
              <span className="avatar" aria-hidden>{c.name.slice(0, 1)}</span>
              <div className="grow"><div className="title">{c.name}</div><div className="muted small">{m.role === "admin" ? "Admin" : "Resident"} · {m.status}</div></div>
            </Link>
          );
        })}
      </div>

      <form action={saveProfile} className="card stack" style={{ marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>Your details</h3>
        <label>Your name <span className="hint">(only community admins see this)</span>
          <input name="full_name" defaultValue={me?.full_name ?? ""} autoComplete="name" required />
        </label>
        {(sellerRows ?? []).map((sl) => (
          <div className="stack" key={sl.id} style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
            <b>Selling in {(sl.communities as unknown as { name: string } | null)?.name}</b>
            <label>Name shown to neighbours<input name={`display_${sl.id}`} defaultValue={sl.display_name} required /></label>
            {sl.account_type === "business" && <label>Business name<input name={`business_${sl.id}`} defaultValue={sl.business_name ?? ""} required /></label>}
            <label>WhatsApp number <span className="hint">(optional, shown on your listings)</span>
              <input name={`whatsapp_${sl.id}`} defaultValue={sl.whatsapp ?? ""} inputMode="tel" placeholder="2547…" />
            </label>
          </div>
        ))}
        <p className="muted small" style={{ margin: 0 }}>Your username (@{me?.username}) can&apos;t be changed, because it&apos;s how neighbours recognise you.</p>
        <Submit>Save my details</Submit>
      </form>

      <section className="card stack">
        <h3 style={{ margin: 0 }}>Your data</h3>
        <p className="muted small" style={{ margin: 0 }}>Download a copy of what we hold about you: profile, listings, reviews, orders and your own messages.</p>
        <a className="btn secondary" href="/account/export" download>Download my data</a>
        <p className="muted small" style={{ margin: 0 }}>See the <Link href="/privacy">Privacy Policy</Link> and <Link href="/terms">Terms of Use</Link>.</p>
      </section>

      <form action={signOut} style={{ marginTop: 12 }}><Submit className="secondary block">Sign out</Submit></form>

      <section className="card stack" style={{ marginTop: 22, borderColor: "color-mix(in srgb, var(--danger) 35%, var(--line))" }}>
        <h3 style={{ margin: 0, color: "var(--danger)" }}>Delete my account</h3>
        <p className="muted small" style={{ margin: 0 }}>
          This permanently removes your profile, listings, photos, reviews, orders and messages. It can&apos;t be undone.
          If you&apos;re the only admin of a community, make someone else an admin first.
        </p>
        <form action={deleteAccount} className="stack">
          <label>Type <b>DELETE</b> to confirm<input name="confirm" autoComplete="off" required placeholder="DELETE" /></label>
          <Submit className="danger">Permanently delete my account</Submit>
        </form>
      </section>
    </Page>
  );
}
