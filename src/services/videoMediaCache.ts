import type { BookResource } from "../types/metaonTypes";

export const BOOK_MEDIA_CACHE_NAME = "metaon-book-media-v2";
export const BOOK_MEDIA_CACHE_PATH_PREFIX = "/__metaon-book-media/";

// Compatibility aliases keep older Activity imports working while all media
// types now share one Cache Storage implementation.
export const VIDEO_MEDIA_CACHE_NAME = BOOK_MEDIA_CACHE_NAME;
export const VIDEO_MEDIA_CACHE_PATH_PREFIX = BOOK_MEDIA_CACHE_PATH_PREFIX;

export function isBookMediaCacheResource(resource: Pick<BookResource, "path" | "mimeType" | "category">): boolean {
  const mimeType = (resource.mimeType || "").toLowerCase();
  const path = resource.path.toLowerCase();
  const isMediaFile =
    mimeType.startsWith("image/") ||
    mimeType.startsWith("video/") ||
    mimeType.startsWith("audio/") ||
    /\.(png|jpe?g|webp|gif|svg|mp4|webm|m3u8|mp3|m4a|ogg|wav)(?:$|\?)/i.test(path);

  return isMediaFile;
}

export function bookMediaCacheUrl(packageKey: string, path: string): string {
  const encodedPackageKey = encodeURIComponent(packageKey);
  const encodedPath = normalizePath(path)
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return new URL(`${BOOK_MEDIA_CACHE_PATH_PREFIX}${encodedPackageKey}/${encodedPath}`, window.location.origin).toString();
}

export async function cacheBookMediaResponse(
  packageKey: string,
  resource: Pick<BookResource, "path" | "mimeType" | "category">,
  response: Response
): Promise<boolean> {
  if (!isBookMediaCacheResource(resource) || typeof caches === "undefined") return false;

  try {
    const cache = await caches.open(BOOK_MEDIA_CACHE_NAME);
    await cache.put(bookMediaCacheUrl(packageKey, resource.path), response);
    return true;
  } catch {
    // Cache Storage quota, private browsing, or a browser policy must not make a
    // Book import fail. The existing IndexedDB Blob path remains the fallback.
    return false;
  }
}

export async function hasCachedBookMedia(packageKey: string, path: string): Promise<boolean> {
  if (typeof caches === "undefined") return false;

  try {
    const cache = await caches.open(BOOK_MEDIA_CACHE_NAME);
    return Boolean(await cache.match(bookMediaCacheUrl(packageKey, path)));
  } catch {
    return false;
  }
}

export async function deleteCachedBookMedia(packageKey: string): Promise<void> {
  if (typeof caches === "undefined") return;

  try {
    const cache = await caches.open(BOOK_MEDIA_CACHE_NAME);
    const packagePrefix = bookMediaCacheUrl(packageKey, "");
    const requests = await cache.keys();
    await Promise.all(
      requests
        .filter((request) => request.url.startsWith(packagePrefix))
        .map((request) => cache.delete(request))
    );
  } catch {
    // Cache Storage is an optimization. IndexedDB remains the authoritative
    // package cache and must still be invalidated when this cleanup fails.
  }
}

export function isBookMediaServiceWorkerControlling(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.serviceWorker?.controller);
}

export function registerBookMediaServiceWorker(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  void navigator.serviceWorker.register("/metaon-media-sw.js", { scope: "/" }).catch(() => {
    // Service Worker registration can be unavailable on an insecure LAN origin.
    // Existing activity resource loading must continue without it.
  });
}

export const isVideoMediaCacheResource = isBookMediaCacheResource;
export const videoMediaCacheUrl = bookMediaCacheUrl;
export const cacheVideoMediaResponse = cacheBookMediaResponse;
export const hasCachedVideoMedia = hasCachedBookMedia;
export const isVideoMediaServiceWorkerControlling = isBookMediaServiceWorkerControlling;
export const registerVideoMediaServiceWorker = registerBookMediaServiceWorker;

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}
