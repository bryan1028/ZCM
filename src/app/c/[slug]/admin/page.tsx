import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function review(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const status = String(formData.get("status"));
  if (!user || !["verified", "rejected", "suspended"].includes(status)) return;
  // RLS guarantees only an admin of that community can make this update succeed.
  await supabase.from("memberships")
    .update({ status, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq("id", String(formData.get("id")));
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
  const { data: me } = await supabase.from("memberships").select("role").eq("community_id", community.id).maybeSingle();
  if (me?.role !== "admin") notFound();

  const { data: members } = await supabase
    .from("memberships")
    .select("id, status, role, shadowbanned, unit, proof_note, created_at, profiles:user_id(full_name)")
    .eq("community_id", community.id).order("created_at", { ascending: false });
  // `profiles` isn't directly related to memberships in PostgREST's eyes; fall back gracefully.
  const { data: reports } = await supabase
    .from("reports").select("id, target_type, target_id, reason, created_at")
    .eq("community_id", community.id).eq("status", "open").order("created_at");
  const pending = (members ?? []).filter((m) => m.status === "pending");
  const rest = (members ?? []).filter((m) => m.status !== "pending");

  const row = (m: NonNullable<typeof members>[number]) => (
    <div className="card" key={m.id}>
      <div className="row">
        <strong>{(m.profiles as unknown as { full_name: string | null } | null)?.full_name ?? "Unnamed"} — {m.unit}</strong>
        <span className="badge">{m.shadowbanned ? "shadowbanned" : m.status}</span>
      </div>
      {m.proof_note && <p className="muted">{m.proof_note}</p>}
      <form action={review} style={{ display: "flex", gap: 8 }}>
        <input type="hidden" name="id" value={m.id} />
        <input type="hidden" name="back" value={`/c/${slug}/admin`} />
        {m.status !== "verified" && <button name="status" value="verified">Verify resident</button>}
        {m.status === "pending" && <button className="secondary" name="status" value="rejected">Reject</button>}
        {m.status === "verified" && m.role !== "admin" && <button className="secondary" name="status" value="suspended">Ban</button>}
      </form>
      {m.status === "verified" && m.role !== "admin" && (
        <form action={shadowban} style={{ marginTop: 6 }}>
          <input type="hidden" name="id" value={m.id} />
          <input type="hidden" name="back" value={`/c/${slug}/admin`} />
          <button className="secondary" name="on" value={String(!m.shadowbanned)}>
            {m.shadowbanned ? "Lift shadowban" : "Shadowban"}
          </button>
        </form>
      )}
    </div>
  );

  return (
    <>
      <h2>Open reports ({(reports ?? []).length})</h2>
      {(reports ?? []).map((r) => (
        <div className="card" key={r.id}>
          <p><span className="badge">{r.target_type}</span> {r.reason}</p>
          {r.target_type === "listing" && <p><a href={`/c/${slug}/l/${r.target_id}`}>View listing</a></p>}
          <form action={resolveReport} style={{ display: "flex", gap: 8 }}>
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="target_type" value={r.target_type} />
            <input type="hidden" name="target_id" value={r.target_id} />
            <input type="hidden" name="back" value={`/c/${slug}/admin`} />
            <button name="action" value="remove">Remove content</button>
            <button className="secondary" name="action" value="dismiss">Dismiss</button>
          </form>
        </div>
      ))}
      <h2>Residents awaiting verification ({pending.length})</h2>
      {pending.map(row)}
      <h2>Everyone else</h2>
      {rest.map(row)}
    </>
  );
}
