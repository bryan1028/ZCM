"use client";
import { useState } from "react";

export default function CopyButton({ text, label = "Copy link" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="secondary sm" onClick={async () => {
      try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1800); } catch { /* clipboard blocked: user can still select the text */ }
    }}>
      {done ? "✓ Copied" : label}
    </button>
  );
}
