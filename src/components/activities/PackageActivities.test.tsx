import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { indexedDbStorage } from "../../services/indexedDbStorage";
import { ActType, type ActivityRendererContext } from "../../types/metaonTypes";
import {
  ContextClozeRaceActivity,
  DictationLadderActivity,
  FlashCardActivity,
  GrammarTransformActivity,
  ListeningActivity,
  ParaphraseMatchActivity,
  ReadingActivity,
  SentenceRepairActivity,
  SpellingFishActivity,
  type PrototypeActivityData
} from "./PackageActivities";

vi.mock("../../services/indexedDbStorage", () => ({
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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const videoPaths = [
  "Lessons/L1/D1/listening/01/video/video_02.mp4",
  "Lessons/L1/D1/listening/01/video/video_01.mp4"
];

const context: ActivityRendererContext = {
  packageMeta: {
    key: "book:6710",
    source: "metaon3-resources",
    bookIdx: 6710,
    bookId: "GPLaa01",
    seriesGroup: 160,
    seriesIdx: 591,
    downloadedAt: "2026-07-01T00:00:00.000Z",
    totalFiles: 2,
    totalBytes: 2,
    lessonDays: []
  },
  day: {
    id: "978",
    dayIdx: 978,
    lesson: 1,
    day: 1,
    title: "Day 1",
    activities: []
  },
  activity: {
    id: "12881",
    actIdx: 12881,
    dayIdx: 978,
    actType: ActType.Listening,
    title: "Listen",
    actNum: 0,
    category: "listening",
    params: ["0"]
  }
};

const underSeaContext: ActivityRendererContext = {
  ...context,
  activity: {
    id: "undersea",
    actIdx: 59001,
    dayIdx: 978,
    actType: ActType.UnderSea,
    title: "Spelling Fish",
    actNum: 0,
    category: "word",
    params: ["0"]
  }
};

const readingContext: ActivityRendererContext = {
  ...context,
  activity: {
    id: "12882",
    actIdx: 12882,
    dayIdx: 978,
    actType: ActType.Reading,
    title: "Read",
    actNum: 1,
    category: "reading",
    params: ["0"]
  }
};

const flashCardContext: ActivityRendererContext = {
  ...context,
  activity: {
    id: "12883",
    actIdx: 12883,
    dayIdx: 978,
    activityCode: "WDCA01",
    actType: ActType.FlashCardSpace,
    title: "Word Card",
    actNum: 2,
    category: "word",
    params: ["0"]
  }
};

describe("FlashCardActivity WDCA01", () => {
  it("shows meaning and example on the flipped card when More info is enabled", async () => {
    vi.clearAllMocks();
    const play = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, value: play });
    Object.defineProperty(HTMLMediaElement.prototype, "pause", { configurable: true, value: vi.fn() });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn((blob: Blob & { path?: string }) => `blob:${blob.path || "word-resource"}`)
    });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });

    const paths = [
      "Lessons/L1/D1/word/info_word.json",
      "Lessons/L1/D1/word/img/float.png",
      "Lessons/L1/D1/word/snd/snd_float.mp3"
    ];
    vi.mocked(indexedDbStorage.listFiles).mockResolvedValue(
      paths.map((path) => ({
        packageKey: "book:6710",
        path,
        blob: new Blob([path]),
        size: path.length,
        mimeType: path.endsWith(".json") ? "application/json" : "application/octet-stream"
      }))
    );
    vi.mocked(indexedDbStorage.getFileBlob).mockImplementation(async (_key, path) => {
      if (path.endsWith("info_word.json")) {
        return new Blob(
          [JSON.stringify({ word: [{ Word_Idx: 501, Eng: "float", Mean: "뜨다.", Sentence: "Wood floats on water." }] })],
          { type: "application/json" }
        );
      }
      const blob = new Blob([path]) as Blob & { path?: string };
      blob.path = path;
      return blob;
    });

    const { container } = render(<FlashCardActivity context={flashCardContext} label="Word Card" />);
    await waitFor(() => expect(container.querySelector(".activity-frame")).toHaveAttribute("aria-busy", "false"));
    const card = await screen.findByRole("button", { name: /flip word card float/i });
    const moreInfo = screen.getByRole("switch", { name: /more info/i });
    expect(moreInfo).toHaveAttribute("aria-checked", "false");

    fireEvent.click(moreInfo);
    expect(moreInfo).toHaveAttribute("aria-checked", "true");
    fireEvent.click(card);

    expect(await screen.findByText("뜨다.")).toBeInTheDocument();
    expect(screen.getByText("Wood floats on water.")).toBeInTheDocument();
    expect(screen.getByText("float")).toHaveAttribute("data-fit-single-line", "true");
    expect(screen.getByText("뜨다.")).toHaveClass("wdca-card-meaning");
    expect(screen.getByText("Wood floats on water.")).toHaveClass("wdca-card-example");
    expect(card).toHaveClass("flipped");

    await waitFor(() => expect(container.querySelector("audio")).toBeInTheDocument());
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("automatically returns the card after two seconds and changes cards by horizontal swipe", async () => {
    const prototypeData: PrototypeActivityData = {
      words: [
        { index: 1, wordIdx: 501, eng: "float", mean: "뜨다.", sentence: "Wood floats on water.", wordClass: "verb" },
        { index: 2, wordIdx: 502, eng: "swim", mean: "수영하다.", sentence: "Fish swim in water.", wordClass: "verb" }
      ]
    };

    render(<FlashCardActivity context={flashCardContext} label="Word Card" prototypeData={prototypeData} />);
    const card = await screen.findByRole("button", { name: /flip word card float/i });

    vi.useFakeTimers();
    fireEvent.click(card);
    expect(card).toHaveClass("flipped");
    act(() => vi.advanceTimersByTime(1999));
    expect(card).toHaveClass("flipped");
    act(() => vi.advanceTimersByTime(1));
    expect(card).not.toHaveClass("flipped");

    fireEvent.pointerDown(card, { pointerId: 7, clientX: 280, clientY: 160 });
    fireEvent.pointerUp(card, { pointerId: 7, clientX: 120, clientY: 162 });
    expect(screen.getByRole("button", { name: /flip word card swim/i })).toBeInTheDocument();

    const nextCard = screen.getByRole("button", { name: /flip word card swim/i });
    fireEvent.touchStart(nextCard, { changedTouches: [{ identifier: 11, clientX: 110, clientY: 160 }] });
    fireEvent.touchEnd(nextCard, { changedTouches: [{ identifier: 11, clientX: 290, clientY: 162 }] });
    expect(screen.getByRole("button", { name: /flip word card float/i })).toBeInTheDocument();
  });
});

