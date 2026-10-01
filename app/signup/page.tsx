import type { Metadata } from "next";
import Link from "next/link";
import { DIETS } from "@/lib/types";
import { safeNext } from "@/lib/session";
import { signUp } from "../auth-actions";
import { Captcha } from "../captcha";

export const metadata: Metadata = { title: "Create your account" };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  username: "Usernames are 3-20 letters, numbers or underscores.", taken: "That username is taken. Try another.",
  email: "That email doesn't look right.", exists: "An account with that email already exists. Try signing in.",
  password: "Use a password of at least 8 characters.", failed: "Something went wrong. Please try again.",
  unavailable: "Accounts aren't available on this server yet.", captcha: "We couldn't confirm you're human. Wait a second and try again.",
};

export default async function SignUp({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  return (
    <section className="hero">
      <h1>Join Zist</h1>
      <p>Save your diet and allergies, request the places you want on Zist, and message restaurants. Your username is your public signature on anything you add.</p>
      {sp.error && <div className="notice">{ERRORS[sp.error] ?? ERRORS.failed}</div>}
      <form className="stack" action={signUp}>
        <input type="hidden" name="next" value={next} />
        <input type="text" name="website" tabIndex={-1} autoComplete="off" style={{ display: "none" }} aria-hidden />
        <label className="f">Username<input type="text" name="username" required minLength={3} maxLength={20} pattern="[A-Za-z0-9_]{3,20}" autoCapitalize="none" autoComplete="username" /></label>
        <label className="f">Email<input type="email" name="email" required autoComplete="email" /></label>
        <label className="f">Password (8+ characters)<input type="password" name="password" required minLength={8} autoComplete="new-password" /></label>
        <div className="row" style={{ display: "flex", gap: 10 }}>
          <label className="f" style={{ flex: 2 }}>Your city<input type="text" name="city" placeholder="Your city" /></label>
          <label className="f" style={{ flex: 1 }}>Country (2)<input type="text" name="country" maxLength={2} placeholder="e.g. KE, GB, US" style={{ textTransform: "uppercase" }} /></label>
        </div>
        <div className="chips" role="group" aria-label="Your diet">
          {DIETS.map((d) => <label key={d.id}><input type="checkbox" name="diet" value={d.id} /><span>{d.label}</span></label>)}
        </div>
        <label className="f">Allergies (comma separated, optional)<input type="text" name="allergies" placeholder="peanuts, shellfish" /></label>
        <label className="checkline"><input type="checkbox" name="optIn" /><span>Email me when Zist launches in my city, and about restaurants I asked for. You can opt out any time.</span></label>
        <Captcha />
        <button type="submit">Create account</button>
      </form>
      <p className="meta" style={{ marginTop: 14 }}>Already have an account? <Link href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link></p>
    </section>
  );
}
