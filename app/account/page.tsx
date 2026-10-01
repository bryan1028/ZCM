import type { Metadata } from "next";
import Link from "next/link";
import { DIETS } from "@/lib/types";
import { requireUser } from "@/lib/session";
import { getStore } from "@/lib/store";
import { regionName } from "@/lib/util";
import { saveAccount } from "../auth-actions";

export const metadata: Metadata = { title: "Your account", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Account({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser("/account");
  const p = user.profile;
  const mine = await getStore().requestsBy(user.uid);
  return (
    <section className="hero">
      <h1>{p.username ? `@${p.username}` : "Your account"}</h1>
      <p className="meta">{user.email}</p>
      {sp.saved && <div className="notice">Saved.</div>}
      {sp.error && <div className="notice">That username isn't available.</div>}
      <form className="stack" action={saveAccount}>
        {!p.username && <label className="f">Choose your public username<input type="text" name="username" required pattern="[A-Za-z0-9_]{3,20}" autoCapitalize="none" /></label>}
        <div className="row" style={{ display: "flex", gap: 10 }}>
          <label className="f" style={{ flex: 2 }}>City<input type="text" name="city" defaultValue={p.city} /></label>
          <label className="f" style={{ flex: 1 }}>Country (2)<input type="text" name="country" maxLength={2} defaultValue={p.country} style={{ textTransform: "uppercase" }} /></label>
        </div>
        <div className="chips" role="group" aria-label="Your diet">
          {DIETS.map((d) => <label key={d.id}><input type="checkbox" name="diet" value={d.id} defaultChecked={p.diets.includes(d.id)} /><span>{d.label}</span></label>)}
        </div>
        <label className="f">Allergies (comma separated)<input type="text" name="allergies" defaultValue={p.allergies.join(", ")} /></label>
        <label className="checkline"><input type="checkbox" name="optIn" defaultChecked={p.optIn} /><span>Email me when Zist launches in my city, and about restaurants I asked for.</span></label>
        <button type="submit">Save</button>
      </form>
      <h2 style={{ marginTop: 32 }}>Your requests</h2>
      {mine.length === 0 && <p className="meta">You haven't requested anything yet. <Link href="/requests/new">Request a place</Link>.</p>}
      {mine.map((r) => (
        <p key={r.id} className="meta"><b>{r.name}</b> · {r.city}, {regionName(r.country)} · {r.supportCount} {r.supportCount === 1 ? "person wants" : "people want"} this</p>
      ))}
    </section>
  );
}
