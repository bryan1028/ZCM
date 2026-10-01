import type { CitySummary } from "@/lib/store";
import { regionName } from "@/lib/util";

/** Text box with a native dropdown of the cities we have. Anything else can still be typed. */
export function CityInput({ cities, defaultValue, id, noun }: { cities: CitySummary[]; defaultValue?: string; id: string; noun: string }) {
  return (
    <>
      <input type="text" name="city" list={id} placeholder="Where? pick a city or type one" defaultValue={defaultValue} aria-label="City" autoComplete="off" />
      <datalist id={id}>
        {cities.map((c) => <option key={`${c.country}/${c.citySlug}`} value={c.city} label={`${regionName(c.country)} · ${c.count} ${noun}`} />)}
      </datalist>
    </>
  );
}
