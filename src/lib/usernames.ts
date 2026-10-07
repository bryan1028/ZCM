import type { SupabaseClient } from "@supabase/supabase-js";

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

/** user id → username, for people in the viewer's community (member_names only exposes that). */
export async function usernamesFor(supabase: SupabaseClient<any, any, any>, communityId: string, ids: string[]) {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map<string, string>();
  const { data } = await supabase.from("member_names").select("user_id, username")
    .eq("community_id", communityId).in("user_id", unique);
  return new Map((data ?? []).map((r) => [r.user_id as string, r.username as string]));
}
