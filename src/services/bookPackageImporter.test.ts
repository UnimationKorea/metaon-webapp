import { beforeEach, describe, expect, it, vi } from "vitest";
import { getBookResourceManifest } from "../api/uniplanetApi";
import { indexedDbStorage } from "./indexedDbStorage";
import {
  BOOK_MEDIA_CACHE_VERSION,
  BOOK_PACKAGE_CACHE_VERSION,
  downloadAndCacheBookPackage,
  getCachedPackage,
  isBookPackageCurrentVersion
} from "./bookPackageImporter";
import { bookMediaCacheUrl, VIDEO_MEDIA_CACHE_NAME } from "./videoMediaCache";
import { ActType, type BookData, type BookResourceManifest } from "../types/metaonTypes";

vi.mock("../api/uniplanetApi", () => ({
  getBookResourceManifest: vi.fn()
}));

vi.mock("./indexedDbStorage", () => ({
  indexedDbStorage: {
    getPackage: vi.fn(),
    savePackage: vi.fn(),
    listPackages: vi.fn(),
    listFiles: vi.fn(),
    listFilePaths: vi.fn(),
    getFileBlob: vi.fn(),
    deletePackage: vi.fn()
  }
}));

const book: BookData = {
  seriesGroup: 160,
  seriesIdx: 591,
  bookIdx: 6710,
  bookId: "GPLaa01",
  bookCode: "GPLaa01",
  bookName: "Over",
  bookNumber: 1,
  lexile: "",
  bUrl: "",
  thumbnailUrl: "",
  themeId: 0,
  appVersion: ""
};

