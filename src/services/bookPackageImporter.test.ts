import { beforeEach, describe, expect, it, vi } from "vitest";
import { getBookResourceManifest } from "../api/uniplanetApi";
import { indexedDbStorage } from "./indexedDbStorage";
import { BOOK_PACKAGE_CACHE_VERSION, downloadAndCacheBookPackage, getCachedPackage } from "./bookPackageImporter";
import { VIDEO_MEDIA_CACHE_NAME } from "./videoMediaCache";
import type { BookData, BookResourceManifest } from "../types/metaonTypes";

vi.mock("../api/uniplanetApi", () => ({
  getBookResourceManifest: vi.fn()
}));

vi.mock("./indexedDbStorage", () => ({
  indexedDbStorage: {
    getPackage: vi.fn(),
    savePackage: vi.fn(),
    listPackages: vi.fn(),
    listFiles: vi.fn(),
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
