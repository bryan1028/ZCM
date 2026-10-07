/** Only allow same-site relative redirects (prevents open-redirect via ?next=). */
export function safeNext(n: string | null | undefined, fallback = "/") {
  return n && n.startsWith("/") && !n.startsWith("//") && !n.includes("\\") ? n : fallback;
}

export function siteUrl(host?: string | null) {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? (host ? `https://${host}` : "");
}
