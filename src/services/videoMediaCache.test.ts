import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BOOK_MEDIA_CACHE_NAME,
  bookMediaCacheUrl,
  cacheBookMediaResponse,
  hasCachedBookMedia,
  isBookMediaCacheResource
} from "./videoMediaCache";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("videoMediaCache", () => {
  it("stores image, audio, and video resources while excluding Book metadata", () => {
    expect(isBookMediaCacheResource({ path: "Lessons/L1/D1/wdca02/video/loop.mp4", mimeType: "video/mp4" })).toBe(true);
    expect(isBookMediaCacheResource({ path: "Lessons/L1/D1/movie/audio/script.mp3", mimeType: "audio/mpeg", category: "movie-audio" })).toBe(true);
    expect(isBookMediaCacheResource({ path: "Lessons/L1/D1/word/img/word_01.png", mimeType: "image/png", category: "word" })).toBe(true);
    expect(isBookMediaCacheResource({ path: "Lessons/L1/D1/listening/01/video/clip.mp4", mimeType: "video/mp4", category: "listening" })).toBe(true);
    expect(isBookMediaCacheResource({ path: "Lessons/L1/D1/word/info_word.json", mimeType: "application/json", category: "word" })).toBe(false);
  });

  it("uses a stable same-origin cache URL instead of the S3 URL", () => {
    expect(bookMediaCacheUrl("book:6710", "Lessons/L1/D1/movie/video/movie 01.mp4")).toBe(
      "http://localhost:3000/__metaon-book-media/book%3A6710/Lessons/L1/D1/movie/video/movie%2001.mp4"
    );
  });

  it("stores and resolves an opt-in media response from Cache Storage", async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    const match = vi.fn().mockResolvedValue(new Response("cached media", { status: 200 }));
    const open = vi.fn().mockResolvedValue({ put, match });
    vi.stubGlobal("caches", { open });

    const resource = { path: "Lessons/L1/D1/movie/video/movie.mp4", mimeType: "video/mp4", category: "movie" };
    await expect(cacheBookMediaResponse("book:6710", resource, new Response("media", { status: 200 }))).resolves.toBe(true);
    await expect(hasCachedBookMedia("book:6710", resource.path)).resolves.toBe(true);

    expect(open).toHaveBeenCalledWith(BOOK_MEDIA_CACHE_NAME);
    expect(put).toHaveBeenCalledWith(
      "http://localhost:3000/__metaon-book-media/book%3A6710/Lessons/L1/D1/movie/video/movie.mp4",
      expect.any(Response)
    );
  });

  it("does not make the Book import fail when Cache Storage is unavailable", async () => {
    vi.stubGlobal("caches", {
      open: vi.fn().mockRejectedValue(new Error("quota exceeded"))
    });

    await expect(
      cacheBookMediaResponse(
        "book:6710",
        { path: "Lessons/L1/D1/wdca02/video/loop.mp4", mimeType: "video/mp4", category: "wdca02" },
        new Response("media", { status: 200 })
      )
    ).resolves.toBe(false);
  });
});