const ancientEgyptContext: ActivityRendererContext = {
  packageMeta: {
    key: "book:7405",
    source: "metaon3-resources",
    bookIdx: 7405,
    bookId: "G3LL02",
    seriesGroup: 164,
    seriesIdx: 603,
    downloadedAt: "2026-07-01T00:00:00.000Z",
    totalFiles: 8,
    totalBytes: 8,
    lessonDays: [],
    manifest: {
      book: {
        bookIdx: 7405,
        bookId: "G3LL02",
        bookCode: "G3LL02",
        bookName: "Ancient Egypt",
        title: "Ancient Egypt"
      }
    }
  },
  day: {
    id: "536",
    dayIdx: 536,
    lesson: 1,
    day: 1,
    title: "Day 1",
    activities: []
  },
  activity: {
    id: "7804",
    actIdx: 7804,
    dayIdx: 536,
    actType: ActType.Listening,
    title: "Listen",
    actNum: 0,
    category: "listening",
    params: ["0"]
  }
};

describe("ListeningActivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined)
    });
    Object.defineProperty(HTMLMediaElement.prototype, "pause", {
      configurable: true,
      value: vi.fn()
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn((blob: Blob) => `blob:${(blob as Blob & { path?: string }).path ?? "video"}`)
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn()
    });
    vi.mocked(indexedDbStorage.listFiles).mockResolvedValue(
      videoPaths.map((path) => ({
        packageKey: "book:6710",
        path,
        blob: new Blob(["video"], { type: "video/mp4" }),
        size: 1,
        mimeType: "video/mp4"
      }))
    );
    vi.mocked(indexedDbStorage.getFileBlob).mockImplementation(async (_key, path) => {
      const blob = new Blob(["video"], { type: "video/mp4" }) as Blob & { path?: string };
      blob.path = path;
      return blob;
    });
  });

  it("prefers canonical ebook/book.json assets for Type 67 Listen E-book", async () => {
    const ebookPaths = [
      "Lessons/L1/D1/ebook/book.json",
      "Lessons/L1/D1/ebook/assets/pages/page_001.webp",
      "Lessons/L1/D1/ebook/assets/audio/page_001_01.mp3"
    ];
    vi.mocked(indexedDbStorage.listFiles).mockResolvedValue(
      ebookPaths.map((path) => ({
        packageKey: "book:6710",
        path,
        blob: new Blob(["asset"]),
        size: 1,
        mimeType: path.endsWith(".webp") ? "image/webp" : path.endsWith(".mp3") ? "audio/mpeg" : "application/json"
      }))
    );
    vi.mocked(indexedDbStorage.getFileBlob).mockImplementation(async (_key, path) => {
      if (path.endsWith("ebook/book.json")) {
        return new Blob(
          [
            JSON.stringify({
              title: "Over",
              layout: "portrait",
              defaultView: "spread",
              pages: [
                {
                  pdfPage: 3,
                  bookPage: "T",
                  img: "assets/pages/page_001.webp",
                  audio: "assets/audio/page_001_01.mp3",
                  label: "속표지",
                  words: [{ w: "Over", x: 0.2, y: 0.1, bw: 0.3, bh: 0.1, t0: 0.2, t1: 0.8 }],
                  imgW: 1224,
                  imgH: 792
                }
              ]
            })
          ],
          { type: "application/json" }
        );
      }
      if (path.endsWith("info_listen_ebook.json")) return undefined;
      const blob = new Blob(["asset"], { type: path.endsWith(".webp") ? "image/webp" : "audio/mpeg" }) as Blob & { path?: string };
      blob.path = path;
      return blob;
    });

    render(<ListeningActivity context={context} />);

    await waitFor(() =>
      expect(indexedDbStorage.getFileBlob).toHaveBeenCalledWith("book:6710", "Lessons/L1/D1/ebook/book.json")
    );
    await waitFor(() =>
      expect(indexedDbStorage.getFileBlob).toHaveBeenCalledWith("book:6710", "Lessons/L1/D1/ebook/assets/pages/page_001.webp")
    );
    const iframe = await screen.findByTitle("Listen E-book viewer");
    expect(iframe).toHaveAttribute("src", "/ebook-viewer/poc_htmljson/index.html");
    expect(iframe).toHaveAttribute("data-page-count", "1");
    const postMessage = vi.spyOn((iframe as HTMLIFrameElement).contentWindow as Window, "postMessage");
    window.dispatchEvent(new MessageEvent("message", { data: { type: "metaon.listenViewer.ready" } }));
    await waitFor(() => expect(postMessage).toHaveBeenCalled());
    const message = postMessage.mock.calls.at(-1)?.[0] as {
      payload?: { book?: { pages?: Array<{ bookPage?: number | string; label?: string; words?: Array<{ w?: string; t0?: number; x?: number }> }> } };
    };
    expect(message.payload?.book?.pages?.[0]).toEqual(
      expect.objectContaining({
        bookPage: "T",
        label: "속표지",
        words: [expect.objectContaining({ w: "Over", t0: 0.2, x: 0.2 })]
      })
    );
  });

  it("renders a page-based E-book when Listen E-book metadata is cached", async () => {
    vi.mocked(indexedDbStorage.listFiles).mockResolvedValue([]);
    vi.mocked(indexedDbStorage.getFileBlob).mockImplementation(async (_key, path) => {
      if (path.endsWith("info_listen_ebook.json")) {
        return new Blob(
          [
            JSON.stringify({
              version: 1,
              pages: [
                {
                  pageIndex: 0,
                  imagePath: "Lessons/L1/D1/reading/01/img/img_01.png",
                  audioPaths: ["Lessons/L1/D1/reading/01/snd/snd_01_01.mp3"],
                  captions: [
                    { pageIndex: 0, audioIndex: 0, startMs: 0, endMs: 1000, text: "First line" },
                    { pageIndex: 0, audioIndex: 0, startMs: 1000, endMs: 3000, text: "Second line" }
                  ]
                },
                {
                  pageIndex: 1,
                  imagePath: "Lessons/L1/D1/reading/01/img/img_02.png",
                  audioPaths: ["Lessons/L1/D1/reading/01/snd/snd_02_01.mp3"],
                  captions: [{ pageIndex: 1, audioIndex: 0, startMs: 0, endMs: 3000, text: "Page two" }]
                }
              ],
              fallbackVideoPaths: videoPaths
            })
          ],
          { type: "application/json" }
        );
      }
      const blob = new Blob(["asset"], { type: path.endsWith(".png") ? "image/png" : "audio/mpeg" }) as Blob & { path?: string };
      blob.path = path;
      return blob;
    });

    render(<ListeningActivity context={context} />);

    await waitFor(() =>
      expect(indexedDbStorage.getFileBlob).toHaveBeenCalledWith("book:6710", "Lessons/L1/D1/listening/01/info_listen_ebook.json")
    );
    await waitFor(() =>
      expect(indexedDbStorage.getFileBlob).toHaveBeenCalledWith("book:6710", "Lessons/L1/D1/reading/01/img/img_01.png")
    );
    const iframe = await screen.findByTitle("Listen E-book viewer");
    expect(iframe).toHaveAttribute("src", "/ebook-viewer/poc_htmljson/index.html");
    expect(iframe).toHaveAttribute("data-book-title", "GPLaa01");
    expect(iframe).toHaveAttribute("data-page-count", "2");
  });

  it("builds a Listen E-book from legacy reading resources when generated metadata is missing", async () => {
    const legacyReadingPaths = [
      "Lessons/L1/D1/reading/01/img/img_01.png",
      "Lessons/L1/D1/reading/01/snd/snd_01_01.mp3",
      "Lessons/L1/D1/reading/01/img/img_02.png",
      "Lessons/L1/D1/reading/01/snd/snd_02_01.mp3",
      "Lessons/L1/D1/reading/01/snd/snd_02_02.mp3",
      "Lessons/L1/D1/sentence/snd/snd_sentence_01.mp3",
      ...videoPaths
    ];
    vi.mocked(indexedDbStorage.listFiles).mockResolvedValue(
      legacyReadingPaths.map((path) => ({
        packageKey: "book:6710",
        path,
        blob: new Blob(["asset"]),
        size: 1,
        mimeType: path.endsWith(".png") ? "image/png" : path.endsWith(".mp3") ? "audio/mpeg" : "video/mp4"
      }))
    );
    vi.mocked(indexedDbStorage.getFileBlob).mockImplementation(async (_key, path) => {
      if (path.endsWith("info_listen_ebook.json")) return undefined;
      if (path.endsWith("sentence/info_sentence.json")) {
        return new Blob([JSON.stringify({ sentence: [{ Eng: "Legacy line", Mean: "", Slice: "", Blank_Index: -1 }] })], {
          type: "application/json"
        });
      }
      const blob = new Blob(["asset"], { type: path.endsWith(".png") ? "image/png" : path.endsWith(".mp3") ? "audio/mpeg" : "video/mp4" }) as Blob & {
        path?: string;
      };
      blob.path = path;
      return blob;
    });

    render(<ListeningActivity context={context} />);

    await waitFor(() =>
      expect(indexedDbStorage.getFileBlob).toHaveBeenCalledWith("book:6710", "Lessons/L1/D1/reading/01/img/img_01.png")
    );
    const iframe = await screen.findByTitle("Listen E-book viewer");
    expect(iframe).toHaveAttribute("data-book-title", "GPLaa01");
    expect(iframe).toHaveAttribute("data-page-count", "2");
    expect(screen.queryByLabelText("Video 1")).not.toBeInTheDocument();
  });

  it("builds sentence captions for cached multi-sentence Listen books without generated captions", async () => {
    const legacyReadingPaths = [
      "Lessons/L1/D1/reading/01/img/img_01.png",
      "Lessons/L1/D1/reading/01/snd/snd_01_01.mp3",
      "Lessons/L1/D1/reading/01/img/img_02.png",
      "Lessons/L1/D1/reading/01/snd/snd_02_02.mp3",
      "Lessons/L1/D1/reading/01/img/img_03.png",
      "Lessons/L1/D1/reading/01/snd/snd_03_01.mp3",
      "Lessons/L1/D1/reading/01/snd/snd_03_02.mp3"
    ];
    vi.mocked(indexedDbStorage.listFiles).mockResolvedValue(
      legacyReadingPaths.map((path) => ({
        packageKey: "book:7405",
        path,
        blob: new Blob(["asset"]),
        size: 1,
        mimeType: path.endsWith(".png") ? "image/png" : "audio/mpeg"
      }))
    );
    vi.mocked(indexedDbStorage.getFileBlob).mockImplementation(async (_key, path) => {
      if (path.endsWith("info_listen_ebook.json")) return undefined;
      if (path.endsWith("sentence/info_sentence.json")) {
        return new Blob(
          [
            JSON.stringify({
              sentence: [
                { Eng: "When the king died, he was given a very fancy burial.", Mean: "", Slice: "", Blank_Index: -1 },
                { Eng: "By studying ancient Egyptians, we know that they had a great culture.", Mean: "", Slice: "", Blank_Index: -1 },
                { Eng: "The preserved body was called a mummy.", Mean: "", Slice: "", Blank_Index: -1 }
              ]
            })
          ],
          { type: "application/json" }
        );
      }
      const blob = new Blob(["asset"], { type: path.endsWith(".png") ? "image/png" : "audio/mpeg" }) as Blob & { path?: string };
      blob.path = path;
      return blob;
    });

    render(<ListeningActivity context={ancientEgyptContext} />);

    await waitFor(() =>
      expect(indexedDbStorage.getFileBlob).toHaveBeenCalledWith("book:7405", "Lessons/L1/D1/sentence/info_sentence.json")
    );
    const iframe = await screen.findByTitle("Listen E-book viewer");
    expect(iframe).toHaveAttribute("data-book-title", "Ancient Egypt");
    expect(iframe).toHaveAttribute("data-page-count", "3");
    expect(screen.queryByText("Listen and follow the page.")).not.toBeInTheDocument();
  });

  it("renders a playlist when a Listen activity has multiple cached videos", async () => {
    render(<ListeningActivity context={context} />);

    expect(await screen.findByLabelText("Video 1")).toHaveAttribute("aria-current", "true");
    expect(screen.getByLabelText("Video 2")).toBeInTheDocument();
    await waitFor(() =>
      expect(indexedDbStorage.getFileBlob).toHaveBeenCalledWith("book:6710", "Lessons/L1/D1/listening/01/video/video_01.mp4")
    );

    fireEvent.click(screen.getByLabelText("Video 2"));

    expect(await screen.findByLabelText("Video 2")).toHaveAttribute("aria-current", "true");
    await waitFor(() =>
      expect(indexedDbStorage.getFileBlob).toHaveBeenCalledWith("book:6710", "Lessons/L1/D1/listening/01/video/video_02.mp4")
    );
  });
});

