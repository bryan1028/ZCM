import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
  const names = await usernamesFor(supabase, community.id, (convs ?? []).flatMap((c) => [c.initiator_id, c.recipient_id]));

  return (
    <>
      <h2>Inbox</h2>
      {(convs ?? []).length === 0 && <div className="card">No chats yet. Open a listing and tap “Message”.</div>}
      {(convs ?? []).map((c) => {
        const other = c.initiator_id === user.id ? c.recipient_id : c.initiator_id;
        const n = unreadBy.get(c.id);
        return (
          <Link key={c.id} href={`/c/${slug}/inbox/${c.id}`} style={{ textDecoration: "none", color: "inherit" }}>
            <div className="card row">
              <div>
                <strong>@{names.get(other) ?? "neighbour"}</strong>
                <div className="muted">{(c.listings as unknown as { title: string } | null)?.title ?? "Listing removed"}</div>
              </div>
              {n ? <span className="badge">{n} new</span> : null}
            </div>
          </Link>
        );
      })}
    </>
  );
}
