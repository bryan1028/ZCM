import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EnablePush from "@/components/enable-push";

async function markAllRead(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  redirect(String(formData.get("back")));
}

async function saveSubscription(sub: { endpoint: string; p256dh: string; auth: string }) {
  "use server";
  const supabase = await createClient();
  await supabase.rpc("save_push_subscription", { ep: sub.endpoint, p256: sub.p256dh, au: sub.auth });
}

export default async function Notifications({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: community } = await supabase.from("communities").select("id").eq("slug", slug).single();
  const { data: items } = await supabase.from("notifications").select("id, title, body, url, read_at, created_at")
    .eq("community_id", community!.id).order("created_at", { ascending: false }).limit(50);

  return (
    <>
      <div className="row">
        <h2>Notifications</h2>
        <form action={markAllRead}><input type="hidden" name="back" value={`/c/${slug}/notifications`} /><button className="secondary">Mark all read</button></form>
      </div>
      <div className="card"><EnablePush save={saveSubscription} /></div>
      {(items ?? []).length === 0 && <p className="muted">Nothing yet.</p>}
      {(items ?? []).map((n) => (
        <Link key={n.id} href={n.url} style={{ textDecoration: "none", color: "inherit" }}>
          <div className="card" style={{ borderLeft: n.read_at ? undefined : "4px solid var(--accent)" }}>
            <div className="row">
              <strong style={{ fontWeight: n.read_at ? 500 : 700 }}>{n.title}</strong>
              <span className="muted">{new Date(n.created_at).toLocaleDateString()}</span>
            </div>
            {n.body && <div className="muted">{n.body}</div>}
          </div>
        </Link>
      ))}
    </>
  );
}