describe("downloadAndCacheBookPackage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.mocked(indexedDbStorage.getFileBlob).mockResolvedValue(undefined);
  });

  it("downloads assets referenced by canonical ebook/book.json", async () => {
    const manifest: BookResourceManifest = {
      key: "book:6710",
      book,
      lessonDays: [],
      generatedFiles: [],
      resources: [
        {
          path: "Lessons/L1/D1/ebook/book.json",
          sourcePath: "/11/160/591/6710/978/978/ebook/book.json",
          url: "https://metaon.s3.ap-northeast-2.amazonaws.com/MetaOn3/BookData/11/160/591/6710/978/978/ebook/book.json",
          mimeType: "application/json",
          category: "ebook"
        }
      ]
    };
    vi.mocked(getBookResourceManifest).mockResolvedValue(manifest);
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/ebook/book.json")) {
        return new Response(
          JSON.stringify({
            pages: [
              {
                  bookPage: "T",
                  img: "assets/pages/page_001.webp",
                  audio: "assets/audio/page_001_01.mp3",
                  words: [{ w: "Over", x: 0.2, y: 0.1, bw: 0.3, bh: 0.1, t0: 0.2, t1: 0.8 }]
              }
            ]
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("asset", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await downloadAndCacheBookPackage(book);

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/ebook/book.json"));
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/ebook/assets/pages/page_001.webp"));
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/ebook/assets/audio/page_001_01.mp3"));
    const savedFiles = vi.mocked(indexedDbStorage.savePackage).mock.calls[0][1].map((file) => file.path);
    expect(savedFiles).toEqual([
      "Lessons/L1/D1/ebook/book.json",
      "Lessons/L1/D1/ebook/assets/pages/page_001.webp",
      "Lessons/L1/D1/ebook/assets/audio/page_001_01.mp3"
    ]);
    const savedPackage = vi.mocked(indexedDbStorage.savePackage).mock.calls[0][0];
    expect(savedPackage.cacheVersion).toBe(BOOK_PACKAGE_CACHE_VERSION);
    expect(savedPackage.totalFiles).toBe(3);
    expect(savedPackage.filePaths).toEqual(savedFiles);
  });

  it("invalidates package metadata created before the ebook cache schema", async () => {
    vi.mocked(indexedDbStorage.getPackage).mockResolvedValue({
      key: "book:6710",
      source: "metaon3-resources",
      bookId: "GPLaa01",
      seriesGroup: 160,
      seriesIdx: 591,
      downloadedAt: "2026-07-01T00:00:00.000Z",
      totalFiles: 72,
      totalBytes: 1,
      lessonDays: []
    });

    await expect(getCachedPackage(book)).resolves.toBeUndefined();
  });

  it("reuses a package only when its downloaded resource version matches", () => {
    expect(isBookPackageCurrentVersion({ contentVersion: "2026.08.05" }, "2026.08.05")).toBe(true);
    expect(isBookPackageCurrentVersion({ contentVersion: "2026.08.04" }, "2026.08.05")).toBe(false);
    expect(isBookPackageCurrentVersion({ manifest: { book: { ...book, appVersion: "3" } } }, "3")).toBe(true);
    expect(isBookPackageCurrentVersion({ contentVersion: "3" }, "")).toBe(true);
  });

  it("clears stale IndexedDB and media cache entries before downloading a newer Book version", async () => {
    const updatedBook = { ...book, appVersion: "2" };
    const manifest: BookResourceManifest = {
      key: "book:6710",
      book: updatedBook,
      lessonDays: [],
      generatedFiles: [],
      resources: [
        {
          path: "Lessons/L1/D1/word/img/word_01.png",
          sourcePath: "/word.png",
          url: "https://example.test/word.png",
          mimeType: "image/png",
          category: "word"
        }
      ]
    };
    const mediaCache = {
      keys: vi.fn().mockResolvedValue([new Request(bookMediaCacheUrl("book:6710", "Lessons/L1/D1/word/img/word_01.png"))]),
      delete: vi.fn().mockResolvedValue(true),
      put: vi.fn().mockResolvedValue(undefined)
    };
    vi.stubGlobal("caches", { open: vi.fn().mockResolvedValue(mediaCache) });
    vi.mocked(indexedDbStorage.getPackage).mockResolvedValue({
      key: "book:6710",
      cacheVersion: BOOK_PACKAGE_CACHE_VERSION,
      contentVersion: "1",
      source: "metaon3-resources",
      bookId: book.bookId,
      seriesGroup: book.seriesGroup,
      seriesIdx: book.seriesIdx,
      downloadedAt: "2026-08-01T00:00:00.000Z",
      totalFiles: 1,
      totalBytes: 1,
      lessonDays: []
    });
    vi.mocked(getBookResourceManifest).mockResolvedValue(manifest);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("new", { status: 200, headers: { "Content-Type": "image/png" } })));

    const next = await downloadAndCacheBookPackage(updatedBook);

    expect(indexedDbStorage.deletePackage).toHaveBeenCalledWith("book:6710");
    expect(mediaCache.delete).toHaveBeenCalledTimes(1);
    expect(next.contentVersion).toBe("2");
  });

  it("stores a video Blob with the manifest MIME type when S3 uses a generic response type", async () => {
    const manifest: BookResourceManifest = {
      key: "book:6710",
      book,
      lessonDays: [],
      generatedFiles: [],
      resources: [
        {
          path: "Lessons/L1/D1/video/movie.mp4",
          sourcePath: "/13/173/648/8159/1512/1512/movie/movie.mp4",
          url: "https://metaon.s3.ap-northeast-2.amazonaws.com/MetaOn3/BookData/13/173/648/8159/1512/1512/movie/movie.mp4",
          mimeType: "video/mp4",
          category: "video-background"
        }
      ]
    };
    vi.mocked(getBookResourceManifest).mockResolvedValue(manifest);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 })));

    await downloadAndCacheBookPackage(book);

    const savedFile = vi.mocked(indexedDbStorage.savePackage).mock.calls[0][1]
      .find((file) => file.path === "Lessons/L1/D1/video/movie.mp4");
    expect(savedFile?.mimeType).toBe("video/mp4");
    expect(savedFile?.blob.type).toBe("video/mp4");
  });

  it("also stores opt-in video Activity media as a complete Cache Storage response", async () => {
    const manifest: BookResourceManifest = {
      key: "book:6710",
      book,
      lessonDays: [],
      generatedFiles: [],
      resources: [
        {
          path: "Lessons/L1/D1/wdca02/video/loop.mp4",
          sourcePath: "/13/173/648/8159/1512/1512/wdca02/loop.mp4",
          url: "https://metaon.s3.ap-northeast-2.amazonaws.com/MetaOn3/BookData/13/173/648/8159/1512/1512/wdca02/loop.mp4",
          mimeType: "video/mp4",
          category: "wdca02"
        }
      ]
    };
    const put = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("caches", { open: vi.fn().mockResolvedValue({ put }) });
    vi.mocked(getBookResourceManifest).mockResolvedValue(manifest);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 })));

    const pkg = await downloadAndCacheBookPackage(book);

    expect(caches.open).toHaveBeenCalledWith(VIDEO_MEDIA_CACHE_NAME);
    expect(put).toHaveBeenCalledTimes(1);
    expect(pkg.mediaCachePaths).toEqual(["Lessons/L1/D1/wdca02/video/loop.mp4"]);
  });

  it("downloads and caches the first Activity and next Activity media before unrelated Book resources", async () => {
    const manifest: BookResourceManifest = {
      key: "book:6710",
      book,
      generatedFiles: [],
      lessonDays: [
        {
          id: "1:1",
          lesson: 1,
          day: 1,
          title: "Day 1",
          activities: [
            { id: "word-card", actType: ActType.FlashCardSpace, activityCode: "WDCA01", title: "Word Card", actNum: 0, category: "word" },
            { id: "sentence-blank", actType: ActType.SentenceCheckSpace, activityCode: "STBL01", title: "Sentence Blank", actNum: 1, category: "sentence" }
          ]
        }
      ],
      resources: [
        { path: "Lessons/L1/D1/reading/01/img/img_01.png", sourcePath: "/reading.png", url: "https://example.test/reading.png", mimeType: "image/png", category: "reading" },
        { path: "Lessons/L1/D1/word/img/word_01.png", sourcePath: "/word.png", url: "https://example.test/word.png", mimeType: "image/png", category: "word" },
        { path: "Lessons/L1/D1/word/snd/snd_word_01.mp3", sourcePath: "/word.mp3", url: "https://example.test/word.mp3", mimeType: "audio/mpeg", category: "word" },
        { path: "Lessons/L1/D1/sentence/snd/snd_sentence_01.mp3", sourcePath: "/sentence.mp3", url: "https://example.test/sentence.mp3", mimeType: "audio/mpeg", category: "sentence" }
      ]
    };
    const requestedUrls: string[] = [];
    const put = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("caches", { open: vi.fn().mockResolvedValue({ put }) });
    vi.mocked(getBookResourceManifest).mockResolvedValue(manifest);
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      requestedUrls.push(url);
      return new Response("media", { status: 200 });
    }));

    const pkg = await downloadAndCacheBookPackage(book);

    expect(requestedUrls).toEqual([
      "https://example.test/word.png",
      "https://example.test/word.mp3",
      "https://example.test/sentence.mp3",
      "https://example.test/reading.png"
    ]);
    expect(put).toHaveBeenCalledTimes(4);
    expect(pkg.mediaCachePaths).toEqual([
      "Lessons/L1/D1/word/img/word_01.png",
      "Lessons/L1/D1/word/snd/snd_word_01.mp3",
      "Lessons/L1/D1/sentence/snd/snd_sentence_01.mp3",
      "Lessons/L1/D1/reading/01/img/img_01.png"
    ]);
    expect(pkg.mediaCacheVersion).toBe(BOOK_MEDIA_CACHE_VERSION);
  });

  it("hydrates first and next Activity media from an existing IndexedDB Book without S3 download", async () => {
    const manifest: BookResourceManifest = {
      key: "book:6710",
      book,
      generatedFiles: [],
      lessonDays: [
        {
          id: "1:1",
          lesson: 1,
          day: 1,
          title: "Day 1",
          activities: [
            { id: "word-card", actType: ActType.FlashCardSpace, activityCode: "WDCA01", title: "Word Card", actNum: 0, category: "word" },
            { id: "sentence-blank", actType: ActType.SentenceCheckSpace, activityCode: "STBL01", title: "Sentence Blank", actNum: 1, category: "sentence" }
          ]
        }
      ],
      resources: [
        { path: "Lessons/L1/D1/reading/01/img/img_01.png", sourcePath: "/reading.png", url: "https://example.test/reading.png", mimeType: "image/png", category: "reading" },
        { path: "Lessons/L1/D1/word/img/word_01.png", sourcePath: "/word.png", url: "https://example.test/word.png", mimeType: "image/png", category: "word" },
        { path: "Lessons/L1/D1/word/snd/snd_word_01.mp3", sourcePath: "/word.mp3", url: "https://example.test/word.mp3", mimeType: "audio/mpeg", category: "word" },
        { path: "Lessons/L1/D1/sentence/snd/snd_sentence_01.mp3", sourcePath: "/sentence.mp3", url: "https://example.test/sentence.mp3", mimeType: "audio/mpeg", category: "sentence" }
      ]
    };
    const put = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("caches", { open: vi.fn().mockResolvedValue({ put }) });
    vi.mocked(indexedDbStorage.getPackage).mockResolvedValue({
      key: "book:6710",
      cacheVersion: BOOK_PACKAGE_CACHE_VERSION,
      source: "metaon3-resources",
      bookId: book.bookId,
      seriesGroup: book.seriesGroup,
      seriesIdx: book.seriesIdx,
      downloadedAt: "2026-07-31T00:00:00.000Z",
      totalFiles: 4,
      totalBytes: 10,
      lessonDays: manifest.lessonDays,
      manifest,
      filePaths: manifest.resources.map((resource) => resource.path)
    });
    vi.mocked(indexedDbStorage.getFileBlob).mockResolvedValue(new Blob(["media"], { type: "application/octet-stream" }));

    const cached = await getCachedPackage(book);

    expect(cached?.mediaCacheVersion).toBe(BOOK_MEDIA_CACHE_VERSION);
    expect(cached?.mediaCachePaths).toEqual([
      "Lessons/L1/D1/word/img/word_01.png",
      "Lessons/L1/D1/word/snd/snd_word_01.mp3",
      "Lessons/L1/D1/sentence/snd/snd_sentence_01.mp3"
    ]);
    expect(put).toHaveBeenCalledTimes(3);
    expect(indexedDbStorage.savePackage).toHaveBeenCalledWith(expect.objectContaining({ mediaCacheVersion: BOOK_MEDIA_CACHE_VERSION }), []);
  });

  it("downloads MP3 assets referenced by cached npcqhk/script.json", async () => {
    const manifest: BookResourceManifest = {
      key: "book:6710",
      book,
      lessonDays: [],
      generatedFiles: [],
      resources: [
        {
          path: "Lessons/L1/D1/npcqhk/script.json",
          sourcePath: "/11/160/591/6710/978/978/npcqhk/script.json",
          url: "https://metaon.s3.ap-northeast-2.amazonaws.com/MetaOn3/BookData/11/160/591/6710/978/978/npcqhk/script.json",
          mimeType: "application/json",
          category: "npcqhk"
        }
      ]
    };
    vi.mocked(getBookResourceManifest).mockResolvedValue(manifest);
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/npcqhk/script.json")) {
        return new Response(
          JSON.stringify({
            opening: { audio: "audio/opening.mp3" },
            questions: [{ audio: "audio/q01_intro.mp3", fb_ok: { audio: "audio/q01_fb_ok.mp3" }, fb_no: { audio: "audio/q01_fb_no.mp3" } }],
            closing: { audio: "audio/closing.mp3" }
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("audio", { status: 200, headers: { "Content-Type": "audio/mpeg" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    await downloadAndCacheBookPackage(book);

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/npcqhk/audio/opening.mp3"));
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/npcqhk/audio/q01_intro.mp3"));
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/npcqhk/audio/q01_fb_ok.mp3"));
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/npcqhk/audio/q01_fb_no.mp3"));
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/npcqhk/audio/closing.mp3"));
    const savedFiles = vi.mocked(indexedDbStorage.savePackage).mock.calls[0][1].map((file) => file.path);
    expect(savedFiles).toContain("Lessons/L1/D1/npcqhk/script.json");
    expect(savedFiles).toContain("Lessons/L1/D1/npcqhk/audio/q01_intro.mp3");
  });

  it("downloads webm audio referenced by cached npcqhk2/script.json", async () => {
    const manifest: BookResourceManifest = {
      key: "book:6710",
      book,
      lessonDays: [],
      generatedFiles: [],
      resources: [
        {
          path: "Lessons/L1/D1/npcqhk2/script.json",
          sourcePath: "/11/160/591/6710/978/978/npcqhk2/script.json",
          url: "https://metaon.s3.ap-northeast-2.amazonaws.com/MetaOn3/BookData/11/160/591/6710/978/978/npcqhk2/script.json",
          mimeType: "application/json",
          category: "npcqhk2"
        }
      ]
    };
    vi.mocked(getBookResourceManifest).mockResolvedValue(manifest);
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/npcqhk2/script.json")) {
        return new Response(
          JSON.stringify({
            opening: { audio: "audio/opening.webm" },
            items: [
              {
                item_idx: 3027,
                type: "word",
                weak: { audio: "audio/w_bats_wk.webm", fb_ok: { audio: "audio/w_bats_wk_ok.webm" }, fb_no: { audio: "audio/w_bats_wk_no.webm" } },
                relearn: { audio: "audio/w_bats_rl.webm", fb_ok: { audio: "audio/w_bats_rl_ok.webm" }, fb_no: { audio: "audio/w_bats_rl_no.webm" } }
              }
            ],
            closing: { audio: "audio/closing.webm" }
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("audio", { status: 200, headers: { "Content-Type": "audio/webm" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    await downloadAndCacheBookPackage(book);

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/npcqhk2/audio/opening.webm"));
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/npcqhk2/audio/w_bats_wk.webm"));
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/npcqhk2/audio/w_bats_rl_no.webm"));
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/npcqhk2/audio/closing.webm"));
    const savedFiles = vi.mocked(indexedDbStorage.savePackage).mock.calls[0][1].map((file) => file.path);
    expect(savedFiles).toContain("Lessons/L1/D1/npcqhk2/script.json");
    expect(savedFiles).toContain("Lessons/L1/D1/npcqhk2/audio/w_bats_wk.webm");
  });

  it("records cached npcqhk script paths on the package", async () => {
    const manifest: BookResourceManifest = {
      key: "book:6710",
      book,
      lessonDays: [],
      generatedFiles: [],
      resources: [
        {
          path: "Lessons/L1/D1/npcqhk/script.json",
          sourcePath: "/x/npcqhk/script.json",
          url: "https://metaon.s3.ap-northeast-2.amazonaws.com/MetaOn3/BookData/x/npcqhk/script.json",
          mimeType: "application/json",
          category: "npcqhk"
        }
      ]
    };
    vi.mocked(getBookResourceManifest).mockResolvedValue(manifest);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ questions: [] }), { status: 200, headers: { "Content-Type": "application/json" } }))
    );

    await downloadAndCacheBookPackage(book);

    const savedPackage = vi.mocked(indexedDbStorage.savePackage).mock.calls[0][0];
    expect(savedPackage.npcScriptPaths).toEqual(["Lessons/L1/D1/npcqhk/script.json"]);
  });

  it("skips missing NPC resources instead of failing the whole book import", async () => {
    const manifest: BookResourceManifest = {
      key: "book:6710",
      book,
      lessonDays: [],
      generatedFiles: [],
      resources: [
        {
          path: "Lessons/L1/D1/word/snd/snd_word_01.mp3",
          sourcePath: "/x/word/snd/snd_word_01.mp3",
          url: "https://metaon.s3.ap-northeast-2.amazonaws.com/MetaOn3/BookData/x/word/snd/snd_word_01.mp3",
          mimeType: "audio/mpeg",
          category: "word"
        },
        {
          path: "Lessons/L1/D1/npcqhk/script.json",
          sourcePath: "/x/npcqhk/script.json",
          url: "https://metaon.s3.ap-northeast-2.amazonaws.com/MetaOn3/BookData/x/npcqhk/script.json",
          mimeType: "application/json",
          category: "npcqhk"
        }
      ]
    };
    vi.mocked(getBookResourceManifest).mockResolvedValue(manifest);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("/npcqhk/") ? new Response("nope", { status: 404 }) : new Response("audio", { status: 200 })
      )
    );

    // The 404 on the NPC resource must not throw.
    const pkg = await downloadAndCacheBookPackage(book);
    expect(pkg.npcScriptPaths).toEqual([]);
    const savedFiles = vi.mocked(indexedDbStorage.savePackage).mock.calls[0][1].map((file) => file.path);
    expect(savedFiles).toContain("Lessons/L1/D1/word/snd/snd_word_01.mp3");
    expect(savedFiles).not.toContain("Lessons/L1/D1/npcqhk/script.json");
  });
});
