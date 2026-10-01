"use server";

import { redirect } from "next/navigation";
import { requireUser, safeNext } from "@/lib/session";
import { getStore } from "@/lib/store";
import { normalizeWhatsapp, slugify } from "@/lib/util";

const clean = (v: FormDataEntryValue | null, max = 200) => String(v ?? "").trim().slice(0, max);
const MAX_REQUESTS_PER_DAY = 10;

/** "Please add this place." Signed with the user's handle; if it already exists, the user's support is added instead. */
export async function submitRequest(formData: FormData) {
  const user = await requireUser("/requests/new");
  if (clean(formData.get("website_hp"))) redirect("/requests");

  const kind = clean(formData.get("kind"), 12) === "store" ? "store" : "restaurant";
  const name = clean(formData.get("name"), 100);
  const city = clean(formData.get("city"), 80);
  const country = clean(formData.get("country"), 2).toUpperCase();
  const citySlug = slugify(city);
  const nameSlug = slugify(name);
  if (name.length < 2 || !nameSlug || !citySlug || !/^[A-Z]{2}$/.test(country)) redirect("/requests/new?error=1");

  const store = getStore();
  const mine = await store.requestsBy(user.uid);
  if (mine.filter((r) => Date.parse(r.createdAt) > Date.now() - 864e5).length >= MAX_REQUESTS_PER_DAY) redirect("/requests/new?error=limit");

  if (kind === "restaurant") {
    // Already listed? Send them there instead of creating a duplicate request.
    const hits = await store.searchRestaurants({ country, citySlug, q: name, limit: 20 });
    const exact = hits.find((r) => slugify(r.name) === nameSlug);
    if (exact) redirect(`/r/${exact.id}`);
  }

  const website = clean(formData.get("website"), 200);
  const res = await store.upsertRequest(
    `${kind}-${country.toLowerCase()}-${citySlug}-${nameSlug}`.slice(0, 140),
    {
      kind, name, country, city, citySlug, note: clean(formData.get("note"), 300) || undefined,
      whatsapp: normalizeWhatsapp(clean(formData.get("whatsapp"), 30)), website: /^https?:\/\//i.test(website) ? website : undefined,
      createdBy: { uid: user.uid, handle: user.handle },
    },
    { uid: user.uid, handle: user.handle },
  );
  redirect(`/requests?city=${encodeURIComponent(citySlug)}&done=${res.created ? "created" : res.supported ? "supported" : "already"}`);
}

export async function supportRequestAction(formData: FormData) {
  const back = safeNext(formData.get("returnTo"), "/requests");
  const user = await requireUser(back);
  await getStore().supportRequest(clean(formData.get("id"), 160), { uid: user.uid, handle: user.handle });
  redirect(back);
}
