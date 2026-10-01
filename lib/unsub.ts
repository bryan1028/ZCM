import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { parseServiceAccount } from "./firebase-admin";

/** Stable secret for signing email links, derived from the service-account private key (so no new env var is needed). */
function secret(): string {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("no secret available");
  const key = (parseServiceAccount(raw) as { private_key?: string }).private_key ?? "";
  return createHash("sha256").update("zist-unsub-v1:" + key).digest("hex");
}

export function unsubToken(uid: string): string {
  return createHmac("sha256", secret()).update(uid).digest("hex").slice(0, 32);
}

export function validUnsubToken(uid: string, token: string): boolean {
  const want = unsubToken(uid);
  return token.length === want.length && timingSafeEqual(Buffer.from(token), Buffer.from(want));
}

export function unsubUrl(uid: string, site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://zist.it.com"): string {
  return `${site}/unsubscribe?u=${encodeURIComponent(uid)}&t=${unsubToken(uid)}`;
}
