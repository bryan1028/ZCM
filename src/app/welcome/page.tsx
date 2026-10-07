import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { USERNAME_RE } from "@/lib/usernames";

async function setUsername(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const username = String(formData.get("username")).trim().toLowerCase();
  if (!USERNAME_RE.test(username)) redirect("/welcome?error=Use 3–20 letters, numbers or underscores");
  const { error } = await supabase.from("profiles").update({ username }).eq("id", user.id);
  if (error) redirect(`/welcome?error=${encodeURIComponent(error.code === "23505" ? "That username is taken" : error.message)}`);
  redirect(String(formData.get("next") || "/"));
}

export default async function Welcome({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  return (
    <>
      <h1>Pick a username</h1>
      <p className="muted">This is how neighbours see you in reviews and chats. Your real name, email and phone stay private.</p>
      <form action={setUsername} className="card">
        <input type="hidden" name="next" value={next?.startsWith("/") ? next : "/"} />
        <label>Username<input name="username" required minLength={3} maxLength={20} pattern="[A-Za-z0-9_]+" autoCapitalize="none" /></label>
        <button>Save</button>
        {error && <p className="muted">{error}</p>}
      </form>
    </>
  );
}
