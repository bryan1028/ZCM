import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Empty from "@/components/empty";
import { getCommunity } from "@/lib/community";
import { fmtDay } from "@/lib/time";
import EnablePush from "@/components/enable-push";
import { getUser } from "@/lib/auth";
import { done } from "@/lib/after-action";
import Submit from "@/components/submit-button";

async function markAllRead(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await getUser(supabase);
  if (user) await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  await done(String(formData.get("back")));
}

async function saveSubscription(sub: { endpoint: string; p256dh: string; auth: string }) {
  "use server";
  const supabase = await createClient();
  await supabase.rpc("save_push_subscription", { ep: sub.endpoint, p256: sub.p256dh, au: sub.auth });
}

export default async function Notifications({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const community = await getCommunity(slug);
  const { data: items } = await supabase.from("notifications").select("id, type, title, body, url, read_at, created_at")
    .eq("community_id", community!.id).order("created_at", { ascending: false }).limit(50);

  const ICON: Record<string, string> = { message: "💬", reservation: "🧾", membership: "🏡" };
  const ago = (iso: string) => {
    const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (mins < 60) return `${mins}m`;
    if (mins < 1440) return `${Math.round(mins / 60)}h`;
    return fmtDay(iso, community!.timezone);
  };
  const unread = (items ?? []).filter((n) => !n.read_at).length;

  return (
    <div className="page-narrow" style={{ maxWidth: 640 }}>
      <div className="page-head">
        <div><h1>Notifications</h1><p className="muted">{unread > 0 ? `${unread} unread` : "You're all caught up"}</p></div>
        {unread > 0 && <form action={markAllRead}><input type="hidden" name="back" value={`/c/${slug}/notifications`} /><Submit className="secondary sm">Mark all read</Submit></form>}
      </div>
      <div className="card flat" style={{ marginBottom: 14 }}><EnablePush save={saveSubscription} /></div>
      {(items ?? []).length === 0 && <Empty emoji="🔔" title="Nothing yet">New messages, orders and approvals will show up here.</Empty>}
      <div className="list">
        {(items ?? []).map((n) => (
          <Link key={n.id} href={n.url} className={`item ${n.read_at ? "" : "unread"}`}>
            <span className="avatar" aria-hidden style={{ fontSize: 16 }}>{ICON[n.type] ?? "🔔"}</span>
            <div className="grow">
              <div className="title" style={{ fontWeight: n.read_at ? 550 : 700 }}>{n.title}</div>
              {n.body && <div className="muted small clamp-2">{n.body}</div>}
            </div>
            <span className="muted small nowrap">{ago(n.created_at)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
