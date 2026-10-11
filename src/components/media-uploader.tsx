"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { IMAGE_BUCKET, IMAGE_EXT, MAX_VIDEO_BYTES, VIDEO_BUCKET, VIDEO_EXT, mb, preparePhoto } from "@/lib/media";

type Kind = "image" | "video";
type Item = { key: string; kind: Kind; path?: string; preview: string; status: "uploading" | "done" | "error"; error?: string; file?: File };
export type InitialMedia = { kind: Kind; path: string; url: string };
type Result = { error?: string };

/**
 * Pick photos and a video, see them right away, and watch each one upload straight from the browser to storage
 * (no detour through the web server). Every file shows its own state, so nothing fails silently.
 *
 * Two modes: with `attach`/`detach` (editing a listing) every change is saved to the listing immediately;
 * without them (the sell form) the uploaded paths ride along with the form as hidden fields until it is published.
 */
export default function MediaUploader({ communityId, userId, initial = [], maxImages = 6, maxVideos = 1, attach, detach, onBusyChange }: {
  communityId: string; userId: string; initial?: InitialMedia[]; maxImages?: number; maxVideos?: number;
  attach?: (kind: Kind, path: string) => Promise<Result>;
  detach?: (kind: Kind, path: string) => Promise<Result>;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [items, setItems] = useState<Item[]>(() => initial.map((m) => ({ key: m.path, kind: m.kind, path: m.path, preview: m.url, status: "done" })));
  const [notice, setNotice] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const patch = (key: string, p: Partial<Item>) => setItems((cur) => cur.map((i) => (i.key === key ? { ...i, ...p } : i)));
  const busy = items.some((i) => i.status === "uploading");
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);

  async function upload(item: Item) {
    const file = item.file!;
    const supabase = createClient();
    try {
      let body: File = file, ext: string;
      if (item.kind === "image") {
        body = await preparePhoto(file);
        ext = IMAGE_EXT[body.type] ?? "jpg";
      } else {
        ext = VIDEO_EXT[file.type];
        if (!ext) throw new Error("Videos must be MP4, WebM or MOV");
        if (file.size > MAX_VIDEO_BYTES) throw new Error(`This video is ${mb(file.size)}, over the 20 MB limit. Try a shorter clip (about 30 seconds).`);
      }
      const path = `${communityId}/${userId}/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from(item.kind === "image" ? IMAGE_BUCKET : VIDEO_BUCKET).upload(path, body, { contentType: body.type });
      if (up.error) throw new Error(up.error.message);
      if (attach) {
        const res = await attach(item.kind, path);
        if (res.error) {
          await supabase.storage.from(item.kind === "image" ? IMAGE_BUCKET : VIDEO_BUCKET).remove([path]);   // don't leave an orphan behind
          throw new Error(res.error);
        }
      }
      patch(item.key, { path, status: "done", error: undefined, file: undefined });
    } catch (e) {
      patch(item.key, { status: "error", error: e instanceof Error ? e.message : "Upload failed. Please try again." });
    }
  }
  const enqueue = (item: Item) => { queue.current = queue.current.then(() => upload(item)); };

  function pick(files: FileList | null) {
    setNotice(null);
    if (!files?.length) return;
    const fresh: Item[] = [];
    let images = itemsRef.current.filter((i) => i.kind === "image" && i.status !== "error").length;
    let videos = itemsRef.current.filter((i) => i.kind === "video" && i.status !== "error").length;
    const skipped: string[] = [];
    for (const file of Array.from(files)) {
      const kind: Kind | null = file.type.startsWith("video/") ? "video" : file.type.startsWith("image/") || /\.(heic|heif)$/i.test(file.name) ? "image" : null;
      if (!kind) { skipped.push(`${file.name} isn't a photo or video`); continue; }
      if (kind === "image" ? images >= maxImages : videos >= maxVideos) {
        skipped.push(kind === "image" ? `Only ${maxImages} photos fit on a listing` : `Only ${maxVideos} video fits on a listing`); continue;
      }
      if (kind === "image") images++; else videos++;
      fresh.push({ key: crypto.randomUUID(), kind, preview: URL.createObjectURL(file), status: "uploading", file });
    }
    if (skipped.length) setNotice([...new Set(skipped)].join(". ") + ".");
    if (!fresh.length) return;
    setItems((cur) => [...cur, ...fresh]);
    fresh.forEach(enqueue);
    if (input.current) input.current.value = "";   // so choosing the same file again still fires
  }

  async function remove(item: Item) {
    setNotice(null);
    if (item.status === "done" && item.path) {
      patch(item.key, { status: "uploading" });
      const res = detach ? await detach(item.kind, item.path) : {};
      if (res.error) { patch(item.key, { status: "done" }); setNotice(res.error); return; }
      if (!detach) await createClient().storage.from(item.kind === "image" ? IMAGE_BUCKET : VIDEO_BUCKET).remove([item.path]);
    }
    setItems((cur) => cur.filter((i) => i.key !== item.key));
  }

  function retry(item: Item) {
    patch(item.key, { status: "uploading", error: undefined });
    enqueue({ ...item, status: "uploading" });
  }

  const done = items.filter((i) => i.status === "done");
  const photoCount = items.filter((i) => i.kind === "image" && i.status !== "error").length;
  const videoCount = items.filter((i) => i.kind === "video" && i.status !== "error").length;

  return (
    <div className="media-up">
      {!attach && (
        <>
          <input type="hidden" name="photo_paths" value={JSON.stringify(done.filter((i) => i.kind === "image").map((i) => i.path))} />
          <input type="hidden" name="video_paths" value={JSON.stringify(done.filter((i) => i.kind === "video").map((i) => i.path))} />
        </>
      )}
      {items.length > 0 && (
        <div className="photo-grid">
          {items.map((it, n) => (
            <div className={`photo photo-${it.status}${it.kind === "video" ? " photo-video" : ""}`} key={it.key}>
              {it.kind === "image"
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={it.preview} alt="" />
                : <video src={`${it.preview}#t=0.1`} muted playsInline preload="metadata" />}
              {it.kind === "video" && <span className="play-badge" aria-hidden>▶</span>}
              {n === 0 && it.kind === "image" && it.status === "done" && <span className="cover-tag">Cover</span>}
              {it.status === "uploading" && <span className="photo-state" role="status"><i className="spinner" aria-hidden />Uploading…</span>}
              {it.status === "error" && (
                <span className="photo-state photo-err" role="alert">
                  <span>{it.error}</span>
                  {it.file && <button type="button" className="sm" onClick={() => retry(it)}>Try again</button>}
                </span>
              )}
              {it.status !== "uploading" && <button type="button" className="photo-x" aria-label={`Remove ${it.kind}`} title="Remove" onClick={() => remove(it)}>✕</button>}
            </div>
          ))}
        </div>
      )}
      <label className="dropzone">
        <input ref={input} type="file" multiple accept="image/*,video/mp4,video/webm,video/quicktime,.heic,.heif" onChange={(e) => pick(e.target.files)} />
        <span className="dz-icon" aria-hidden>📷</span>
        <span><b>Add photos or a video</b><small>{photoCount} of {maxImages} photos · {videoCount} of {maxVideos} video · video up to 20 MB</small></span>
      </label>
      {notice && <div className="alert info" role="status">{notice}</div>}
    </div>
  );
}
