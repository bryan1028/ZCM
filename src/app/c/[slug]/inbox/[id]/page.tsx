import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { pushSoon } from "@/lib/push";
import { createClient } from "@/lib/supabase/server";
import { usernamesFor } from "@/lib/usernames";
import Live from "./live";
import { getCommunity } from "@/lib/community";
import { fmtTime, fmtWeekday } from "@/lib/time";
import ScrollEnd from "./scroll-end";
import { ChevronLeftIcon, SendIcon } from "@/components/icons";

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

  const handle = names.get(other) ?? "neighbour";
  const tz = (await getCommunity(slug))?.timezone ?? "Africa/Nairobi";
  const dayLabel = (iso: string) => fmtWeekday(iso, tz);
  const timeLabel = (iso: string) => fmtTime(iso, tz);

  return (
    <div className="page-narrow" style={{ maxWidth: 640 }}>
      <Live conversationId={id} />
      <p style={{ margin: "0 0 10px" }}><Link href={`/c/${slug}/inbox`} className="row gap-sm" style={{ justifyContent: "flex-start", display: "inline-flex" }}><ChevronLeftIcon size={18} />Inbox</Link></p>
      <div className="card flat row" style={{ justifyContent: "flex-start" }}>
        <span className="avatar avatar-lg" aria-hidden>{handle.slice(0, 1)}</span>
        <div className="grow">
          <div style={{ fontWeight: 700 }}>@{handle}</div>
          {conv.listing_id && title && <Link href={`/c/${slug}/l/${conv.listing_id}`} className="muted small clamp-2">re: {title}</Link>}
        </div>
      </div>

      <div className="thread">
        {(messages ?? []).length === 0 && <p className="muted center" style={{ padding: "24px 0" }}>Say hello 👋</p>}
        {(messages ?? []).map((m, i) => {
          const mine = m.sender_id === user.id;
          const prev = (messages ?? [])[i - 1];
          const newDay = !prev || dayLabel(prev.created_at) !== dayLabel(m.created_at);
          return (
            <div key={m.id} style={{ display: "grid" }}>
              {newDay && <div className="muted small center" style={{ margin: "10px 0 4px" }}>{dayLabel(m.created_at)}</div>}
              <div className={`bubble ${mine ? "mine" : "theirs"}`}>{m.body}</div>
              <div className="muted small" style={{ justifySelf: mine ? "end" : "start", fontSize: 11, margin: "1px 6px 4px" }}>{timeLabel(m.created_at)}</div>
            </div>
          );
        })}
        <ScrollEnd key={(messages ?? []).length} />
      </div>

      <div className="composer">
        {error && <div className="alert error" role="alert" style={{ marginBottom: 8 }}>{error}</div>}
        <form action={send}>
          <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={id} />
          <input name="body" required maxLength={2000} placeholder="Write a message…" autoComplete="off" aria-label="Message" />
          <button aria-label="Send"><SendIcon size={18} /></button>
        </form>
      </div>

      <details style={{ marginTop: 14 }}>
        <summary className="muted small" style={{ cursor: "pointer" }}>Report @{handle}</summary>
        <form action={reportUser} className="stack" style={{ marginTop: 8 }}>
          <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={id} />
          <input type="hidden" name="target_id" value={other} />
          <label>What happened?<textarea name="reason" rows={2} required minLength={3} /></label>
          <button className="secondary sm" style={{ justifySelf: "start" }}>Send report</button>
        </form>
      </details>
      {reported && <div className="alert ok" style={{ marginTop: 12 }}>Thanks, an admin will take a look.</div>}
    </div>
  );
}
