"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { adminAuth } from "@/lib/firebase-admin";
import { endSession, passwordSignIn, requireUser, safeNext, sendPasswordReset, startSession } from "@/lib/session";
import { getStore, isDemo } from "@/lib/store";
import { DIETS, type Diet } from "@/lib/types";

const clean = (v: FormDataEntryValue | null, max = 200) => String(v ?? "").trim().slice(0, max);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const USERNAME = /^[a-z0-9_]{3,20}$/;
const RESERVED = new Set(["admin", "administrator", "zist", "support", "help", "root", "system", "moderator", "staff", "official", "null", "undefined", "api"]);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function dietsFrom(fd: FormData): Diet[] {
  return fd.getAll("diet").map(String).filter((d): d is Diet => DIETS.some((x) => x.id === d));
}
const allergiesFrom = (fd: FormData) =>
  clean(fd.get("allergies"), 200).split(/[,;\n]/).map((a) => a.trim().toLowerCase()).filter(Boolean).slice(0, 15);

export async function signUp(formData: FormData) {
  const next = safeNext(formData.get("next"));
  const back = (error: string) => redirect(`/signup?error=${error}&next=${encodeURIComponent(next)}`);
  if (clean(formData.get("website"))) redirect("/"); // honeypot
  if (isDemo()) back("unavailable");

  const username = clean(formData.get("username"), 30).toLowerCase();
  const email = clean(formData.get("email"), 120).toLowerCase();
  const password = String(formData.get("password") ?? "");
  const country = clean(formData.get("country"), 2).toUpperCase();
  if (!USERNAME.test(username) || RESERVED.has(username)) back("username");
  if (!EMAIL.test(email)) back("email");
  if (password.length < 8 || password.length > 128) back("password");

  const store = getStore();
  if (await store.findEmailByUsername(username)) back("taken");

  let uid = "";
  try {
    uid = (await adminAuth().createUser({ email, password, displayName: username })).uid;
  } catch (e) {
    back((e as { code?: string }).code === "auth/email-already-exists" ? "exists" : "failed");
  }
  if (!(await store.claimUsername(username, uid, email))) {
    await adminAuth().deleteUser(uid); // lost a race for the username
    back("taken");
  }
  await store.saveProfile(uid, {
    username, email, diets: dietsFrom(formData), allergies: allergiesFrom(formData),
    city: clean(formData.get("city"), 80) || undefined, country: /^[A-Z]{2}$/.test(country) ? country : undefined,
    optIn: formData.get("optIn") === "on",
  });

  const signed = await passwordSignIn(email, password);
  if ("error" in signed) redirect("/login?error=failed");
  await startSession(signed.idToken);
  redirect(next);
}

export async function logIn(formData: FormData) {
  const next = safeNext(formData.get("next"));
  const fail = (error: string) => redirect(`/login?error=${error}&next=${encodeURIComponent(next)}`);
  if (isDemo()) fail("unavailable");

  const id = clean(formData.get("identifier"), 120).toLowerCase();
  const password = String(formData.get("password") ?? "");
  const email = id.includes("@") ? id : await getStore().findEmailByUsername(id);
  if (!email || !password) { await wait(600); fail("creds"); }

  const res = await passwordSignIn(email!, password);
  if ("error" in res) {
    await wait(600); // slow down guessing; Firebase also rate-limits
    fail(res.error.startsWith("TOO_MANY_ATTEMPTS") ? "toomany" : "creds"); // same message for unknown user and wrong password
  } else {
    await startSession(res.idToken);
  }
  redirect(next);
}

export async function logOut() {
  await endSession();
  redirect("/");
}

export async function requestReset(formData: FormData) {
  const email = clean(formData.get("email"), 120).toLowerCase();
  if (EMAIL.test(email) && !isDemo()) await sendPasswordReset(email);
  redirect("/reset?sent=1"); // same answer whether or not the account exists
}

export async function saveAccount(formData: FormData) {
  const user = await requireUser("/account");
  const country = clean(formData.get("country"), 2).toUpperCase();
  const store = getStore();
  const wanted = clean(formData.get("username"), 30).toLowerCase();
  if (!user.profile.username && wanted) {
    // Accounts created on the old site may have no public signature yet.
    if (!USERNAME.test(wanted) || RESERVED.has(wanted) || !(await store.claimUsername(wanted, user.uid, user.email))) redirect("/account?error=username");
    await store.saveProfile(user.uid, { username: wanted });
  }
  await store.saveProfile(user.uid, {
    diets: dietsFrom(formData), allergies: allergiesFrom(formData),
    city: clean(formData.get("city"), 80) || undefined, country: /^[A-Z]{2}$/.test(country) ? country : undefined,
    optIn: formData.get("optIn") === "on",
  });
  revalidatePath("/account");
  redirect("/account?saved=1");
}
