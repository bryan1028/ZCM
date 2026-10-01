import { slugify } from "./util";

/** Same key the zummon form uses, so signing a listed restaurant and zummoning it by name land on one request. */
export const wantedKey = (r: { country: string; citySlug: string; name: string }) =>
  `restaurant-${r.country.toLowerCase()}-${r.citySlug}-${slugify(r.name)}`.slice(0, 140);
