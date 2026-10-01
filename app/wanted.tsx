import Link from "next/link";
import type { PlaceRequest, Restaurant } from "@/lib/types";
import { regionName } from "@/lib/util";
import { wantedKey } from "@/lib/wanted";
import { wantRestaurantAction } from "./request-actions";

/** Restaurants we already know about that aren't on Zood yet. Signing one is a public vote that gets it invited. */
export function WantedBoard({ places, requests, mine, returnTo, where }: { places: Restaurant[]; requests: PlaceRequest[]; mine: Set<string>; returnTo: string; where: string }) {
  if (!places.length) return null;
  const byKey = new Map(requests.map((r) => [r.id, r]));
  return (
    <section className="wanted" id="wanted">
      <h2>Sign for the restaurants you want on Zood{where ? ` in ${where}` : ""}</h2>
      <p className="meta" style={{ marginTop: -6 }}>We found these on public maps. They don't have menus on Zood yet. Every signature tells them people want to find them here, and gets them invited.</p>
      <div className="grid">
        {places.map((r) => {
          const key = wantedKey(r);
          const req = byKey.get(key);
          const n = req?.supportCount ?? 0;
          const signed = mine.has(key);
          return (
            <article className="card" key={r.id}>
              <h3><Link href={`/r/${r.id}`}>{r.name}</Link></h3>
              <div className="meta">{[r.address, `${r.city}, ${regionName(r.country)}`].filter(Boolean).join(" · ")}</div>
              <div>{r.cuisines.slice(0, 3).map((c) => <span key={c} className="tag gray">{c}</span>)}</div>
              <div className="signline">
                <span className="signcount">{n > 0 ? `✍️ ${n} ${n === 1 ? "signature" : "signatures"}` : "Be the first to sign"}</span>
                {signed ? (
                  <span className="btn sm sign done">✓ You signed</span>
                ) : (
                  <form action={wantRestaurantAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <button type="submit" className="sm sign">✍️ I want this on Zood</button>
                  </form>
                )}
              </div>
              <div className="meta">Own it? <Link href={`/list?claim=${r.id}`}>Claim it</Link></div>
            </article>
          );
        })}
      </div>
      <p className="ctas" style={{ marginTop: 14 }}><Link className="btn" href="/requests/new">➕ Not here? Add a restaurant</Link></p>
    </section>
  );
}
