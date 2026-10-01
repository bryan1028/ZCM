import Link from "next/link";
import { currentUser } from "@/lib/session";
import { detectPlace } from "@/lib/geo";
import { ALLERGENS } from "@/lib/dishes";
import { getStore, isDemo } from "@/lib/store";
import { DIETS, type Diet } from "@/lib/types";
import { regionName, slugify } from "@/lib/util";
import { ZoodMark } from "./brand";
import { DishCard, RestaurantCard } from "./components";

export const dynamic = "force-dynamic";

type SP = Promise<{ q?: string; city?: string; diet?: string | string[]; avoid?: string | string[] }>;
const many = (v?: string | string[]) => ([] as string[]).concat(v ?? []);

export default async function Zood({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const [user, place] = await Promise.all([currentUser(), detectPlace()]);
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
  let dishes = await store.searchDishes({ q, diets, avoid, citySlug, country: scopeCountry, limit: 24 });
  let widened = false;
  if (!dishes.length && (citySlug || scopeCountry)) { dishes = await store.searchDishes({ q, diets, avoid, limit: 24 }); widened = dishes.length > 0; }

  const shown = new Set(dishes.map((d) => d.restaurantId));
  const restaurants = q || diets.length
    ? (await store.searchRestaurants({ q, diet: diets, citySlug: widened ? undefined : citySlug, country: widened ? undefined : scopeCountry, limit: 9 })).filter((r) => !shown.has(r.id))
    : [];
  const cities = await store.listCities();
  const searching = Boolean(q || diets.length || avoid.length);

  return (
    <div className="theme-zood">
      <section className="hero brandhero">
        <ZoodMark size={72} />
        <div>
          <h1>Hungry? Zood it.</h1>
          <p>Tell Zood what you're craving. It finds the dish, minds your diet, and slides into the restaurant's WhatsApp for you.</p>
        </div>
      </section>

      <form className="search" action="/" method="get">
        <div className="row">
          <input type="text" name="q" placeholder="spicy noodles, vegan tacos, something with paneer…" defaultValue={q} aria-label="What are you craving?" />
          <input type="text" name="city" placeholder="Where? any city on Earth" defaultValue={city} aria-label="City" />
          <button type="submit">Zood it</button>
        </div>
        <div className="chips" role="group" aria-label="I eat">
          {DIETS.map((d) => <label key={d.id}><input type="checkbox" name="diet" value={d.id} defaultChecked={diets.includes(d.id)} /><span>{d.label}</span></label>)}
        </div>
        <div className="chips" role="group" aria-label="Skip dishes with">
          <span className="meta" style={{ alignSelf: "center" }}>Skip anything with</span>
          {ALLERGENS.map((a) => <label key={a}><input type="checkbox" name="avoid" value={a} defaultChecked={avoid.includes(a)} /><span>{a}</span></label>)}
        </div>
      </form>

      {isDemo() && <div className="notice">Running on demo data. Set <code>FIREBASE_SERVICE_ACCOUNT</code> to use the live database.</div>}
      {usingProfile && <p className="meta">Using your saved diet and allergies. Change them anytime on <Link href="/account">your account</Link>.</p>}
      <p className="meta">Allergen tags are whatever the restaurant told us. <b>"No allergens listed" is not "allergen-free"</b>, so with a serious allergy, always ask the restaurant first.</p>

      {widened && <div className="notice">Zood hasn't landed in <b>{where}</b> yet 🛬 Here's what's cooking elsewhere. <Link href="/requests/new">Zummon a place in {where}</Link> and be the reason it does.</div>}

      <h2>{dishes.length ? (searching ? `${dishes.length} dish${dishes.length === 1 ? "" : "es"} to zood` : where && !widened ? `Cooking in ${where}` : "Cooking around the world") : "Zood came back empty-handed 🥲"}</h2>
      {!dishes.length && (
        <p className="meta">Nobody's cooking that here yet{where ? ` in ${where}` : ""}. Try a broader craving, or <Link href="/requests/new">zummon the restaurant that should be</Link>.</p>
      )}
      <div className="grid">{dishes.map((d) => <DishCard key={`${d.restaurantId}/${d.item.id}`} h={d} />)}</div>

      {restaurants.length > 0 && (
        <>
          <h2>Restaurants that suit you</h2>
          <p className="meta">No menu to show yet, but they match what you asked for.</p>
          <div className="grid">{restaurants.map((r) => <RestaurantCard key={r.id} r={r} />)}</div>
        </>
      )}

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
