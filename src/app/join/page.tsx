import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { pushSoon } from "@/lib/push";

async function requestToJoin(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await supabase.from("memberships").insert({
    community_id: String(formData.get("community_id")),
    user_id: user.id,
    unit: String(formData.get("unit")).trim(),
    proof_note: String(formData.get("proof_note") ?? "").trim() || null,
    invited_by_username: String(formData.get("ref") ?? "").trim() || null,   // verified by a DB trigger
  });
  pushSoon();
  redirect(error ? `/join?error=${encodeURIComponent(error.message)}` : "/");
}

export default async function Join({ searchParams }: { searchParams: Promise<{ error?: string; code?: string; ref?: string }> }) {
  const { error, code, ref } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("username").eq("id", user!.id).maybeSingle();
  if (!me?.username) {
    const back = `/join${code ? `?code=${encodeURIComponent(code)}${ref ? `&ref=${encodeURIComponent(ref)}` : ""}` : ""}`;
    redirect(`/welcome?next=${encodeURIComponent(back)}`);
  }

  // With an invite code we show just that community; otherwise the full list.
  const { data: invited } = code ? await supabase.rpc("community_by_invite", { c: code }) : { data: null };
  const options: { id: string; name: string }[] = invited?.length
    ? invited : ((await supabase.from("communities").select("id, name").order("name")).data ?? []);

  return (
    <>
      <h1>Join your community</h1>
      <p className="muted">An admin from your community will confirm you live there before you can see listings.{ref && invited?.length ? ` You were invited by @${ref}.` : ""}</p>
      <form action={requestToJoin} className="card">
        <input type="hidden" name="ref" value={invited?.length ? ref ?? "" : ""} />
        <label>Community
          <select name="community_id" required>
            {options.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>House / apartment number<input name="unit" required placeholder="e.g. Block C, Flat 4" /></label>
        <label>Anything that helps us verify you (optional)
          <textarea name="proof_note" rows={3} placeholder="e.g. tenant since 2023; neighbour Mr Otieno (C3) can vouch" />
        </label>
        <button>Request access</button>
        {error && <p className="muted">{error.includes("duplicate") ? "You've already requested this community." : error}</p>}
      </form>
    </>
  );
}
