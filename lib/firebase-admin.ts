import { cert, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

/** Accepts the service-account JSON either as raw JSON or base64-encoded (some env-var forms reject "{" and quotes). */
export function parseServiceAccount(raw: string): object {
  const v = raw.trim();
  return JSON.parse(v.startsWith("{") ? v : Buffer.from(v, "base64").toString("utf8"));
}

function ensureApp() {
  if (!getApps().length) {
    initializeApp({ credential: cert(parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT as string) as ServiceAccount) });
  }
}

export function adminDb() {
  ensureApp();
  const db = getFirestore();
  // Optional fields are `undefined` when absent; Firestore rejects those unless told to drop them.
  try { db.settings({ ignoreUndefinedProperties: true }); } catch { /* already configured (dev hot reload) */ }
  return db;
}

export function adminAuth() {
  ensureApp();
  return getAuth();
}
