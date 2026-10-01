"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
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

// ───────────── Zist Find ─────────────

import { cookies } from "next/headers";
import { isOutlier, productKey, tokenize } from "@/lib/prices";

const MAX_REPORTS_PER_DAY = 20;

/** Anyone can report a shelf price. Guarded by: honeypot, sanity bounds, per-visitor daily cap, outlier flagging. */
export async function reportPrice(formData: FormData) {
  if (clean(formData.get("website"))) redirect("/find");

  const jar = await cookies();
  const used = Number(jar.get("zr")?.value ?? 0);
  const reporter = jar.get("zv")?.value ?? crypto.randomUUID();

  const productName = clean(formData.get("product"), 100);
  const brand = clean(formData.get("brand"), 60) || undefined;
  const size = clean(formData.get("size"), 30) || undefined;
  const barcode = clean(formData.get("barcode"), 14) || undefined;
  const storeName = clean(formData.get("store"), 80);
  const city = clean(formData.get("city"), 80);
  const country = clean(formData.get("country"), 2).toUpperCase();
  const currency = clean(formData.get("currency"), 3).toUpperCase();
  const price = Number(clean(formData.get("price"), 20));

  const bad = !productName || !storeName || !city || !/^[A-Z]{2}$/.test(country) || !/^[A-Z]{3}$/.test(currency)
    || !Number.isFinite(price) || price <= 0 || price > 1e7;
  if (bad) redirect("/find/report?error=1");
  if (used >= MAX_REPORTS_PER_DAY) redirect("/find/report?error=limit");

  const store = getStore();
  const key = productKey(productName, brand, size, barcode);
  const citySlug = slugify(city);
  const recent = (await store.searchPrices({ productKey: key, citySlug, limit: 50 })).filter((p) => p.currency === currency).map((p) => p.price);
  const flagged = isOutlier(price, recent);
  const now = new Date().toISOString();

  await store.addPrice({
    productKey: key, productName, brand, size, barcode, storeName, country, city, citySlug, price, currency,
    tokens: tokenize(productName, brand), source: "crowd", status: flagged ? "flagged" : "ok",
    observedAt: now, createdAt: now, reporter,
  });

  jar.set("zr", String(used + 1), { httpOnly: true, sameSite: "lax", maxAge: 86400, path: "/" });
  jar.set("zv", reporter, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365, path: "/" });
  redirect(`/find?q=${encodeURIComponent(productName)}&city=${encodeURIComponent(city)}&country=${country}&thanks=${flagged ? "review" : "1"}`);
}

/** Admin actions. These are only reachable via /admin, which proxy.ts protects with basic auth. */
export async function setPriceStatus(formData: FormData) {
  const status = clean(formData.get("status"), 10);
  if (!["ok", "flagged", "hidden"].includes(status)) return;
  await getStore().setPriceStatus(clean(formData.get("id"), 120), status as "ok" | "flagged" | "hidden");
  revalidatePath("/admin");
}

export async function addDeal(formData: FormData) {
  const title = clean(formData.get("title"), 140), storeName = clean(formData.get("store"), 80), city = clean(formData.get("city"), 80);
  const country = clean(formData.get("country"), 2).toUpperCase(), validUntil = clean(formData.get("validUntil"), 10);
  if (!title || !storeName || !city || !/^[A-Z]{2}$/.test(country) || !/^\d{4}-\d{2}-\d{2}$/.test(validUntil)) return;
  const price = Number(clean(formData.get("price"), 20)), pct = Number(clean(formData.get("discountPct"), 3));
  const url = clean(formData.get("url"), 300);
  await getStore().addDeal({
    title, storeName, country, city, citySlug: slugify(city), validUntil, status: "active", source: "admin", createdAt: new Date().toISOString(),
    description: clean(formData.get("description"), 300) || undefined,
    price: price > 0 ? price : undefined, currency: clean(formData.get("currency"), 3).toUpperCase() || undefined,
    discountPct: pct > 0 && pct < 100 ? pct : undefined, url: /^https?:\/\//.test(url) ? url : undefined,
  });
  revalidatePath("/admin");
}
