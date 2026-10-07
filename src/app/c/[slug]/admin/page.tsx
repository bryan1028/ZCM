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

export default async function Admin({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: community } = await supabase.from("communities").select("id").eq("slug", slug).single();
  if (!community) notFound();
  const { data: me } = await supabase.from("memberships").select("role").eq("community_id", community.id).maybeSingle();
  if (me?.role !== "admin") notFound();

  const { data: members } = await supabase
    .from("memberships")
    .select("id, status, role, unit, proof_note, created_at, profiles:user_id(full_name)")
    .eq("community_id", community.id).order("created_at", { ascending: false });
  // `profiles` isn't directly related to memberships in PostgREST's eyes; fall back gracefully.
  const pending = (members ?? []).filter((m) => m.status === "pending");
  const rest = (members ?? []).filter((m) => m.status !== "pending");

  const row = (m: NonNullable<typeof members>[number]) => (
    <div className="card" key={m.id}>
      <div className="row">
        <strong>{(m.profiles as unknown as { full_name: string | null } | null)?.full_name ?? "Unnamed"} — {m.unit}</strong>
        <span className="badge">{m.status}</span>
      </div>
      {m.proof_note && <p className="muted">{m.proof_note}</p>}
      <form action={review} style={{ display: "flex", gap: 8 }}>
        <input type="hidden" name="id" value={m.id} />
        <input type="hidden" name="back" value={`/c/${slug}/admin`} />
        {m.status !== "verified" && <button name="status" value="verified">Verify resident</button>}
        {m.status === "pending" && <button className="secondary" name="status" value="rejected">Reject</button>}
        {m.status === "verified" && m.role !== "admin" && <button className="secondary" name="status" value="suspended">Suspend</button>}
      </form>
    </div>
  );

  return (
    <>
      <h2>Residents awaiting verification ({pending.length})</h2>
      {pending.map(row)}
      <h2>Everyone else</h2>
      {rest.map(row)}
    </>
  );
}
