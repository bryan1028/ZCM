import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Empty from "@/components/empty";
import { usernamesFor } from "@/lib/usernames";

export default async function Inbox({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: community } = await supabase.from("communities").select("id").eq("slug", slug).single();
  if (!community || !user) notFound();

  const { data: convs } = await supabase
    .from("conversations").select("id, initiator_id, recipient_id, last_message_at, listings(title)")
    .eq("community_id", community.id).order("last_message_at", { ascending: false });
  const ids = (convs ?? []).map((c) => c.id);
  const { data: unread } = ids.length
    ? await supabase.from("messages").select("conversation_id").in("conversation_id", ids).is("read_at", null).neq("sender_id", user.id)
    : { data: [] };
  const unreadBy = new Map<string, number>();
  (unread ?? []).forEach((m) => unreadBy.set(m.conversation_id, (unreadBy.get(m.conversation_id) ?? 0) + 1));
  // newest message per conversation, for the preview line
  const { data: recent } = ids.length
    ? await supabase.from("messages").select("conversation_id, sender_id, body, created_at").in("conversation_id", ids).order("created_at", { ascending: false }).limit(200)
    : { data: [] };
  const lastBy = new Map<string, { sender_id: string; body: string; created_at: string }>();
  (recent ?? []).forEach((m) => { if (!lastBy.has(m.conversation_id)) lastBy.set(m.conversation_id, m); });
  const names = await usernamesFor(supabase, community.id, (convs ?? []).flatMap((c) => [c.initiator_id, c.recipient_id]));

  const when = (iso: string) => {
    const d = new Date(iso), now = new Date();
    return d.toDateString() === now.toDateString() ? d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  };
  return (
    <>
      <div className="page-head"><div><h1>Inbox</h1><p className="muted">Chats with your neighbours</p></div></div>
      {(convs ?? []).length === 0 && <Empty emoji="💬" title="No chats yet" href={`/c/${slug}/services`} cta="Browse listings">Open a listing and tap “Message” to start a conversation.</Empty>}
      <div className="list">
        {(convs ?? []).map((c) => {
          const other = c.initiator_id === user.id ? c.recipient_id : c.initiator_id;
          const handle = names.get(other) ?? "neighbour";
          const n = unreadBy.get(c.id);
          const last = lastBy.get(c.id);
          return (
            <Link key={c.id} href={`/c/${slug}/inbox/${c.id}`} className={`item ${n ? "unread" : ""}`}>
              <span className="avatar avatar-lg" aria-hidden>{handle.slice(0, 1)}</span>
              <div className="grow">
                <div className="row"><span className="title">@{handle}</span>{last && <span className="muted small">{when(last.created_at)}</span>}</div>
                <div className="muted small clamp-2" style={{ fontWeight: n ? 650 : 400, color: n ? "var(--ink)" : undefined }}>
                  {last ? `${last.sender_id === user.id ? "You: " : ""}${last.body}` : "No messages yet"}
                </div>
                <div className="muted small">re: {(c.listings as unknown as { title: string } | null)?.title ?? "listing removed"}</div>
              </div>
              {n ? <span className="badge danger">{n}</span> : null}
            </Link>
          );
        })}
      </div>
    </>
  );
}
