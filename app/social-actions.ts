"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { adminAuth } from "@/lib/firebase-admin";
import { endSession, requireUser, safeNext } from "@/lib/session";
import { getStore } from "@/lib/store";
import { validUnsubToken } from "@/lib/unsub";

const clean = (v: FormDataEntryValue | null, max = 200) => String(v ?? "").trim().slice(0, max);

export async function followAction(formData: FormData) {
  const handle = clean(formData.get("handle"), 20).toLowerCase();
  const me = await requireUser(`/u/${handle}`);
  const store = getStore();
  const uid = await store.findUidByUsername(handle);
  if (uid && uid !== me.uid) {
    if (formData.get("op") === "unfollow") await store.unfollow(me.uid, uid);
    else await store.follow({ uid: me.uid, handle: me.handle }, { uid, handle });
  }
  revalidatePath(`/u/${handle}`);
  redirect(safeNext(formData.get("returnTo"), `/u/${handle}`));
}

/** Permanently deletes the account. Requires typing DELETE so it can't happen by a stray tap. */
export async function deleteAccount(formData: FormData) {
  const user = await requireUser("/account");
  if (clean(formData.get("confirm"), 10) !== "DELETE") redirect("/account?error=confirm");
  await getStore().deleteAccountData(user.uid, user.profile.username);
  await adminAuth().deleteUser(user.uid);
  await endSession();
  redirect("/?deleted=1");
}

/** One-click opt-out from the link in our emails. The signed token proves the link came from us. */
export async function unsubscribeAction(formData: FormData) {
  const uid = clean(formData.get("u"), 128), token = clean(formData.get("t"), 64);
  if (!validUnsubToken(uid, token)) redirect("/unsubscribe?error=1");
  await getStore().saveProfile(uid, { optIn: false });
  redirect("/unsubscribe?done=1");
}

export async function sendSupportMessage(formData: FormData) {
  if (clean(formData.get("website"))) redirect("/support?sent=1"); // honeypot
  const email = clean(formData.get("email"), 120), message = clean(formData.get("message"), 2000);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || message.length < 5) redirect("/support?error=1");
  const { currentUser } = await import("@/lib/session");
  const user = await currentUser();
  await getStore().addSupportMessage({ email, message, name: clean(formData.get("name"), 80) || undefined, userHandle: user?.handle, createdAt: new Date().toISOString() });
  redirect("/support?sent=1");
}
