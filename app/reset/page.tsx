import type { Metadata } from "next";
import { requestReset } from "../auth-actions";

export const metadata: Metadata = { title: "Reset password" };

export default async function Reset({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const { sent } = await searchParams;
  return (
    <section className="hero">
      <h1>Reset your password</h1>
      {sent ? <div className="notice">If an account exists for that email, a reset link is on its way.</div> : (
        <form className="stack" action={requestReset}>
          <label className="f">Email<input type="email" name="email" required autoComplete="email" /></label>
          <button type="submit">Send reset link</button>
        </form>
      )}
    </section>
  );
}
