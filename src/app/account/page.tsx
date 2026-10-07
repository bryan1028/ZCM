import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Page from "@/components/page";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// Permanently deletes the signed-in person's account and everything they own.
async function deleteAccount(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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

export default async function Account({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("username").eq("id", user!.id).maybeSingle();
  const { data: memberships } = await supabase.from("memberships").select("status, role, communities(slug, name)").eq("user_id", user!.id);

  return (
    <Page>
      <h1>Your account</h1>
      <p className="muted" style={{ margin: "6px 0 16px" }}>@{me?.username} · {user!.email}</p>
      {error && <div className="alert error" role="alert" style={{ marginBottom: 12 }}>{error}</div>}

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

      <section className="card stack">
        <h3 style={{ margin: 0 }}>Your data</h3>
        <p className="muted small" style={{ margin: 0 }}>Download a copy of what we hold about you: profile, listings, reviews, orders and your own messages.</p>
        <a className="btn secondary" href="/account/export" download>Download my data</a>
        <p className="muted small" style={{ margin: 0 }}>See the <Link href="/privacy">Privacy Policy</Link> and <Link href="/terms">Terms of Use</Link>.</p>
      </section>

      <form action={signOut} style={{ marginTop: 12 }}><button className="secondary block">Sign out</button></form>

      <section className="card stack" style={{ marginTop: 22, borderColor: "color-mix(in srgb, var(--danger) 35%, var(--line))" }}>
        <h3 style={{ margin: 0, color: "var(--danger)" }}>Delete my account</h3>
        <p className="muted small" style={{ margin: 0 }}>
          This permanently removes your profile, listings, photos, reviews, orders and messages. It can&apos;t be undone.
          If you&apos;re the only admin of a community, make someone else an admin first.
        </p>
        <form action={deleteAccount} className="stack">
          <label>Type <b>DELETE</b> to confirm<input name="confirm" autoComplete="off" required placeholder="DELETE" /></label>
          <button className="danger">Permanently delete my account</button>
        </form>
      </section>
    </Page>
  );
}