describe("ReadingActivity", () => {
  const playSpy = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    playSpy.mockResolvedValue(undefined);
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: playSpy
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn((blob: Blob) => `blob:${(blob as Blob & { path?: string }).path ?? "asset"}`)
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn()
    });
    vi.stubGlobal(
      "Audio",
      vi.fn(function (this: { src: string; play: () => Promise<void> }, src?: string) {
        this.src = src || "";
        this.play = playSpy;
      })
    );

    const paths = [
      "Lessons/L1/D1/reading/01/img/img_01.png",
      "Lessons/L1/D1/reading/01/snd/snd_01_01.mp3",
      "Lessons/L1/D1/word/img/word_01.png",
      "Lessons/L1/D1/word/snd/snd_word_01.mp3"
    ];
    vi.mocked(indexedDbStorage.listFiles).mockResolvedValue(
      paths.map((path) => ({
        packageKey: "book:6710",
        path,
        blob: new Blob(["asset"]),
        size: 1,
        mimeType: path.endsWith(".png") ? "image/png" : "audio/mpeg"
      }))
    );
    vi.mocked(indexedDbStorage.getFileBlob).mockImplementation(async (_key, path) => {
      if (path === "Lessons/L1/D1/word/info_word.json") {
        return new Blob([JSON.stringify({ word: [{ Eng: "over", Mean: "above", Sentence: "Over the log.", WordClass: "preposition" }] })], {
          type: "application/json"
        });
      }
      if (path.endsWith(".json")) return undefined;
      const blob = new Blob(["asset"], { type: path.endsWith(".png") ? "image/png" : "audio/mpeg" }) as Blob & { path?: string };
      blob.path = path;
      return blob;
    });
  });

  it("renders the Figma-style Read Record book and vocabulary popup", async () => {
    render(<ReadingActivity context={readingContext} />);

    expect(await screen.findByLabelText("Read Record book")).toBeInTheDocument();
    expect(await screen.findByAltText("Reading page 1")).toHaveAttribute("src", "blob:Lessons/L1/D1/reading/01/img/img_01.png");
    expect(screen.getByLabelText("Page count")).toHaveTextContent("1/1");
    expect(screen.queryByText("Reading page")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open left vocabulary popup" }));
    expect(await screen.findByText("over")).toBeInTheDocument();
    expect(screen.getByText("above")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Play over" }));
    expect(playSpy).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Play page audio" }));
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
  });
});

