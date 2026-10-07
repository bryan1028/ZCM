"use client";
import { useRef, useState } from "react";

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/**
 * A file input that shrinks the chosen photo in the browser before it is uploaded.
 * Phone photos are often 3-5 MB; this resizes to at most `maxDim` px and re-encodes as JPEG,
 * usually under 400 KB. That saves residents' mobile data and makes the marketplace load faster for everyone.
 * Falls back to the original file if anything goes wrong.
 */
export default function ImageInput({ name, required, maxDim = 1600, quality = 0.82 }: {
  name: string; required?: boolean; maxDim?: number; quality?: number;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function onChange() {
    const input = ref.current;
    const file = input?.files?.[0];
    setNote(null);
    if (!input || !file || !file.type.startsWith("image/")) return;
    setBusy(true);
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
      if (scale === 1 && file.size < 400 * 1024) return;                    // already small: leave it alone
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
      if (blob && blob.size < file.size) {
        const out = new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
        const dt = new DataTransfer();
        dt.items.add(out);
        input.files = dt.files;
        setNote(`Optimised for mobile: ${kb(file.size)} → ${kb(out.size)}`);
      }
    } catch {
      /* keep the original file */
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input ref={ref} type="file" name={name} required={required} accept="image/jpeg,image/png,image/webp" onChange={onChange} />
      {busy && <span className="muted small" role="status">Optimising photo…</span>}
      {note && <span className="muted small" role="status">✓ {note}</span>}
    </>
  );
}
