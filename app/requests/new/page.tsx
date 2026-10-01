import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { submitRequest } from "../../request-actions";

export const metadata: Metadata = { title: "Zummon a place" };
export const dynamic = "force-dynamic";

export default async function NewRequest({ searchParams }: { searchParams: Promise<{ error?: string; city?: string; country?: string; name?: string }> }) {
  const [{ error, city, country, name }, user] = await Promise.all([searchParams, requireUser("/requests/new")]);
  return (
    <section className="hero">
      <h1>Zummon a place ✨</h1>
      <p>It will show as zummoned by <span className="sig">@{user.handle}</span>, and others can back it.</p>
      {error === "limit" && <div className="notice">You've reached today's limit of requests. Please come back tomorrow.</div>}
      {error === "1" && <div className="notice">Please give the place's name, city and 2-letter country code.</div>}
      <form className="stack" action={submitRequest}>
        <input type="text" name="website_hp" tabIndex={-1} autoComplete="off" style={{ display: "none" }} aria-hidden />
        <label className="f">Type<select name="kind"><option value="restaurant">Restaurant</option><option value="store">Store / supermarket</option></select></label>
        <label className="f">Name<input type="text" name="name" required maxLength={100} defaultValue={name} /></label>
        <div className="row" style={{ display: "flex", gap: 10 }}>
          <label className="f" style={{ flex: 2 }}>City<input type="text" name="city" required defaultValue={city ?? user.profile.city} /></label>
          <label className="f" style={{ flex: 1 }}>Country (2)<input type="text" name="country" required maxLength={2} defaultValue={country ?? user.profile.country} style={{ textTransform: "uppercase" }} /></label>
        </div>
        <label className="f">Why do you want it on Zist? (optional)<textarea name="note" rows={3} maxLength={300} /></label>
        <label className="f">Their WhatsApp number, if you know it (optional)<input type="tel" name="whatsapp" placeholder="+1 555 123 4567" /></label>
        <label className="f">Website (optional)<input type="text" name="website" placeholder="https://" /></label>
        <button type="submit">Zummon it</button>
      </form>
    </section>
  );
}
