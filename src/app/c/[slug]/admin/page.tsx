import { notFound, redirect } from "next/navigation";
import { pushSoon } from "@/lib/push";
import { headers } from "next/headers";
import CopyButton from "@/components/copy-button";
import Empty from "@/components/empty";
import { siteUrl } from "@/lib/nav";
import { createClient } from "@/lib/supabase/server";

async function review(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const status = String(formData.get("status"));
  if (!user || !["verified", "rejected", "suspended"].includes(status)) return;
  pushSoon();
  // RLS guarantees only an admin of that community can make this update succeed.
  await supabase.from("memberships")
    .update({ status, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq("id", String(formData.get("id")));
  redirect(String(formData.get("back")));
}

async function postAnnouncement(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("announcements").insert({
    community_id: String(formData.get("community_id")), author_id: user.id,
    title: String(formData.get("title")).trim(), body: String(formData.get("body") ?? "").trim() || null,
    pinned: formData.get("pinned") === "on",
  });
  redirect(String(formData.get("back")));
}

async function deleteAnnouncement(formData: FormData) {
  "use server";
  const supabase = await createClient();
  await supabase.from("announcements").delete().eq("id", String(formData.get("id")));
  redirect(String(formData.get("back")));
}

async function rotateInvite(formData: FormData) {
  "use server";
  const supabase = await createClient();
  await supabase.rpc("rotate_invite_code", { cid: String(formData.get("community_id")) });
  redirect(String(formData.get("back")));
}

async function shadowban(formData: FormData) {
  "use server";
  const supabase = await createClient();
  await supabase.from("memberships").update({ shadowbanned: formData.get("on") === "true" }).eq("id", String(formData.get("id")));
  redirect(String(formData.get("back")));
}

async function resolveReport(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const action = String(formData.get("action"));
  const type = String(formData.get("target_type"));
  const target = String(formData.get("target_id"));
  // "remove" takes the content down, then marks the report resolved. RLS limits all of this to community admins.
  if (action === "remove") {
    if (type === "listing") await supabase.from("listings").update({ status: "removed" }).eq("id", target);
    if (type === "review") await supabase.from("reviews").delete().eq("id", target);
  }
  await supabase.from("reports").update({
    status: action === "dismiss" ? "dismissed" : "resolved", resolved_by: user.id, resolved_at: new Date().toISOString(),
  }).eq("id", String(formData.get("id")));
  redirect(String(formData.get("back")));
}

export default async function Admin({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: community } = await supabase.from("communities").select("id").eq("slug", slug).single();
  if (!community) notFound();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("memberships").select("role").eq("community_id", community.id).eq("user_id", user!.id).maybeSingle();
  if (me?.role !== "admin") notFound();

  const { data: members } = await supabase
    .from("memberships")
    .select("id, status, role, shadowbanned, invited_by_username, unit, proof_note, created_at, profiles:user_id(full_name, username)")
    .eq("community_id", community.id).order("created_at", { ascending: false });
  const { data: reports } = await supabase
    .from("reports").select("id, target_type, target_id, reason, created_at")
    .eq("community_id", community.id).eq("status", "open").order("created_at");
  const { data: code } = await supabase.rpc("get_invite_code", { cid: community.id });
  const { data: announcements } = await supabase.from("announcements").select("id, title, pinned, created_at")
    .eq("community_id", community.id).order("created_at", { ascending: false }).limit(10);
  const inviteLink = code ? `${siteUrl((await headers()).get("host"))}/invite/${code}` : null;
  const pending = (members ?? []).filter((m) => m.status === "pending");
  const rest = (members ?? []).filter((m) => m.status !== "pending");

  const prof = (m: NonNullable<typeof members>[number]) => m.profiles as unknown as { full_name: string | null; username: string | null } | null;
  const back = `/c/${slug}/admin`;
  const verifiedCount = (members ?? []).filter((m) => m.status === "verified").length;
  const TONE: Record<string, string> = { verified: "brand", pending: "accent", rejected: "danger", suspended: "danger" };

  const applicant = (m: NonNullable<typeof members>[number]) => {
    const p = prof(m);
    return (
      <div className="card stack" key={m.id}>
        <div className="row row-start" style={{ justifyContent: "flex-start" }}>
          <span className="avatar avatar-lg" aria-hidden>{(p?.username ?? p?.full_name ?? "?").slice(0, 1)}</span>
          <div className="grow">
            <div style={{ fontWeight: 700 }}>{p?.full_name ?? "Unnamed"} <span className="muted" style={{ fontWeight: 400 }}>@{p?.username ?? "?"}</span></div>
            <div className="muted small">Unit <b style={{ color: "var(--ink)" }}>{m.unit}</b> · applied {new Date(m.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</div>
          </div>
        </div>
        {m.proof_note && <div className="alert info">“{m.proof_note}”</div>}
        {m.invited_by_username && <div className="alert ok">✓ Invited by verified resident @{m.invited_by_username}</div>}
        <form action={review} className="inline-form">
          <input type="hidden" name="id" value={m.id} /><input type="hidden" name="back" value={back} />
          <button name="status" value="verified">✓ Verify resident</button>
          <button className="secondary" name="status" value="rejected">Reject</button>
        </form>
      </div>
    );
  };

  const member = (m: NonNullable<typeof members>[number]) => {
    const p = prof(m);
    return (
      <details className="item member" key={m.id} style={{ display: "block", padding: 0 }}>
        <summary className="row" style={{ padding: "12px 14px", cursor: "pointer", listStyle: "none" }}>
          <span className="row gap-sm" style={{ justifyContent: "flex-start", minWidth: 0 }}>
            <span className="avatar" aria-hidden>{(p?.username ?? "?").slice(0, 1)}</span>
            <span style={{ minWidth: 0 }}>
              <b>@{p?.username ?? "?"}</b> <span className="muted small">· {m.unit}</span>
              <div className="muted small">{p?.full_name ?? "Unnamed"}</div>
            </span>
          </span>
          <span className="row gap-sm">
            {m.role === "admin" && <span className="badge info">admin</span>}
            <span className={`badge ${m.shadowbanned ? "danger" : TONE[m.status] ?? ""}`}>{m.shadowbanned ? "shadowbanned" : m.status}</span>
          </span>
        </summary>
        <div className="inline-form" style={{ padding: "0 14px 14px" }}>
          {m.proof_note && <p className="muted small" style={{ width: "100%", margin: 0 }}>“{m.proof_note}”</p>}
          <form action={review} className="inline-form">
            <input type="hidden" name="id" value={m.id} /><input type="hidden" name="back" value={back} />
            {m.status !== "verified" && <button className="sm" name="status" value="verified">Verify</button>}
            {m.status === "verified" && m.role !== "admin" && <button className="danger sm" name="status" value="suspended">Ban</button>}
          </form>
          {m.status === "verified" && m.role !== "admin" && (
            <form action={shadowban} className="inline-form">
              <input type="hidden" name="id" value={m.id} /><input type="hidden" name="back" value={back} />
              <button className="secondary sm" name="on" value={String(!m.shadowbanned)}>{m.shadowbanned ? "Lift shadowban" : "Shadowban"}</button>
            </form>
          )}
        </div>
      </details>
    );
  };

  return (
    <>
      <div className="page-head"><div><h1>Admin</h1><p className="muted">Keep your community safe and growing</p></div></div>

      <div className="stats" style={{ marginBottom: 8 }}>
        <div className="stat"><b style={{ color: pending.length ? "var(--accent)" : undefined }}>{pending.length}</b><span>Awaiting verification</span></div>
        <div className="stat"><b>{verifiedCount}</b><span>Verified residents</span></div>
        <div className="stat"><b style={{ color: (reports ?? []).length ? "var(--danger)" : undefined }}>{(reports ?? []).length}</b><span>Open reports</span></div>
        <div className="stat"><b>{(announcements ?? []).length}</b><span>Announcements</span></div>
      </div>

      <h2>Residents awaiting verification</h2>
      {pending.length === 0
        ? <Empty emoji="🎉" title="No one is waiting">New requests will appear here, and you&apos;ll get a notification.</Empty>
        : <div className="list">{pending.map(applicant)}</div>}

      {(reports ?? []).length > 0 && (
        <>
          <h2>Open reports</h2>
          <div className="list">
            {(reports ?? []).map((r) => (
              <div className="card stack" key={r.id}>
                <div><span className="badge danger">{r.target_type}</span> <span style={{ marginLeft: 6 }}>{r.reason}</span></div>
                {r.target_type === "user" && <p className="muted small" style={{ margin: 0 }}>User id {r.target_id.slice(0, 8)}…, find them under Residents and ban or shadowban.</p>}
                {r.target_type === "listing" && <a href={`/c/${slug}/l/${r.target_id}`} className="small">View listing →</a>}
                <form action={resolveReport} className="inline-form">
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="target_type" value={r.target_type} />
                  <input type="hidden" name="target_id" value={r.target_id} />
                  <input type="hidden" name="back" value={back} />
                  {r.target_type !== "user" && <button className="danger sm" name="action" value="remove">Remove content</button>}
                  {r.target_type === "user" && <button className="sm" name="action" value="resolve">Mark handled</button>}
                  <button className="secondary sm" name="action" value="dismiss">Dismiss</button>
                </form>
              </div>
            ))}
          </div>
        </>
      )}

      <h2>Invite link</h2>
      <div className="card stack">
        <p className="muted small" style={{ margin: 0 }}>Anyone with this link can <em>apply</em>; you still verify each person. Residents get their own copy with their username attached.</p>
        <input readOnly value={inviteLink ?? ""} aria-label="Invite link" />
        <div className="inline-form">
          {inviteLink && <CopyButton text={inviteLink} />}
          {inviteLink && <a className="btn secondary sm" href={`https://wa.me/?text=${encodeURIComponent(`Join our community marketplace: ${inviteLink}`)}`}>Share on WhatsApp</a>}
        </div>
        <details>
          <summary className="muted small" style={{ cursor: "pointer" }}>Make a new link…</summary>
          <form action={rotateInvite} className="inline-form" style={{ marginTop: 8 }}>
            <input type="hidden" name="community_id" value={community.id} /><input type="hidden" name="back" value={back} />
            <span className="small">The old link stops working immediately.</span>
            <button className="danger sm">Yes, replace it</button>
          </form>
        </details>
      </div>

      <h2>Announcements</h2>
      <form action={postAnnouncement} className="card stack">
        <input type="hidden" name="community_id" value={community.id} /><input type="hidden" name="back" value={back} />
        <label>Title<input name="title" required minLength={3} maxLength={120} placeholder="e.g. Water outage Thursday" /></label>
        <label>Message <span className="hint">(optional)</span><textarea name="body" rows={3} maxLength={2000} /></label>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 500 }}><input type="checkbox" name="pinned" /> Pin to the top of the feed</label>
        <button>Post to the feed</button>
      </form>
      <div className="list" style={{ marginTop: 10 }}>
        {(announcements ?? []).map((a) => (
          <form action={deleteAnnouncement} className="item" key={a.id}>
            <input type="hidden" name="id" value={a.id} /><input type="hidden" name="back" value={back} />
            <span className="grow">{a.pinned ? "📌 " : "📣 "}{a.title}</span><button className="ghost sm">Delete</button>
          </form>
        ))}
      </div>

      <h2>Residents</h2>
      <div className="list">{rest.map(member)}</div>
    </>
  );
}
