"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/nav";

export type LoginState = {
  step: "email" | "code";
  email: string;
  name: string;
  next: string;
  error?: string;
  notice?: string;
};

function friendly(message: string, status?: number) {
  const m = message.toLowerCase();
  if (status === 429 || m.includes("rate limit") || m.includes("too many") || m.includes("after") && m.includes("second"))
    return "Please wait a minute before asking for another code.";
  if (m.includes("not authorized") || m.includes("not allowed") || m.includes("sending") && m.includes("email"))
    return "We couldn't send an email to that address yet. If this keeps happening, please contact your community admin.";
  if (m.includes("invalid") && m.includes("email")) return "That email address doesn't look right. Please check it and try again.";
  if (m.includes("expired") || m.includes("invalid") && m.includes("token")) return "That code is wrong or has expired. Check the latest email, or ask for a new code.";
  // Anything else is a technical error; don't show raw text (e.g. JSON parse errors) to residents.
  console.error("[login] unexpected auth error:", message);
  return "Something went wrong on our side. Please try again in a moment.";
}

/** Step 1: email the 6-digit code. */
async function sendCode(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const next = safeNext(String(formData.get("next") ?? ""));
  const base = { email, name, next };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { ...base, step: "email", error: "Enter a valid email address." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { data: name ? { full_name: name } : undefined },
  });
  if (error) return { ...base, step: formData.get("resend") === "1" ? "code" : "email", error: friendly(error.message, error.status) };
  return { ...base, step: "code", notice: `We sent a 6-digit code to ${email}. It can take a minute — check spam or promotions too.` };
}

/** Step 2: check the code and sign in. */
async function verifyCode(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const next = safeNext(String(formData.get("next") ?? ""));
  const token = String(formData.get("token") ?? "").replace(/\s+/g, "");
  const base = { email, name, next, step: "code" as const };
  if (!/^\d{6,8}$/.test(token)) return { ...base, error: "Enter the 6-digit code from the email." };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) return { ...base, error: friendly(error.message, error.status) };
  redirect(next);
}

/** One entry point so the page keeps a single piece of state: intent=verify checks the code, anything else sends one. */
export async function loginAction(prev: LoginState, formData: FormData): Promise<LoginState> {
  return formData.get("intent") === "verify" ? verifyCode(prev, formData) : sendCode(prev, formData);
}
