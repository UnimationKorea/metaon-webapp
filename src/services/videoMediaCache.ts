import type { BookResource } from "../types/metaonTypes";

export const VIDEO_MEDIA_CACHE_NAME = "metaon-video-media-v1";
export const VIDEO_MEDIA_CACHE_PATH_PREFIX = "/__metaon-book-media/";

const VIDEO_ACTIVITY_FOLDERS = new Set(["wdca02", "wdqu03", "wdbl02", "stbl02", "stsc02", "strc02"]);
const VIDEO_MEDIA_CATEGORIES = new Set([
  "movie",
  "movie-audio",
  "video-background",
  "wdca02",
  "wdqu03",
  "wdbl02",
  "stbl02",
  "stsc02",
  "strc02"
]);

export function isVideoMediaCacheResource(resource: Pick<BookResource, "path" | "mimeType" | "category">): boolean {
  const mimeType = resource.mimeType.toLowerCase();
  const path = resource.path.toLowerCase();
  const category = resource.category?.toLowerCase() || "";
  const isMediaFile = mimeType.startsWith("video/") || mimeType.startsWith("audio/") || /\.(mp4|webm|m3u8|mp3|m4a|ogg|wav)(?:$|\?)/i.test(path);

  if (!isMediaFile) return false;
  if (VIDEO_MEDIA_CATEGORIES.has(category)) return true;
  return path.split("/").some((segment) => VIDEO_ACTIVITY_FOLDERS.has(segment));
}

export function videoMediaCacheUrl(packageKey: string, path: string): string {
  const encodedPackageKey = encodeURIComponent(packageKey);
  const encodedPath = normalizePath(path)
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return new URL(`${VIDEO_MEDIA_CACHE_PATH_PREFIX}${encodedPackageKey}/${encodedPath}`, window.location.origin).toString();
}

export async function cacheVideoMediaResponse(
  packageKey: string,
  resource: Pick<BookResource, "path" | "mimeType" | "category">,
  response: Response
): Promise<boolean> {
  if (!isVideoMediaCacheResource(resource) || typeof caches === "undefined") return false;

  try {
    const cache = await caches.open(VIDEO_MEDIA_CACHE_NAME);
    await cache.put(videoMediaCacheUrl(packageKey, resource.path), response);
    return true;
  } catch {
    // Cache Storage quota, private browsing, or a browser policy must not make a
    // Book import fail. The existing IndexedDB Blob path remains the fallback.
    return false;
  }
}

export async function hasCachedVideoMedia(packageKey: string, path: string): Promise<boolean> {
  if (typeof caches === "undefined") return false;

  try {
    const cache = await caches.open(VIDEO_MEDIA_CACHE_NAME);
    return Boolean(await cache.match(videoMediaCacheUrl(packageKey, path)));
  } catch {
    return false;
  }
}

export function isVideoMediaServiceWorkerControlling(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.serviceWorker?.controller);
}

export function registerVideoMediaServiceWorker(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  void navigator.serviceWorker.register("/metaon-media-sw.js", { scope: "/" }).catch(() => {
    // Service Worker registration can be unavailable on an insecure LAN origin.
    // Existing activity resource loading must continue without it.
  });
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}
