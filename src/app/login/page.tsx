import { cookies, headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNext, siteUrl } from "@/lib/nav";

function friendly(message: string, status?: number) {
  const m = message.toLowerCase();
  if (status === 429 || m.includes("rate limit") || m.includes("too many"))
    return "We've sent a lot of sign-in emails recently. Please wait a few minutes and try again.";
  if (m.includes("not authorized") || m.includes("not allowed"))
    return "We can't send email to that address yet. Please contact your community admin.";
  if (m.includes("invalid") && m.includes("email")) return "That email address doesn't look right. Please check it and try again.";
  return message;
}

async function signIn(formData: FormData) {
  "use server";
  const email = String(formData.get("email")).trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const next = safeNext(String(formData.get("next") ?? ""));
  const origin = siteUrl((await headers()).get("host")) || (await headers()).get("origin") || "";
  // Remember where to send them after the magic link (e.g. the invite → join flow). A cookie avoids
  // having to allow-list query strings in Supabase's redirect URLs.
  (await cookies()).set("zcm_next", next, { httpOnly: true, sameSite: "lax", maxAge: 3600, path: "/" });
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback`, data: name ? { full_name: name } : undefined },
  });
  // Keep what they typed (and where they were headed) so a failure doesn't wipe the form.
  const keep = new URLSearchParams({ email, name, next });
  if (error) keep.set("error", friendly(error.message, error.status));
  else keep.set("sent", "1");
  redirect(`/login?${keep.toString()}`);
}

export default async function Login({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string; next?: string; email?: string; name?: string }> }) {
  const { sent, error, next, email, name } = await searchParams;
  const nextPath = safeNext(next);
  return (
    <>
      <h1>Zist Community Marketplace</h1>
      <p className="muted">A closed marketplace for residents only. Sign in with your email; we&apos;ll send you a link.</p>
      {sent ? (
        <div className="card">
          <strong>Check your email</strong>
          <p>We sent a sign-in link to <b>{email}</b>. It can take a minute, and it may land in spam or promotions.</p>
          <p className="muted">
            Wrong address?{" "}
            <Link href={`/login?${new URLSearchParams({ name: name ?? "", next: nextPath }).toString()}`}>Start again</Link>
          </p>
        </div>
      ) : (
        <>
          {error && <div className="card" role="alert" style={{ borderColor: "#c0392b", color: "#c0392b" }}>{error}</div>}
          <form action={signIn} className="card">
            <input type="hidden" name="next" value={nextPath} />
            <label>Your name<input name="name" placeholder="Jane Wanjiku" defaultValue={name ?? ""} autoComplete="name" /></label>
            <label>Email<input name="email" type="email" required defaultValue={email ?? ""} autoComplete="email" /></label>
            <button>Email me a sign-in link</button>
          </form>
        </>
      )}
    </>
  );
}
