const BOOK_MEDIA_CACHE_NAME = "metaon-book-media-v2";
const BOOK_MEDIA_CACHE_PATH_PREFIX = "/__metaon-book-media/";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BOOK_MEDIA_CACHE_PATH_PREFIX)) return;

  event.respondWith(fromBookMediaCache(event.request));
});

async function fromBookMediaCache(request) {
  const cache = await caches.open(BOOK_MEDIA_CACHE_NAME);
  const response = await cache.match(request.url);
  if (!response) {
    return new Response("Cached media resource is unavailable.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }

  const range = request.headers.get("range");
  if (!range) return response;
  return createRangeResponse(response, range);
}

async function createRangeResponse(response, rangeHeader) {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) return response;

  const buffer = await response.arrayBuffer();
  const total = buffer.byteLength;
  let start = match[1] ? Number(match[1]) : 0;
  let end = match[2] ? Number(match[2]) : total - 1;

  if (!match[1] && match[2]) {
    const suffixLength = Number(match[2]);
    start = Math.max(total - suffixLength, 0);
    end = total - 1;
  }

  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start >= total || end < start) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${total}` } });
  }

  end = Math.min(end, total - 1);
  const body = buffer.slice(start, end + 1);
  const headers = new Headers(response.headers);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Length", String(body.byteLength));
  headers.set("Content-Range", `bytes ${start}-${end}/${total}`);

  return new Response(body, { status: 206, statusText: "Partial Content", headers });
}
