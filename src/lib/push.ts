import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { after } from "next/server";

// Sends any not-yet-pushed notifications as web pushes. The notifications themselves are created by
// database triggers, so this works no matter which action caused them. Safe no-op if push isn't configured.
export async function flushPendingPushes() {
  const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key, NEXT_PUBLIC_VAPID_PUBLIC_KEY: pub,
    VAPID_PRIVATE_KEY: priv, VAPID_SUBJECT: subject } = process.env;
  if (!url || !key || !pub || !priv || !subject) return;
  webpush.setVapidDetails(subject, pub, priv);
  const admin = createClient(url, key, { auth: { persistSession: false } });

  // claim rows first so concurrent flushes don't double-send; ignore anything older than a day
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: pending } = await admin.from("notifications").select("id").is("pushed_at", null).gte("created_at", since).limit(50);
  if (!pending?.length) return;
  const { data: claimed } = await admin.from("notifications")
    .update({ pushed_at: new Date().toISOString() }).in("id", pending.map((p) => p.id)).is("pushed_at", null)
    .select("user_id, title, body, url");
  if (!claimed?.length) return;

  const { data: subs } = await admin.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", [...new Set(claimed.map((c) => c.user_id))]);
  await Promise.all(claimed.flatMap((n) =>
    (subs ?? []).filter((s) => s.user_id === n.user_id).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: n.title, body: n.body, url: n.url }));
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
      }
    })));
}

/** Call at the end of a server action: sends pushes after the response has gone out. */
export function pushSoon() {
  after(() => flushPendingPushes().catch(() => {}));
}
