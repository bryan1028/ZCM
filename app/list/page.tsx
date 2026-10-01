import type { Metadata } from "next";
import { getStore } from "@/lib/store";
import { DIETS } from "@/lib/types";
import { submitListing } from "../actions";

export const metadata: Metadata = { title: "List your restaurant" };
export const dynamic = "force-dynamic";

type SP = Promise<{ claim?: string; sent?: string; error?: string }>;

export default async function ListPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const existing = sp.claim ? await getStore().getRestaurant(sp.claim) : null;

  if (sp.sent) {
    return (
      <section className="hero">
        <h1>Thanks! We'll be in touch on WhatsApp.</h1>
        <p>We verify every listing before it goes live. You'll hear from us shortly to add your menu.</p>
      </section>
    );
  }

  return (
    <section className="hero">
      <h1>{existing ? `Claim ${existing.name}` : "Get customers messaging you on WhatsApp"}</h1>
      <p>Free for your first 3 months. Diners find you by diet, allergy and cuisine, and message you directly.</p>
      {sp.error && <div className="notice">Please fill in every field, including your WhatsApp number with country code (e.g. +1 555 123 4567).</div>}
      <form className="stack" action={submitListing}>
        <input type="hidden" name="claimId" value={existing?.id ?? ""} />
        <input type="text" name="website" tabIndex={-1} autoComplete="off" style={{ display: "none" }} aria-hidden />
        <label className="f">Restaurant name<input type="text" name="name" required defaultValue={existing?.name} /></label>
        <label className="f">City<input type="text" name="city" required defaultValue={existing?.city} /></label>
        <label className="f">Country code (2 letters, e.g. KE, GB, US)<input type="text" name="country" required maxLength={2} defaultValue={existing?.country} style={{ textTransform: "uppercase" }} /></label>
        <label className="f">Your name<input type="text" name="contactName" required /></label>
        <label className="f">WhatsApp number (with country code)<input type="tel" name="whatsapp" required placeholder="+1 555 123 4567" /></label>
        <label className="f">Email (optional)<input type="email" name="email" /></label>
        {!existing && (
          <div className="chips" role="group" aria-label="Diets you cater for">
            {DIETS.map((d) => <label key={d.id}><input type="checkbox" name="diet" value={d.id} /><span>{d.label}</span></label>)}
          </div>
        )}
        <button type="submit">{existing ? "Claim listing" : "Submit restaurant"}</button>
      </form>
    </section>
  );
}
