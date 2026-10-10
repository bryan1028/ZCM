import type { SupabaseClient } from "@supabase/supabase-js";

type WithAuth = { auth: Pick<SupabaseClient["auth"], "getClaims"> };

/**
 * Who is signed in, without a network round trip: the access token in the cookie is verified locally against
 * Supabase's published signing key (getClaims). `getUser()` would call the Auth server on every page and action,
 * which is slow when the app server and database are on different continents.
 *
 * Security is unchanged: every query still runs as this user and Postgres row-level security decides what they
 * can touch. A removed or suspended person loses access through the database immediately; their token itself
 * expires within the hour.
 */
export async function getUser(supabase: WithAuth): Promise<{ data: { user: { id: string; email?: string } | null } }> {
  const { data } = await supabase.auth.getClaims();
  const c = data?.claims;
  return { data: { user: c?.sub ? { id: c.sub, email: typeof c.email === "string" ? c.email : undefined } : null } };
}
