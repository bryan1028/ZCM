"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getStore } from "@/lib/store";
import { requireAdmin } from "@/lib/auth";
import { requireUser } from "@/lib/session";
import { parseMenuText, currencyFor } from "@/lib/menu-text";
import { normalizeWhatsapp, slugify } from "@/lib/util";

const clean = (v: FormDataEntryValue | null, max = 200) => String(v ?? "").trim().slice(0, max);
const TRIAL_DAYS = 90;

/** A signed-in person says "this is my restaurant" and gives us something we can check. An admin verifies before anything changes. */
export async function submitClaim(formData: FormData) {
  const claimId = clean(formData.get("claimId"), 120) || undefined;
  const back = (e: string) => redirect(`/list?error=${e}${claimId ? `&claim=${encodeURIComponent(claimId)}` : ""}`);
  const user = await requireUser(claimId ? `/list?claim=${claimId}` : "/list");
  if (clean(formData.get("website"))) redirect("/account/restaurant"); // honeypot

  const store = getStore();
  const existing = claimId ? await store.getRestaurant(claimId) : null;
  if (claimId && !existing) back("1");
  if (existing && existing.status !== "unclaimed") back("taken");

  const name = existing?.name ?? clean(formData.get("name"));
  const city = existing?.city ?? clean(formData.get("city"), 80);
  const country = existing?.country ?? clean(formData.get("country"), 2).toUpperCase();
  const contactName = clean(formData.get("contactName"), 80);
  const whatsapp = normalizeWhatsapp(clean(formData.get("whatsapp"), 30));
  const email = clean(formData.get("email"), 120);
  const role = clean(formData.get("role"), 40);
  const proof = clean(formData.get("proof"), 500);
  if (!name || !city || !/^[A-Z]{2}$/.test(country) || !contactName || !whatsapp || !/^\S+@\S+\.\S+$/.test(email) || !role || proof.length < 5) back("1");

  const pending = (await store.listClaimsByUser(user.uid)).find((c) => c.restaurantId === claimId && claimId && (c.status === "new" || c.status === "verifying"));
  if (pending) redirect("/account/restaurant?sent=1");

  let restaurantId = existing?.id;
  if (!restaurantId) {
    restaurantId = await store.createRestaurant({
      name, country, city, citySlug: slugify(city), whatsapp: whatsapp!, cuisines: [], diets: [], menu: [],
      status: "pending", source: "owner", plan: "trial", leadCount: 0, createdAt: new Date().toISOString(),
    });
  }
  const id = await store.addClaim({
    restaurantId, restaurantName: name, country, city, contactName, whatsapp: whatsapp!, email, status: "new",
    userId: user.uid, userHandle: user.handle, role, proof, createdAt: new Date().toISOString(),
  });
  await store.addClaimMessage({ claimId: id, fromAdmin: false, body: `Claim submitted by ${contactName} (${role}). Proof: ${proof}` });
  redirect("/account/restaurant?sent=1");
}

/** The claimant writes to the Zist team about their claim. */
export async function claimReplyOwner(formData: FormData) {
  const user = await requireUser("/account/restaurant");
  const store = getStore();
  const claim = await store.getClaim(clean(formData.get("claimId"), 120));
  const body = clean(formData.get("body"), 2000);
  if (!claim || claim.userId !== user.uid || !body) redirect("/account/restaurant");
  await store.addClaimMessage({ claimId: claim!.id!, fromAdmin: false, body });
  revalidatePath("/account/restaurant");
  redirect("/account/restaurant?sent=2");
}

/** Owner of an approved restaurant edits its profile and menu. */
export async function saveMyRestaurant(formData: FormData) {
  const user = await requireUser("/account/restaurant");
  const store = getStore();
  const id = clean(formData.get("id"), 120);
  const r = (await store.listMyRestaurants(user.uid)).find((x) => x.id === id);
  if (!r) redirect("/account/restaurant");
  const outcome = await applyRestaurantEdit(r!.id, r!.country, formData);
  revalidatePath(`/r/${r!.id}`);
  redirect(`/account/restaurant?saved=${outcome}`);
}

async function applyRestaurantEdit(id: string, country: string, formData: FormData): Promise<string> {
  const store = getStore();
  const wa = clean(formData.get("whatsapp"), 30);
  const phone = clean(formData.get("phone"), 30);
  const site = clean(formData.get("site"), 200);
  await store.updateRestaurantProfile(id, {
    name: clean(formData.get("name"), 100) || undefined,
    whatsapp: wa ? normalizeWhatsapp(wa) : null,
    phone: phone ? normalizeWhatsapp(phone) : null,
    website: /^https?:\/\//i.test(site) ? site : null,
    address: clean(formData.get("address"), 200) || null,
    cuisines: clean(formData.get("cuisines"), 200).split(",").map((c) => c.trim().toLowerCase()).filter(Boolean).slice(0, 8),
  });
  const { items, errors } = parseMenuText(clean(formData.get("menu"), 20000), clean(formData.get("currency"), 3) || currencyFor(country));
  if (errors.length) return `menu-${encodeURIComponent(errors[0]).slice(0, 120)}`;
  await store.setMenu(id, items);
  return "1";
}

// ───────────── Admin ─────────────

export async function adminClaimAction(formData: FormData) {
  await requireAdmin();
  const store = getStore();
  const id = clean(formData.get("claimId"), 120);
  const op = clean(formData.get("op"), 20);
  const body = clean(formData.get("body"), 2000);
  const claim = await store.getClaim(id);
  if (!claim) redirect("/admin#claims");
  if (body) await store.addClaimMessage({ claimId: id, fromAdmin: true, body });
  if (op === "verifying") await store.updateClaim(id, { status: "verifying" });
  if (op === "reject") await store.updateClaim(id, { status: "rejected" });
  if (op === "approve") {
    if (!claim!.restaurantId || !claim!.userId) redirect("/admin?error=claim#claims");
    await store.approveClaim(id, TRIAL_DAYS);
    await store.addClaimMessage({ claimId: id, fromAdmin: true, body: `Approved! Your ${TRIAL_DAYS}-day free trial has started. Open "Your restaurant" in your account to edit your profile and menu.` });
  }
  const note = clean(formData.get("note"), 500);
  if (note) await store.updateClaim(id, { adminNote: note });
  revalidatePath("/admin");
  redirect("/admin#claims");
}

/** Admin pastes or fixes a menu for a restaurant (e.g. one the owner sent over in the claim thread). */
export async function adminSaveMenu(formData: FormData) {
  await requireAdmin();
  const id = clean(formData.get("id"), 120);
  const r = await getStore().getRestaurant(id);
  if (!r) redirect("/admin");
  await applyRestaurantEdit(r!.id, r!.country, formData);
  revalidatePath(`/r/${r!.id}`);
  redirect(`/admin/restaurant/${encodeURIComponent(id)}?saved=1`);
}
