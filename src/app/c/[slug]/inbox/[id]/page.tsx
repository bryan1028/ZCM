import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { pushSoon } from "@/lib/push";
import { createClient } from "@/lib/supabase/server";
import { usernamesFor } from "@/lib/usernames";
import Live from "./live";

async function send(formData: FormData) {
  "use server";
  const slug = String(formData.get("slug")), id = String(formData.get("id"));
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const body = String(formData.get("body") ?? "").trim();
  if (!body) redirect(`/c/${slug}/inbox/${id}`);
  const { error } = await supabase.from("messages").insert({ conversation_id: id, sender_id: user.id, body });
  pushSoon();
  redirect(`/c/${slug}/inbox/${id}${error ? `?error=${encodeURIComponent(error.message)}` : ""}`);
}

async function reportUser(formData: FormData) {
  "use server";
  const slug = String(formData.get("slug")), id = String(formData.get("id"));
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: c } = await supabase.from("conversations").select("community_id").eq("id", id).single();
  if (c) await supabase.from("reports").insert({
    community_id: c.community_id, reporter_id: user.id, target_type: "user",
    target_id: String(formData.get("target_id")), reason: String(formData.get("reason")).trim(),
  });
  redirect(`/c/${slug}/inbox/${id}?reported=1`);
}

export default async function Chat({ params, searchParams }: {
  params: Promise<{ slug: string; id: string }>; searchParams: Promise<{ error?: string; reported?: string }>;
}) {
  const { slug, id } = await params;
  const { error, reported } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: conv } = await supabase.from("conversations")
    .select("id, community_id, initiator_id, recipient_id, listing_id, listings(title)").eq("id", id).maybeSingle();
  if (!conv) notFound();
  await supabase.rpc("mark_read", { cid: id });

  const { data: messages } = await supabase.from("messages")
    .select("id, sender_id, body, created_at").eq("conversation_id", id).order("created_at");
  const other = conv.initiator_id === user.id ? conv.recipient_id : conv.initiator_id;
  const names = await usernamesFor(supabase, conv.community_id, [other]);
  const title = (conv.listings as unknown as { title: string } | null)?.title;

  return (
    <>
      <Live conversationId={id} />
      <p><Link href={`/c/${slug}/inbox`}>← Inbox</Link></p>
      <div className="row">
        <h2 style={{ margin: 0 }}>@{names.get(other) ?? "neighbour"}</h2>
        {conv.listing_id && title && <Link href={`/c/${slug}/l/${conv.listing_id}`}>{title}</Link>}
      </div>
      <div style={{ display: "grid", gap: 6, margin: "12px 0" }}>
        {(messages ?? []).length === 0 && <p className="muted">Say hello 👋</p>}
        {(messages ?? []).map((m) => {
          const mine = m.sender_id === user.id;
          return (
            <div key={m.id} style={{
              justifySelf: mine ? "end" : "start", maxWidth: "80%", padding: "8px 12px", borderRadius: 14,
              background: mine ? "var(--accent)" : "var(--card)", color: mine ? "#fff" : "inherit", border: "1px solid var(--line)",
              whiteSpace: "pre-wrap", overflowWrap: "anywhere",
            }}>{m.body}</div>
          );
        })}
      </div>
      <form action={send} style={{ gridTemplateColumns: "1fr auto" }}>
        <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={id} />
        <input name="body" required maxLength={2000} placeholder="Type a message" autoComplete="off" />
        <button>Send</button>
      </form>
      {error && <p className="muted">{error}</p>}
      <details style={{ marginTop: 16 }}>
        <summary className="muted">Report @{names.get(other) ?? "this user"}</summary>
        <form action={reportUser}>
          <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={id} />
          <input type="hidden" name="target_id" value={other} />
          <label>What happened?<textarea name="reason" rows={2} required minLength={3} /></label>
          <button className="secondary">Send report</button>
        </form>
      </details>
      {reported && <p className="muted">Thanks — an admin will take a look.</p>}
    </>
  );
}
