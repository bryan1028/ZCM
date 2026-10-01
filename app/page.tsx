import Link from "next/link";
import { currentUser } from "@/lib/session";
import { detectPlace } from "@/lib/geo";
import { ALLERGENS } from "@/lib/dishes";
import { getStore, isDemo } from "@/lib/store";
import { DIETS, type Diet } from "@/lib/types";
import { regionName, slugify } from "@/lib/util";
import { DishCard, RestaurantCard } from "./components";
import { PinStrip } from "./pins";
import { WantedBoard } from "./wanted";
import { CityInput } from "./cityinput";
import { wantedKey } from "@/lib/wanted";

export const dynamic = "force-dynamic";

type SP = Promise<{ pledge?: string; pledged?: string; q?: string; city?: string; diet?: string | string[]; avoid?: string | string[] }>;
const many = (v?: string | string[]) => ([] as string[]).concat(v ?? []);

export default async function Zood({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const [user, place] = await Promise.all([currentUser(), detectPlace()]);
  const home = place.country ?? user?.profile.country;
  const submitted = "q" in sp || "city" in sp || "diet" in sp || "avoid" in sp;

  // First visit: lean on the signed-in profile (and where you appear to be). After that, whatever the form says wins.
  const diets = (submitted ? many(sp.diet) : user?.profile.diets ?? []).filter((d): d is Diet => DIETS.some((x) => x.id === d));
  const avoid = (submitted ? many(sp.avoid) : (user?.profile.allergies ?? []).map((a) => a.toLowerCase())).filter((a) => (ALLERGENS as readonly string[]).includes(a));
  const city = (submitted ? sp.city : place.city ?? user?.profile.city ?? "")?.trim() ?? "";
  const citySlug = city ? slugify(city) : undefined;
  const q = sp.q?.trim() || undefined;
  // First visit with no city known: stay in the visitor's country (Zood widens by itself if nothing is cooking there).
  const scopeCountry = !submitted && !city ? place.country : undefined;
  const where = city || (scopeCountry ? regionName(scopeCountry) : "");
  const usingProfile = !submitted && Boolean(user && (diets.length || avoid.length));

  const store = getStore();
  const scope = { citySlug, country: scopeCountry };
  let [dishes, places] = await Promise.all([
    store.searchDishes({ q, diets, avoid, ...scope, limit: 24 }),
    store.searchRestaurants({ q, diet: diets, ...scope, limit: 12 }),
  ]);
  let widened = false;
  // Only widen when there is truly nothing local: a city with restaurants (menus coming) is not "empty".
  if (!dishes.length && !places.length && (citySlug || scopeCountry)) {
    [dishes, places] = await Promise.all([store.searchDishes({ q, diets, avoid, limit: 24 }), store.searchRestaurants({ q, diet: diets, limit: 12 })]);
    widened = dishes.length + places.length > 0;
  }
  const shown = new Set(dishes.map((d) => d.restaurantId));
  const restaurants = places.filter((r) => !shown.has(r.id));
  const [cities, unlisted, wantReqs] = await Promise.all([
    store.listCities({ includeUnlisted: true }),
    store.searchRestaurants({ q, diet: diets, ...(widened ? {} : scope), includeUnlisted: true, limit: 36 }),
    store.listRequests({ kind: "restaurant", ...(citySlug && !widened ? { citySlug } : {}), limit: 300 }),
  ]);
  const cityInfo = citySlug ? cities.find((c) => c.citySlug === citySlug) : undefined;
  const listedIds = new Set([...dishes.map((d) => d.restaurantId), ...places.map((r) => r.id)]);
  const wanted = unlisted.filter((r) => r.status === "unclaimed" && !listedIds.has(r.id)).slice(0, 9);
  const mine = user ? await store.supportedBy(user.uid, wanted.map(wantedKey)) : new Set<string>();
  const returnTo = `/?${new URLSearchParams({ ...(q ? { q } : {}), ...(city ? { city } : {}) }).toString()}#wanted`;
  const searching = Boolean(q || diets.length || avoid.length);

  return (
    <div className="theme-zood">
      <PinStrip />

      <section className="bighero zood heroed">
        <div className="mosaic" aria-hidden>
          {Array.from({ length: 12 }, (_, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={`/img/mosaic/${String(i + 1).padStart(2, "0")}.jpg`} alt="" width={400} height={400} loading={i < 6 ? "eager" : "lazy"} />
          ))}
        </div>
        <div className="herotext">
          <span className="kicker">The Pinterest of restaurants</span>
          <h1>Every dish. Every corner of the world. Straight from the kitchen.</h1>
          <p>Pin your craving, find the restaurant, and message them directly. No middleman, no hidden markups.</p>
          <form className="search" action="/" method="get">
            <div className="row">
              <input type="text" name="q" placeholder="pizza, egusi, chai, spicy noodles…" defaultValue={q} aria-label="What are you craving?" />
              <CityInput id="zood-cities" cities={cities} defaultValue={city} noun="restaurants" />
              <button type="submit" className="light">Zood it</button>
            </div>
            <div className="chips" role="group" aria-label="I eat">
              {DIETS.map((d) => <label key={d.id}><input type="checkbox" name="diet" value={d.id} defaultChecked={diets.includes(d.id)} /><span>{d.label}</span></label>)}
            </div>
            <div className="chips" role="group" aria-label="Skip dishes with">
              <span className="meta" style={{ alignSelf: "center" }}>Skip anything with</span>
              {ALLERGENS.map((a) => <label key={a}><input type="checkbox" name="avoid" value={a} defaultChecked={avoid.includes(a)} /><span>{a}</span></label>)}
            </div>
          </form>
        </div>
      </section>

      {isDemo() && <div className="notice">Running on demo data. Set <code>FIREBASE_SERVICE_ACCOUNT</code> to use the live database.</div>}
      {usingProfile && <p className="meta">Using your saved diet and allergies. Change them anytime on <Link href="/account">your account</Link>.</p>}
      <p className="meta">Allergen tags are whatever the restaurant told us. <b>"No allergens listed" is not "allergen-free"</b>, so with a serious allergy, always ask the restaurant first.</p>

      {sp.pledged && <div className="notice pledge">🤝 Pledged! Thank you. Pledge for more, and tell a friend nearby.</div>}
      {sp.pledge === "away" && <div className="notice pledge">Pledges are for restaurants where you are. Search your own city to pledge for the ones you'd order from.</div>}
      {citySlug && !cityInfo && (
        <div className="notice pledge">
          <b>We don't have any restaurants in {city} yet.</b> Be the one who changes that: add a restaurant you love there and it gets a public pledge page.{" "}
          <Link className="btn sm" href={`/requests/new?city=${encodeURIComponent(city)}`}>➕ Add a restaurant in {city}</Link>
        </div>
      )}
      {citySlug && cityInfo && (
        <div className="notice pledge">
          <b>{cityInfo.count} restaurant{cityInfo.count === 1 ? "" : "s"} in {cityInfo.city} {cityInfo.count === 1 ? "isn't" : "aren't"} on Zood yet.</b> {home && home !== cityInfo.country
            ? <>Pledges come from people who live there, so if you know someone in {cityInfo.city}, send them this page. <Link className="btn sm" href="#wanted">See them</Link></>
            : <>Pledge to order from the ones you want and we'll invite them to join. <Link className="btn sm" href="#wanted">🤝 See them &amp; pledge</Link></>}
        </div>
      )}
      {widened && <div className="notice">Zood hasn't landed in <b>{where}</b> yet 🛬 Here's what's cooking elsewhere. <Link href="/requests/new">Zummon a place in {where}</Link> and be the reason it does.</div>}

      {dishes.length > 0 && (
        <>
          <h2>{searching ? `${dishes.length} dish${dishes.length === 1 ? "" : "es"} to zood` : where && !widened ? `Cooking in ${where}` : "Cooking around the world"}</h2>
          <div className="grid">{dishes.map((d) => <DishCard key={`${d.restaurantId}/${d.item.id}`} h={d} />)}</div>
        </>
      )}
      {!dishes.length && !restaurants.length && (
        <>
          <h2>No menus here yet 🥲</h2>
          <p className="meta">No restaurant{where ? ` in ${where}` : ""} has put a menu on Zood yet. That's the part you can change: sign for the ones you want below, or <Link href="/requests/new">add one that's missing</Link>. Run a restaurant? <Link href="/list">Put it on Zood</Link> with a free trial.</p>
        </>
      )}
      {!dishes.length && restaurants.length > 0 && searching && <p className="meta">No menu has that dish yet, but these places might.</p>}

      {restaurants.length > 0 && (
        <>
          <h2>{searching ? "Restaurants that suit you" : where && !widened ? `Restaurants in ${where}` : "Restaurants around the world"}</h2>
          <div className="grid">{restaurants.map((r) => <RestaurantCard key={r.id} r={r} />)}</div>
        </>
      )}

      <WantedBoard places={wanted} requests={wantReqs} mine={mine} returnTo={returnTo} where={where} home={home} />

      <section className="mission">
        <h2>We're building the Pinterest of restaurants. Help us.</h2>
        <p className="lead">
          Zood was started by a foodie who got tired of scrolling, and of delivery apps squeezing the profits out of beloved restaurants.
          We want an open world where you connect with restaurants directly, with no hidden markups, and they bring the food to you in a way that's sustainable, because their delivery people aren't just gig workers.
          For that, restaurants need to be here. You can make that happen.
        </p>
        <div className="steps">
          <div className="step"><span className="n">1</span><b>Find a restaurant near you</b>We've already mapped thousands of them from public data.</div>
          <div className="step"><span className="n">2</span><b>Pledge to order</b>Your pledge tells them people want to find them on Zood.</div>
          <div className="step"><span className="n">3</span><b>They join, you order</b>Restaurants get a free trial to put up their menu. You message them directly.</div>
        </div>
        <div className="ctas">
          <Link className="btn" href="#wanted">🤝 Pledge for a restaurant</Link>
          <Link className="btn ghost" href="/requests/new">➕ Add one that's missing</Link>
          <Link className="btn ghost" href="/list">🏪 I own a restaurant</Link>
        </div>
      </section>

      {cities.length > 0 && (
        <>
          <h2>Where Zood has landed</h2>
          <div className="cities">
            {cities.map((c) => <Link key={`${c.country}/${c.citySlug}`} href={`/?city=${encodeURIComponent(c.city)}`}>{c.city}, {regionName(c.country)} ({c.count})</Link>)}
          </div>
        </>
      )}
      <p className="meta" style={{ margin: "20px 0 48px" }}>Shopping instead? <Link href="/find">Zind it</Link>. Missing a place? <Link href="/requests/new">Zummon it</Link>.</p>
    </div>
  );
}
