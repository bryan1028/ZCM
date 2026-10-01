import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const ADMIN_COOKIE = "za";

/** Session token = HMAC of a fixed label keyed by ADMIN_PASSWORD. Changing the password signs everyone out. */
export function adminToken(password: string): string {
  return createHmac("sha256", password).update("zist-admin-session-v1").digest("hex");
}

export function passwordMatches(input: string): boolean {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return false;
  const a = createHmac("sha256", "cmp").update(input).digest();
  const b = createHmac("sha256", "cmp").update(password).digest();
  return timingSafeEqual(a, b);
}

/**
 * Cookie-based admin gate, checked where admin data is read or written (page + server actions).
 * Works on any host: no dependence on middleware/proxy. Fails closed in production without ADMIN_PASSWORD.
 */
export async function requireAdmin(): Promise<void> {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    if (process.env.NODE_ENV === "production") redirect("/admin/login");
    return; // local dev convenience
  }
  const got = (await cookies()).get(ADMIN_COOKIE)?.value ?? "";
  const want = adminToken(password);
  if (got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want))) return;
  redirect("/admin/login");
}
