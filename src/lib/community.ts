import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Community = { id: string; name: string; currency: string; timezone: string };

/** The current community, fetched once per request and shared by the layout and the page. */
export const getCommunity = cache(async (slug: string): Promise<Community | null> => {
  const supabase = await createClient();
  const { data } = await supabase.from("communities").select("id, name, currency, timezone").eq("slug", slug).maybeSingle();
  return data;
});
