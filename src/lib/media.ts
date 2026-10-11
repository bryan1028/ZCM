// Client-side helpers for listing photos and videos (safe to import in the browser).
export const IMAGE_BUCKET = "zcm-listing-images";
export const VIDEO_BUCKET = "zcm-listing-videos";
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 20 * 1024 * 1024;
export const IMAGE_EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const VIDEO_EXT: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;
export { mb };

/**
 * Prepare a chosen photo for upload: shrink it to at most `maxDim` px and re-encode as JPEG (phone and camera photos
 * are often 4-8 MB), and convert formats the storage bucket doesn't accept (e.g. HEIC from an iPhone) where the browser
 * can read them. Throws a human-readable Error when the photo can't be used.
 */
export async function preparePhoto(file: File, maxDim = 1600, quality = 0.82): Promise<File> {
  const accepted = file.type in IMAGE_EXT;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => createImageBitmap(file));
  } catch {
    if (accepted && file.size <= MAX_IMAGE_BYTES) return file;      // can't resize here, but the original is fine as is
    throw new Error(accepted ? `This photo is ${mb(file.size)}, over the 5 MB limit` : "This photo format isn't supported. Please choose a JPEG or PNG.");
  }
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  if (accepted && scale === 1 && file.size < 400 * 1024) return file;   // already small
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
  if (blob && (!accepted || blob.size < file.size)) return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  if (accepted && file.size <= MAX_IMAGE_BYTES) return file;
  throw new Error("Couldn't prepare this photo. Please try a different one.");
}
