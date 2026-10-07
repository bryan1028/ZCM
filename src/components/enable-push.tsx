"use client";
import { useEffect, useState } from "react";

function b64ToBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export default function EnablePush({ save }: { save: (sub: { endpoint: string; p256dh: string; auth: string }) => Promise<void> }) {
  const [state, setState] = useState<"unsupported" | "off" | "on" | "denied">("off");
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (!vapid || !("serviceWorker" in navigator) || !("PushManager" in window)) return setState("unsupported");
    if (Notification.permission === "denied") return setState("denied");
    navigator.serviceWorker.getRegistration("/sw.js").then(async (reg) => {
      if (reg && (await reg.pushManager.getSubscription())) setState("on");
    });
  }, [vapid]);

  async function enable() {
    if ((await Notification.requestPermission()) !== "granted") return setState("denied");
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(vapid!) }));
    const j = sub.toJSON();
    await save({ endpoint: sub.endpoint, p256dh: j.keys!.p256dh, auth: j.keys!.auth });
    setState("on");
  }

  if (state === "unsupported") return <p className="muted">Push notifications aren&apos;t available on this device/browser. On iPhone, add the app to your Home Screen first.</p>;
  if (state === "denied") return <p className="muted">Notifications are blocked in your browser settings.</p>;
  if (state === "on") return <p className="muted">✓ Push notifications are on for this device.</p>;
  return <button onClick={enable}>Turn on push notifications</button>;
}
