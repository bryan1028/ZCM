import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isEmailVerified, requireUser, safeNext } from "@/lib/session";
import { checkVerified, resendVerification } from "../auth-actions";

export const metadata: Metadata = { title: "Verify your email", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Verify({ searchParams }: { searchParams: Promise<{ next?: string; sent?: string; waiting?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next, "/");
  const user = await requireUser("/verify");
  if (await isEmailVerified(user.uid)) redirect(next);
  return (
    <section className="hero">
      <h1>Verify your email</h1>
      <p>Pledges, requests and claims come from verified people only, which keeps bots out and makes your pledge count. We sent a link to <b>{user.email}</b>. Click it, then come back and press the button.</p>
      {sp.sent && <div className="notice">Sent again. Check your inbox and spam folder.</div>}
      {sp.waiting && <div className="notice">Not verified yet. Click the link in the email first.</div>}
      <form action={checkVerified}><input type="hidden" name="next" value={next} /><button type="submit">I've verified my email</button></form>
      <form action={resendVerification} style={{ marginTop: 10 }}><input type="hidden" name="next" value={next} /><button type="submit" className="btn ghost">Send the email again</button></form>
    </section>
  );
}
