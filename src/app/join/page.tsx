import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { pushSoon } from "@/lib/push";
import Link from "next/link";
import Page from "@/components/page";
import { getUser } from "@/lib/auth";
import Submit from "@/components/submit-button";

export const metadata = { title: "Join your community" };

async function requestToJoin(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await getUser(supabase);
  if (!user) redirect("/login");
  if (formData.get("agree") !== "on") redirect(`/join?error=${encodeURIComponent("Please accept the Terms and Privacy Policy")}`);
  const fullName = String(formData.get("full_name") ?? "").trim();
  if (fullName.length < 2) redirect(`/join?error=${encodeURIComponent("Please enter your name so your admin knows who you are")}`);
  await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id);   // only admins ever see this
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
  const { data: { user } } = await getUser(supabase);
  const { data: me } = await supabase.from("profiles").select("full_name").eq("id", user!.id).maybeSingle();

  // With an invite code we show just that community; otherwise the full list.
  const { data: invited } = code ? await supabase.rpc("community_by_invite", { c: code }) : { data: null };
  const options: { id: string; name: string }[] = invited?.length
    ? invited : ((await supabase.from("communities").select("id, name").order("name")).data ?? []);

  return (
    <Page>
      <h1>Join your community</h1>
      <p className="muted" style={{ margin: "6px 0 18px", fontSize: 16 }}>
        An admin from your community will confirm you live there before you can see listings.{ref && invited?.length ? ` You were invited by @${ref}.` : ""}
      </p>
      {error && <div className="alert error" role="alert" style={{ marginBottom: 12 }}>{error.includes("duplicate") ? "You've already requested this community." : error}</div>}
      <form action={requestToJoin} className="card stack">
        <input type="hidden" name="ref" value={invited?.length ? ref ?? "" : ""} />
        <label>Your name <span className="hint">(your admin sees this, neighbours don&apos;t)</span>
          <input name="full_name" required defaultValue={me?.full_name ?? ""} autoComplete="name" placeholder="e.g. Jane Wanjiku" />
        </label>
        <label>Community
          <select name="community_id" required>
            {options.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>House / apartment number<input name="unit" required placeholder="e.g. Block C, Flat 4" /></label>
        <label>Anything that helps us verify you <span className="hint">(optional)</span>
          <textarea name="proof_note" rows={3} placeholder="e.g. tenant since 2023; neighbour Mr Otieno (C3) can vouch" />
        </label>
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontWeight: 400 }}>
          <input type="checkbox" name="agree" required style={{ marginTop: 2 }} />
          <span>I live here and agree to the <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.</span>
        </label>
        <Submit>Request access</Submit>
      </form>
    </Page>
  );
}
