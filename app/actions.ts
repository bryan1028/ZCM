"use server";

import { redirect } from "next/navigation";
import { getStore } from "@/lib/store";
import { normalizeWhatsapp, slugify } from "@/lib/util";
import type { Diet } from "@/lib/types";
import { DIETS } from "@/lib/types";

const clean = (v: FormDataEntryValue | null, max = 200) => String(v ?? "").trim().slice(0, max);

/** Owner claims an existing listing or submits a new one. Both land in the admin queue as `pending`. */
export async function submitListing(formData: FormData) {
  if (clean(formData.get("website"))) redirect("/list?sent=1"); // honeypot

  const whatsapp = normalizeWhatsapp(clean(formData.get("whatsapp"), 30));
  const name = clean(formData.get("name"));
  const city = clean(formData.get("city"), 80);
  const country = clean(formData.get("country"), 2).toUpperCase();
  const contactName = clean(formData.get("contactName"), 80);
  const claimId = clean(formData.get("claimId"), 120) || undefined;
  if (!name || !city || !/^[A-Z]{2}$/.test(country) || !contactName || !whatsapp) {
    redirect(`/list?error=1${claimId ? `&claim=${encodeURIComponent(claimId)}` : ""}`);
  }

  const store = getStore();
  await store.addClaim({
    restaurantId: claimId,
    restaurantName: name,
    country,
    city,
    contactName,
    whatsapp: whatsapp!,
    email: clean(formData.get("email"), 120) || undefined,
    createdAt: new Date().toISOString(),
  });

  if (!claimId) {
    const diets = formData.getAll("diet").map(String).filter((d): d is Diet => DIETS.some((x) => x.id === d));
    await store.createRestaurant({
      name, country, city, citySlug: slugify(city), whatsapp: whatsapp!, cuisines: [], diets, menu: [],
      status: "pending", source: "owner", plan: "trial", leadCount: 0, createdAt: new Date().toISOString(),
    });
  }
  redirect("/list?sent=1");
}
