"use client";

import { useState } from "react";

/** WhatsApp / X links work without JavaScript; copy and the phone's share sheet are added when available. */
export function ShareBar({ url, text, title = "Share" }: { url: string; text: string; title?: string }) {
  const [copied, setCopied] = useState(false);
  const full = `${text} ${url}`;
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  return (
    <div className="sharebar">
      <b>{title}</b>
      <a className="btn wa sm" href={`https://wa.me/?text=${encodeURIComponent(full)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
      <a className="btn ghost sm" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">X</a>
      <a className="btn ghost sm" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">Facebook</a>
      <button type="button" className="btn ghost sm" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ } }}>{copied ? "Copied ✓" : "Copy link"}</button>
      {canShare && <button type="button" className="btn ghost sm" onClick={() => navigator.share({ title: "Zood", text, url }).catch(() => {})}>More…</button>}
    </div>
  );
}
