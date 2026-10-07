import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNext, siteUrl } from "@/lib/nav";

async function signIn(formData: FormData) {
  "use server";
  const email = String(formData.get("email")).trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const origin = siteUrl((await headers()).get("host")) || (await headers()).get("origin") || "";
  // Remember where to send them after the magic link (e.g. the invite → join flow). A cookie avoids
  // having to allow-list query strings in Supabase's redirect URLs.
  (await cookies()).set("zcm_next", safeNext(String(formData.get("next") ?? "")), { httpOnly: true, sameSite: "lax", maxAge: 3600, path: "/" });
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback`, data: name ? { full_name: name } : undefined },
  });
  redirect(error ? `/login?error=${encodeURIComponent(error.message)}` : "/login?sent=1");
}

export default async function Login({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string; next?: string }> }) {
  const { sent, error, next } = await searchParams;
  return (
    <>
      <h1>Zist Community Marketplace</h1>
      <p className="muted">A closed marketplace for residents only. Sign in with your email; we&apos;ll send you a link.</p>
      {sent ? (
        <div className="card">Check your email for the sign-in link.</div>
      ) : (
        <form action={signIn} className="card">
          <input type="hidden" name="next" value={safeNext(next)} />
          <label>Your name<input name="name" placeholder="Jane Wanjiku" /></label>
          <label>Email<input name="email" type="email" required /></label>
          <button>Email me a sign-in link</button>
          {error && <p className="muted">{error}</p>}
        </form>
      )}
    </>
  );
}
