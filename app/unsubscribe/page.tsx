import type { Metadata } from "next";
import { unsubscribeAction } from "../social-actions";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Unsubscribe({ searchParams }: { searchParams: Promise<{ u?: string; t?: string; done?: string; error?: string }> }) {
  const sp = await searchParams;
  return (
    <section className="hero">
      <h1>Email preferences</h1>
      {sp.done && <div className="notice">You're unsubscribed. We won't email you about launches any more.</div>}
      {sp.error && <div className="notice">That link isn't valid. Sign in and untick the email option on your account page instead.</div>}
      {!sp.done && !sp.error && sp.u && sp.t && (
        <form className="stack" action={unsubscribeAction}>
          <input type="hidden" name="u" value={sp.u} /><input type="hidden" name="t" value={sp.t} />
          <p>Stop emails from Zist about launches and the places you asked for?</p>
          <button type="submit">Unsubscribe</button>
        </form>
      )}
    </section>
  );
}
