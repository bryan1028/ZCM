import type { SupabaseClient } from "@supabase/supabase-js";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export function extFor(file: File) {
  return EXT[file.type] ?? null;
}

/** Private buckets: turn stored paths into short-lived signed URLs (access is checked by Storage RLS). */
export async function signedUrls(supabase: SupabaseClient, bucket: string, paths: string[], seconds = 3600) {
  if (!paths.length) return new Map<string, string>();
  const { data } = await supabase.storage.from(bucket).createSignedUrls(paths, seconds);
  const out = new Map<string, string>();
  for (const d of data ?? []) if (d.signedUrl && d.path) out.set(d.path, d.signedUrl);
  return out;
}
