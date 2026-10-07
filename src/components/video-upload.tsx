"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MAX_VIDEO_BYTES, VIDEO_EXT } from "@/lib/images";

// Videos go straight from the browser to private Storage (server actions can't take 20 MB bodies);
// Storage RLS checks the folder, then the server action records the path on the listing.
export default function VideoUpload({ communityId, userId, attach }: {
  communityId: string; userId: string; attach: (path: string) => Promise<{ error?: string }>;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function upload() {
    const file = input.current?.files?.[0];
    if (!file) return setMsg("Choose a video first");
    const ext = VIDEO_EXT[file.type];
    if (!ext) return setMsg("Videos must be MP4, WebM or MOV");
    if (file.size > MAX_VIDEO_BYTES) return setMsg("Video is larger than 20 MB — try a shorter clip (about 30 seconds)");
    setBusy(true); setMsg(null);
    const supabase = createClient();
    const path = `${communityId}/${userId}/${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage.from("zcm-listing-videos").upload(path, file, { contentType: file.type });
    if (up.error) { setBusy(false); return setMsg(up.error.message); }
    const res = await attach(path);
    if (res.error) {
      await supabase.storage.from("zcm-listing-videos").remove([path]);   // don't leave an orphan behind
      setMsg(res.error);
    } else {
      if (input.current) input.current.value = "";
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <input ref={input} type="file" accept="video/mp4,video/webm,video/quicktime" />
      <button type="button" onClick={upload} disabled={busy}>{busy ? "Uploading…" : "Upload video"}</button>
      {msg && <p className="muted">{msg}</p>}
    </div>
  );
}
