import type { Metadata } from "next";
import { sendSupportMessage } from "../social-actions";

export const metadata: Metadata = { title: "Support", description: "Get help with Zist, report a problem, or ask us to remove or correct a listing." };
export const dynamic = "force-dynamic";

export default async function Support({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const sp = await searchParams;
  return (
    <section className="hero">
      <h1>Support</h1>
      <p>Questions, a problem with a listing or price, a wrong allergen tag, or a request to delete your data? Tell us and we'll reply by email.</p>
      <p className="meta">To delete your account and the data tied to it, sign in and use <b>Delete my account</b> on your account page.</p>
      {sp.sent && <div className="notice">Thanks, we got your message.</div>}
      {sp.error && <div className="notice">Please add a valid email and a message.</div>}
      <form className="stack" action={sendSupportMessage}>
        <input type="text" name="website" tabIndex={-1} autoComplete="off" style={{ display: "none" }} aria-hidden />
        <label className="f">Your email<input type="email" name="email" required autoComplete="email" /></label>
        <label className="f">Name (optional)<input type="text" name="name" maxLength={80} /></label>
        <label className="f">Message<textarea name="message" rows={6} required maxLength={2000} /></label>
        <button type="submit">Send</button>
      </form>
    </section>
  );
}
