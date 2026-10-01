import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth } from "./firebase-admin";
import { getStore } from "./store";
import type { SessionUser } from "./types";

export const SESSION_COOKIE = "zs";
const SESSION_DAYS = 14;
const WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY ?? "AIzaSyC4RiQeEKEMuRVpVGmUpWqbmsZitzPHcNs"; // public web key (not a secret)

/** Same-site relative paths only, so a crafted ?next= can't send people to another site. */
export function safeNext(v: unknown, fallback = "/account"): string {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.includes("\\") ? s : fallback;
}

/** The signed-in user for this request, or null. Cached per request. */
export const currentUser = cache(async (): Promise<SessionUser | null> => {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return null;
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!cookie) return null;
  try {
    const decoded = await adminAuth().verifySessionCookie(cookie);
    const store = getStore();
    let profile = await store.getProfile(decoded.uid);
    if (!profile) {
      // Signed in with Firebase but no profile row (accounts made before the move to Postgres): create a blank one.
      // They pick a public username on their account page.
      await store.saveProfile(decoded.uid, { email: decoded.email ?? "", diets: [], allergies: [], optIn: false });
      profile = await store.getProfile(decoded.uid);
      if (!profile) return null;
    }
    const handle = profile.username || `user${decoded.uid.slice(0, 6).toLowerCase()}`;
    return { uid: decoded.uid, handle, email: profile.email || decoded.email || "", profile };
  } catch {
    return null; // expired, revoked or malformed cookie
  }
});

export async function requireUser(next: string): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) redirect(`/login?next=${encodeURIComponent(safeNext(next, "/"))}`);
  return u;
}

export async function startSession(idToken: string): Promise<void> {
  const value = await adminAuth().createSessionCookie(idToken, { expiresIn: SESSION_DAYS * 864e5 });
  (await cookies()).set(SESSION_COOKIE, value, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: SESSION_DAYS * 86400, path: "/",
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Server-side email+password check against Firebase. The password never reaches the browser or our logs. */
export async function passwordSignIn(email: string, password: string): Promise<{ idToken: string } | { error: string }> {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${WEB_API_KEY}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const body = (await res.json()) as { idToken?: string; error?: { message?: string } };
  return body.idToken ? { idToken: body.idToken } : { error: body.error?.message ?? "UNKNOWN" };
}

export async function sendPasswordReset(email: string): Promise<void> {
  await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${WEB_API_KEY}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestType: "PASSWORD_RESET", email }),
  });
}

/** Live check (not the 14-day session cookie), so clicking the email link takes effect without signing in again. */
export async function isEmailVerified(uid: string): Promise<boolean> {
  try { return (await adminAuth().getUser(uid)).emailVerified === true; } catch { return false; }
}

/** Signed in AND email verified; otherwise sent to /verify. Used before pledging, zummoning and claiming, so bots can't spam them. */
export async function requireVerified(next: string): Promise<SessionUser> {
  const u = await requireUser(next);
  if (!(await isEmailVerified(u.uid))) redirect(`/verify?next=${encodeURIComponent(safeNext(next, "/"))}`);
  return u;
}

/** Firebase emails the person a verification link (its standard template). Works from just a user id, no password needed. */
export async function sendVerificationEmail(uid: string): Promise<boolean> {
  try {
    const custom = await adminAuth().createCustomToken(uid);
    const signed = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${WEB_API_KEY}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: custom, returnSecureToken: true }),
    });
    const { idToken } = (await signed.json()) as { idToken?: string };
    if (!idToken) return false;
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${WEB_API_KEY}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestType: "VERIFY_EMAIL", idToken }),
    });
    return res.ok;
  } catch { return false; }
}
