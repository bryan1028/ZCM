import type { Metadata } from "next";
import Link from "next/link";
import { safeNext } from "@/lib/session";
import { logIn } from "../auth-actions";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  creds: "Wrong username/email or password.", toomany: "Too many attempts. Please wait a few minutes and try again.",
  failed: "Something went wrong. Please try again.", unavailable: "Accounts aren't available on this server yet.",
};

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  return (
    <section className="hero">
      <h1>Sign in</h1>
      {sp.error && <div className="notice">{ERRORS[sp.error] ?? ERRORS.failed}</div>}
      <form className="stack" action={logIn}>
        <input type="hidden" name="next" value={next} />
        <label className="f">Username or email<input type="text" name="identifier" required autoCapitalize="none" autoComplete="username" autoFocus /></label>
        <label className="f">Password<input type="password" name="password" required autoComplete="current-password" /></label>
        <button type="submit">Sign in</button>
      </form>
      <p className="meta" style={{ marginTop: 14 }}>
        New here? <Link href={`/signup?next=${encodeURIComponent(next)}`}>Create an account</Link> · <Link href="/reset">Forgot password?</Link>
      </p>
    </section>
  );
}
