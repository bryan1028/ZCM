"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkListing } from "@/lib/sell-validate";
import { getUser } from "@/lib/auth";

export type SellState = { error?: string; field?: string; values: Record<string, string> };

const KEYS = ["account_type", "display_name", "business_name", "whatsapp", "kind", "category_service", "category_product", "title", "description", "price_unit", "price", "stock"];

// Every problem comes back as { error, field } together with what the person typed, so nothing is ever lost or silent.
export async function saveListing(_prev: SellState, formData: FormData): Promise<SellState> {
  const values: Record<string, string> = {};
  for (const k of KEYS) values[k] = String(formData.get(k) ?? "");
  const fail = (error: string, field?: string): SellState => ({ error, field, values });

  const slug = String(formData.get("slug"));
  const supabase = await createClient();
  const { data: { user } } = await getUser(supabase);
  if (!user) redirect("/login");
  const { data: community } = await supabase.from("communities").select("id").eq("slug", slug).single();
  if (!community) redirect("/");

  // Photos/videos were already uploaded straight from the browser into this person's own folder; accept only those paths.
  const own = `${community.id}/${user.id}/`;
  const parse = (key: string): string[] => {
    try { const v = JSON.parse(String(formData.get(key) ?? "[]")); return Array.isArray(v) ? v.filter((p) => typeof p === "string" && p.startsWith(own) && !p.includes("..")).slice(0, 10) : []; } catch { return []; }
  };
  const photoPaths = parse("photo_paths"), videoPaths = parse("video_paths");

  // First time selling here → we also need the seller profile, so find out before validating.
  let { data: seller } = await supabase.from("sellers").select("id").eq("community_id", community.id).eq("user_id", user.id).maybeSingle();
  const check = checkListing(values, !!seller);
  if (!check.ok) return fail(check.error, check.field);

  if (!seller) {
    const accountType = values.account_type === "business" ? "business" : "individual";
    const displayName = values.display_name.trim();
    const businessName = values.business_name.trim();
    const { data, error } = await supabase.from("sellers").insert({
      community_id: community.id, user_id: user.id, account_type: accountType,
      display_name: displayName,
      business_name: accountType === "business" ? businessName : null,
      whatsapp: values.whatsapp.trim() || null,
    }).select("id").single();
    if (error) return fail(`Couldn't save your seller profile: ${error.message}`);
    seller = data;
  }

  const { data: created, error } = await supabase.from("listings").insert({
    seller_id: seller!.id,
    kind: check.kind,
    category: check.category,
    title: check.title,
    description: values.description.trim() || null,
    price_cents: check.priceCents,
    price_unit: check.priceUnit,
    stock: check.stock,
    image_urls: photoPaths,
    video_urls: videoPaths,
  }).select("id").single();
  if (error) return fail(`Couldn't publish: ${error.message}`);
  // with photos already attached, go straight to the listing; otherwise offer the photo screen
  redirect(photoPaths.length || videoPaths.length ? `/c/${slug}/l/${created!.id}` : `/c/${slug}/l/${created!.id}/edit?new=1`);
}
