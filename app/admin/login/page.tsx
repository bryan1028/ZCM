import type { Metadata } from "next";
import { adminLogin } from "../../actions";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const configured = Boolean(process.env.ADMIN_PASSWORD);
  return (
    <section className="hero">
      <h1>Admin</h1>
      {!configured && <div className="notice">ADMIN_PASSWORD is not set on this server, so sign-in is disabled. Add it in your host's environment variables and redeploy.</div>}
      {error && <div className="notice">Wrong password.</div>}
      <form className="stack" action={adminLogin}>
        <label className="f">Password<input type="password" name="password" autoComplete="current-password" required autoFocus /></label>
        <button type="submit" disabled={!configured}>Sign in</button>
      </form>
    </section>
  );
}
