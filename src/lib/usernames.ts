import type { SupabaseClient } from "@supabase/supabase-js";

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

/** user id → username, for people in the viewer's community. Backed by zcm.usernames_for(), which checks membership. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function usernamesFor(supabase: SupabaseClient<any, any, any>, communityId: string, ids: string[]) {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map<string, string>();
  const { data } = await supabase.rpc("usernames_for", { cid: communityId, ids: unique });
  return new Map(((data ?? []) as { user_id: string; username: string }[]).map((r) => [r.user_id, r.username]));
}
