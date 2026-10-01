import type { Metadata } from "next";
import Link from "next/link";
import { getStore } from "@/lib/store";
import { currentUser } from "@/lib/session";
import { submitClaim } from "../claim-actions";

export const metadata: Metadata = { title: "Claim your restaurant" };
export const dynamic = "force-dynamic";

type SP = Promise<{ claim?: string; error?: string }>;

export default async function ListPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const existing = sp.claim ? await getStore().getRestaurant(sp.claim) : null;
  const user = await currentUser();
  const next = `/list${sp.claim ? `?claim=${encodeURIComponent(sp.claim)}` : ""}`;

  return (
    <section className="hero">
      <h1>{existing ? `Claim ${existing.name}` : "Put your restaurant on Zood"}</h1>
      <p>Is this your restaurant? Zood is the tool that brings it straight to people looking for it, with no commission. Claim your free trial: edit your profile and menu, and get customers messaging you directly.</p>
      {sp.error === "taken" && <div className="notice">That restaurant already has an owner. If that's wrong, <Link href="/support">tell us</Link>.</div>}
      {sp.error === "1" && <div className="notice">Please fill in every field. The proof can be a link to your website, social page or Maps listing, or a short note.</div>}
      {!user ? (
        <p><Link className="btn" href={`/login?next=${encodeURIComponent(next)}`}>Sign in to claim</Link> <Link className="btn ghost" href={`/signup`}>Create an account</Link></p>
      ) : (
        <>
          <p className="meta">To protect restaurants, we verify every claim before anything changes: we check your proof and may contact the restaurant on its public listing. Nothing goes live until we approve it.</p>
          <form className="stack" action={submitClaim}>
            <input type="hidden" name="claimId" value={existing?.id ?? ""} />
            <input type="text" name="website" tabIndex={-1} autoComplete="off" style={{ display: "none" }} aria-hidden />
            {existing
              ? <p className="meta"><b>{existing.name}</b> · {[existing.address, existing.city].filter(Boolean).join(", ")}</p>
              : <>
                  <label className="f">Restaurant name<input type="text" name="name" required /></label>
                  <label className="f">City<input type="text" name="city" required /></label>
                  <label className="f">Country code (2 letters, e.g. KE, GB, US)<input type="text" name="country" required maxLength={2} style={{ textTransform: "uppercase" }} /></label>
                </>}
            <label className="f">Your name<input type="text" name="contactName" required /></label>
            <label className="f">Your role
              <select name="role" required defaultValue="owner"><option value="owner">Owner</option><option value="manager">Manager</option><option value="staff">Staff with permission to act for the owner</option></select>
            </label>
            <label className="f">WhatsApp number for the restaurant (with country code)<input type="tel" name="whatsapp" required placeholder="+1 555 123 4567" /></label>
            <label className="f">Your email (ideally at the restaurant's own domain)<input type="email" name="email" required autoComplete="email" /></label>
            <label className="f">Proof you run it<textarea name="proof" rows={3} required maxLength={500} placeholder="Link to your website, Instagram or Google Maps listing, or tell us how we can verify you." /></label>
            <button type="submit">Claim my free trial</button>
          </form>
        </>
      )}
    </section>
  );
}
