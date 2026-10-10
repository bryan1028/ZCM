import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { USERNAME_RE } from "@/lib/usernames";
import Page from "@/components/page";
import { getUser } from "@/lib/auth";
import Submit from "@/components/submit-button";

async function setUsername(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await getUser(supabase);
  if (!user) redirect("/login");
  const username = String(formData.get("username")).trim().toLowerCase();
  const next = String(formData.get("next") || "/");
  const back = (m: string) => redirect(`/welcome?error=${encodeURIComponent(m)}&next=${encodeURIComponent(next)}`);
  if (!USERNAME_RE.test(username)) back("Use 3–20 lowercase letters, numbers or underscores");
  const { error } = await supabase.from("profiles").update({ username }).eq("id", user.id);
  if (error) back(error.code === "23505" ? "That username is taken, try another" : error.message);
  redirect(next);
}

export default async function Welcome({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  return (
    <Page>
      <h1>Pick a username</h1>
      <p className="muted" style={{ margin: "6px 0 18px", fontSize: 16 }}>
        This is how neighbours see you in chats and reviews. Your real name, email and phone stay private.
      </p>
      {error && <div className="alert error" role="alert" style={{ marginBottom: 12 }}>{error}</div>}
      <form action={setUsername} className="card stack">
        <input type="hidden" name="next" value={next?.startsWith("/") && !next.startsWith("//") ? next : "/"} />
        <label>Username
          <input name="username" required minLength={3} maxLength={20} pattern="[A-Za-z0-9_]+" autoCapitalize="none" autoCorrect="off" placeholder="e.g. jane_k" />
          <span className="hint">3–20 characters: letters, numbers, underscores.</span>
        </label>
        <Submit>Continue</Submit>
      </form>
    </Page>
  );
}