describe("prototype word and sentence activities", () => {
  const prototypeData: PrototypeActivityData = {
    words: [
      { index: 0, eng: "mummy", mean: "미라", sentence: "The preserved body was called a mummy.", wordClass: "noun" },
      { index: 1, eng: "culture", mean: "문화", sentence: "Ancient Egyptians had a great culture.", wordClass: "noun" },
      { index: 2, eng: "burial", mean: "매장", sentence: "The king was given a fancy burial.", wordClass: "noun" },
      { index: 3, eng: "preserved", mean: "보존된", sentence: "The preserved body was called a mummy.", wordClass: "adjective" }
    ],
    sentences: [
      {
        index: 0,
        eng: "The preserved body was called a mummy.",
        mean: "",
        slice: "The/preserved/body/was/called/a/mummy/.",
        blankIndex: 6
      }
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(indexedDbStorage.listFiles).mockResolvedValue([]);
    vi.mocked(indexedDbStorage.getFileBlob).mockResolvedValue(undefined);
  });

  it("runs Context Cloze Race with word distractors", async () => {
    render(<ContextClozeRaceActivity context={context} prototypeData={prototypeData} />);

    expect(await screen.findByLabelText("Context cloze sentence")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "mummy" }));

    expect(await screen.findByText("Correct")).toBeInTheDocument();
  });

  it("repairs a broken sentence by rebuilding the original token order", async () => {
    render(<SentenceRepairActivity context={context} prototypeData={prototypeData} />);

    expect(await screen.findByLabelText("Broken sentence")).toHaveTextContent("Broken");
    for (const token of ["The", "preserved", "body", "was", "called", "a", "mummy"]) {
      fireEvent.click(screen.getByRole("button", { name: token }));
    }

    expect(await screen.findByText("Repair complete")).toBeInTheDocument();
  });

  it("checks a typed sentence in Dictation Ladder", async () => {
    render(<DictationLadderActivity context={context} prototypeData={prototypeData} />);

    fireEvent.change(await screen.findByLabelText("Dictation answer"), {
      target: { value: "The preserved body was called a mummy" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));

    expect(await screen.findByText("Step complete")).toBeInTheDocument();
  });

  it("checks a grammar transformation answer", async () => {
    render(<GrammarTransformActivity context={context} prototypeData={prototypeData} />);

    fireEvent.change(await screen.findByLabelText("Grammar transform answer"), {
      target: { value: "The preserved body is called a mummy" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Check" }));

    expect(await screen.findByText("Transform complete")).toBeInTheDocument();
  });

  it("matches a paraphrase option", async () => {
    render(<ParaphraseMatchActivity context={context} prototypeData={prototypeData} />);

    fireEvent.click(await screen.findByRole("button", { name: "People called the preserved body a mummy." }));

    expect(await screen.findByText("Meaning matched")).toBeInTheDocument();
  });
});

describe("SpellingFishActivity", () => {
  const playSpy = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    playSpy.mockResolvedValue(undefined);
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: playSpy
    });
    Object.defineProperty(HTMLMediaElement.prototype, "pause", {
      configurable: true,
      value: vi.fn()
    });
    vi.stubGlobal(
      "Audio",
      vi.fn(function (this: { src: string; preload: string; pause: () => void; play: () => Promise<void>; currentTime: number }, src?: string) {
        this.src = src || "";
        this.preload = "";
        this.pause = vi.fn();
        this.play = playSpy;
        this.currentTime = 0;
      })
    );
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn((blob: Blob) => `blob:${(blob as Blob & { path?: string }).path ?? "asset"}`)
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn()
    });
  });

  function mockWordPackage(words: Array<{ Eng: string; Mean?: string }> = [{ Eng: "a", Mean: "letter a" }]) {
    const infoPath = "Lessons/L1/D1/word/info_word.json";
    const paths = words.flatMap((_, index) => [
      `Lessons/L1/D1/word/img/word_${String(index + 1).padStart(2, "0")}.png`,
      `Lessons/L1/D1/word/snd/snd_word_${String(index + 1).padStart(2, "0")}.mp3`
    ]);

    vi.mocked(indexedDbStorage.listFiles).mockResolvedValue(
      paths.map((path) => ({
        packageKey: "book:6710",
        path,
        blob: new Blob(["asset"]),
        size: 1,
        mimeType: path.endsWith(".png") ? "image/png" : "audio/mpeg"
      }))
    );
    vi.mocked(indexedDbStorage.getFileBlob).mockImplementation(async (_key, path) => {
      if (path === infoPath) {
        return {
          text: async () => JSON.stringify({ word: words.map((word) => ({ Eng: word.Eng, Mean: word.Mean || "", Sentence: "", WordClass: "" })) })
        } as Blob;
      }
      const blob = new Blob(["asset"], { type: path.endsWith(".png") ? "image/png" : "audio/mpeg" }) as Blob & { path?: string };
      blob.path = path;
      return blob;
    });
  }

  it("uses word package data to render an alphabet bubble game", async () => {
    mockWordPackage();

    render(<SpellingFishActivity context={underSeaContext} />);

    expect(await screen.findByLabelText("Spelling Fish game board")).toBeInTheDocument();
    fireEvent.click(await screen.findByLabelText("Letter bubble a"));

    expect(await screen.findByText("Complete")).toBeInTheDocument();
  });

  it("plays word audio from the image button", async () => {
    mockWordPackage();

    render(<SpellingFishActivity context={underSeaContext} />);

    const soundButton = await screen.findByLabelText("Play word sound");
    expect(soundButton).toBeInTheDocument();

    await waitFor(() =>
      expect(document.querySelector(".undersea-hint-card audio")).toHaveAttribute("src", "blob:Lessons/L1/D1/word/snd/snd_word_01.mp3")
    );
  });

  it("pans the ocean background when the fish moves horizontally", async () => {
    mockWordPackage();

    render(<SpellingFishActivity context={underSeaContext} />);

    const board = await screen.findByLabelText("Spelling Fish game board");
    Object.defineProperty(board, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ left: 0, top: 0, width: 1000, height: 600, right: 1000, bottom: 600, x: 0, y: 0, toJSON: () => ({}) })
    });
    Object.defineProperty(board, "setPointerCapture", { configurable: true, value: vi.fn() });
    Object.defineProperty(board, "hasPointerCapture", { configurable: true, value: vi.fn(() => true) });
    Object.defineProperty(board, "releasePointerCapture", { configurable: true, value: vi.fn() });

    expect(board).toHaveStyle({ "--undersea-pan": "-13.44%" });
    const answerBubble = await screen.findByLabelText("Letter bubble a");
    const initialBubbleX = Number.parseFloat(answerBubble.style.left);

    const pointerDown = new MouseEvent("pointerdown", { bubbles: true, clientX: 900, clientY: 420 });
    Object.defineProperty(pointerDown, "pointerId", { configurable: true, value: 1 });
    fireEvent(board, pointerDown);

    await waitFor(() => expect(board).toHaveStyle({ "--undersea-pan": "16.8%" }));
    expect(Number.parseFloat(answerBubble.style.left)).toBeLessThan(initialBubbleX);
  });

  it("flips the fish direction when moving left", async () => {
    mockWordPackage();

    render(<SpellingFishActivity context={underSeaContext} />);

    const board = await screen.findByLabelText("Spelling Fish game board");
    Object.defineProperty(board, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ left: 0, top: 0, width: 1000, height: 600, right: 1000, bottom: 600, x: 0, y: 0, toJSON: () => ({}) })
    });
    Object.defineProperty(board, "setPointerCapture", { configurable: true, value: vi.fn() });
    Object.defineProperty(board, "hasPointerCapture", { configurable: true, value: vi.fn(() => true) });
    Object.defineProperty(board, "releasePointerCapture", { configurable: true, value: vi.fn() });

    const fish = board.querySelector(".undersea-fish") as HTMLElement;
    expect(fish).toHaveStyle({ "--undersea-fish-facing": "1" });

    const pointerDown = new MouseEvent("pointerdown", { bubbles: true, clientX: 900, clientY: 420 });
    Object.defineProperty(pointerDown, "pointerId", { configurable: true, value: 1 });
    fireEvent(board, pointerDown);
    await waitFor(() => expect(fish).toHaveStyle({ "--undersea-fish-facing": "1" }));

    const pointerMoveLeft = new MouseEvent("pointermove", { bubbles: true, clientX: 100, clientY: 420 });
    Object.defineProperty(pointerMoveLeft, "pointerId", { configurable: true, value: 1 });
    fireEvent(board, pointerMoveLeft);

    await waitFor(() => expect(fish).toHaveStyle({ "--undersea-fish-facing": "-1" }));
  });

  it("keeps Retry and the same-activity next question control interactive", async () => {
    mockWordPackage([
      { Eng: "a", Mean: "letter a" },
      { Eng: "b", Mean: "letter b" }
    ]);

    render(<SpellingFishActivity context={underSeaContext} />);

    fireEvent.click(await screen.findByLabelText("Letter bubble a"));
    expect(await screen.findByText("Correct")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.queryByText("Correct")).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Next question" }));
    expect(await screen.findByText("2 / 2")).toBeInTheDocument();
  });
});
