import { headers } from "next/headers";
import { notFound } from "next/navigation";

/**
 * Defence in depth for /admin. proxy.ts shows the browser login prompt; this re-checks the same
 * credentials where the data is read or written, so admin stays closed even if a host doesn't run proxy.ts.
 * Fails closed in production when ADMIN_PASSWORD is not set.
 */
export async function requireAdmin(): Promise<void> {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    if (process.env.NODE_ENV === "production") notFound();
    return;
  }
  const header = (await headers()).get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    const [user, ...rest] = atob(header.slice(6)).split(":");
    if (user === "admin" && rest.join(":") === password) return;
  }
  notFound();
}
