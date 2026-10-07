import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

async function signIn(formData: FormData) {
  "use server";
  const email = String(formData.get("email")).trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback`, data: name ? { full_name: name } : undefined },
  });
  const { redirect } = await import("next/navigation");
  redirect(error ? `/login?error=${encodeURIComponent(error.message)}` : "/login?sent=1");
}

export default async function Login({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const { sent, error } = await searchParams;
  return (
    <>
      <h1>Zist Community Marketplace</h1>
      <p className="muted">A closed marketplace for residents only. Sign in with your email; we&apos;ll send you a link.</p>
      {sent ? (
        <div className="card">Check your email for the sign-in link.</div>
      ) : (
        <form action={signIn} className="card">
          <label>Your name<input name="name" placeholder="Jane Wanjiku" /></label>
          <label>Email<input name="email" type="email" required /></label>
          <button>Email me a sign-in link</button>
          {error && <p className="muted">{error}</p>}
        </form>
      )}
    </>
  );
}
