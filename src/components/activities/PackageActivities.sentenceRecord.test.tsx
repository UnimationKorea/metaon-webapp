import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bffRecognitionPort } from "../../ports/bffRecognitionPort";
import { browserRecorderPort } from "../../ports/browserRecorderPort";
import { indexedDbStorage } from "../../services/indexedDbStorage";
import { ActType, type ActivityRendererContext } from "../../types/metaonTypes";
import { SentenceRecordActivity } from "./PackageActivities";

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

vi.mock("../../ports/browserRecorderPort", () => ({
  browserRecorderPort: {
    isRecording: vi.fn(),
    requestPermission: vi.fn(),
    start: vi.fn(),
    stop: vi.fn()
  }
}));

vi.mock("../../ports/bffRecognitionPort", () => ({
  bffRecognitionPort: {
    recognizeSpeech: vi.fn(),
    recognizeHandwriting: vi.fn()
  }
}));

vi.mock("../../api/uniplanetApi", () => ({
  uploadLearnRecording: vi.fn()
}));

const packageKey = "book:sentence-record-fixture";
const sentenceInfoPath = "Lessons/L1/D1/sentence/info_sentence.json";
const sentenceAudioPath = "Lessons/L1/D1/sentence/snd/snd_sentence_01.mp3";

const context: ActivityRendererContext = {
  packageMeta: {
    key: packageKey,
    source: "metaon3-resources",
    bookIdx: 9001,
    bookId: "FIGMA01",
    seriesGroup: 1,
    seriesIdx: 1,
    downloadedAt: "2026-07-13T00:00:00.000Z",
    totalFiles: 2,
    totalBytes: 2,
    lessonDays: []
  },
  day: {
    id: "1",
    dayIdx: 1,
    lesson: 1,
    day: 1,
    title: "Day 1",
    activities: []
  },
  activity: {
    id: "STRC01",
    actIdx: 3001,
    dayIdx: 1,
    activityCode: "STRC01",
    actType: ActType.SentenceShadowingSpace,
    title: "Sentence Record",
    actNum: 0,
    category: "sentence",
    params: ["0"]
  }
};

describe("Sentence Record Figma renewal", () => {
  let recording = false;

  beforeEach(() => {
    vi.clearAllMocks();
    recording = false;
    vi.mocked(browserRecorderPort.isRecording).mockImplementation(() => recording);
    vi.mocked(browserRecorderPort.start).mockImplementation(async () => {
      recording = true;
    });
    vi.mocked(browserRecorderPort.stop).mockImplementation(async () => {
      recording = false;
      return new Blob(["recorded voice"], { type: "audio/webm" });
    });
    vi.mocked(bffRecognitionPort.recognizeSpeech).mockResolvedValue({ resultCode: 1 });
    vi.mocked(indexedDbStorage.listFiles).mockResolvedValue([
      { packageKey, path: sentenceInfoPath, blob: new Blob(), size: 1, mimeType: "application/json" },
      { packageKey, path: sentenceAudioPath, blob: new Blob(), size: 1, mimeType: "audio/mpeg" }
    ]);
    vi.mocked(indexedDbStorage.getFileBlob).mockImplementation(async (_key, path) => {
      if (path === sentenceInfoPath) {
        return new Blob([
          JSON.stringify({
            sentence: [
              {
                Sentence_Idx: 201,
                Eng: "Let's use rocks to see how strong each bridge is.",
                Mean: "돌을 사용해 각각의 다리가 얼마나 튼튼한지 살펴봅시다.",
                Slice: "Let's/use/rocks/to/see/how/strong/each/bridge/is/.",
                Blank_Index: 6
              }
            ]
          })
        ], { type: "application/json" });
      }
      const blob = new Blob([path], { type: "audio/mpeg" }) as Blob & { path?: string };
      blob.path = path;
      return blob;
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn((blob: Blob & { path?: string }) => `blob:${blob.path || "recording"}`)
    });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined)
    });
    Object.defineProperty(HTMLMediaElement.prototype, "pause", { configurable: true, value: vi.fn() });
  });

  afterEach(() => cleanup());

  it("moves from native voice to recording and recorded voice playback", async () => {
    const { container } = render(<SentenceRecordActivity context={context} />);

    expect(await screen.findByText("Speed: Normal")).toBeInTheDocument();
    expect(screen.getByText("Difficulty: Normal")).toBeInTheDocument();
    expect(screen.getByText("Let's use rocks to see how")).toBeInTheDocument();
    expect(screen.getByLabelText("Missing word")).toBeInTheDocument();
    expect(screen.getByText("each bridge is.")).toBeInTheDocument();
    expect(screen.getByLabelText("Question 1 of 1")).toHaveTextContent(/^1\/1$/);
    expect(container.querySelector(".sentence-record-renewal-shell")).toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", { name: "Play native voice" }));
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);

    const nativeAudio = container.querySelector<HTMLAudioElement>(`.sentence-record-renewal-panel audio[src="blob:${sentenceAudioPath}"]`);
    expect(nativeAudio).not.toBeNull();
    fireEvent.ended(nativeAudio!);

    fireEvent.click(screen.getByRole("button", { name: "Start recording" }));
    await waitFor(() => expect(browserRecorderPort.start).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Stop recording" })).toBeInTheDocument();
    expect(container.querySelector(".sentence-record-waveform")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Stop recording" }));
    await waitFor(() => expect(browserRecorderPort.stop).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("button", { name: "Play my recording" })).toBeInTheDocument();
    expect(bffRecognitionPort.recognizeSpeech).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".sentence-record-step-check.is-complete")).toBeInTheDocument();
  });

  it("keeps the default prompt size and left-aligns only after the sentence wraps", async () => {
    const { container } = render(<SentenceRecordActivity context={context} />);
    const prompt = await waitFor(() => {
      const element = container.querySelector<HTMLElement>(".sentence-record-prompt");
      expect(element).not.toBeNull();
      return element!;
    });

    expect(prompt).not.toHaveAttribute("data-fit-single-line");
    expect(prompt.style.fontSize).toBe("");

    const blank = screen.getByLabelText("Missing word");
    expect(blank.previousSibling?.nodeType).toBe(Node.TEXT_NODE);
    expect(blank.previousSibling?.textContent).toBe(" ");
    expect(blank.nextSibling?.nodeType).toBe(Node.TEXT_NODE);
    expect(blank.nextSibling?.textContent).toBe(" ");
    expect(blank.nextSibling?.nextSibling?.textContent).toBe("each bridge is.");

    Object.defineProperty(prompt, "scrollHeight", { configurable: true, value: 120 });
    window.dispatchEvent(new Event("resize"));

    await waitFor(() => expect(prompt).toHaveClass("is-wrapped"));
  });

  it("renders STRC02 in the shared video frame with its cached background video", async () => {
    const backgroundVideoPath = "Lessons/L1/D1/strc02/video/record-loop.mp4";
    vi.mocked(indexedDbStorage.listFiles).mockResolvedValue([
      { packageKey, path: sentenceInfoPath, blob: new Blob(), size: 1, mimeType: "application/json" },
      { packageKey, path: sentenceAudioPath, blob: new Blob(), size: 1, mimeType: "audio/mpeg" },
      { packageKey, path: backgroundVideoPath, blob: new Blob(), size: 1, mimeType: "video/mp4" }
    ]);
    const videoContext: ActivityRendererContext = {
      ...context,
      activity: { ...context.activity!, id: "STRC02", activityCode: "STRC02" }
    };

    const { container } = render(<SentenceRecordActivity context={videoContext} />);
    const video = await waitFor(() => {
      const element = container.querySelector<HTMLVideoElement>(".strc02-background-video");
      expect(element).toBeInTheDocument();
      return element;
    });

    expect(video).toHaveAttribute("loop");
    expect(video?.muted).toBe(true);
    expect(video).toHaveAttribute("playsinline");
    expect(container.querySelector(".strc02-video-sentence-record-shell")).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Page 1 of 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous question" }).querySelector(".video-activity-page-arrow")).toBeInTheDocument();

    fireEvent.error(video as HTMLVideoElement);
    expect(container.querySelector(".strc02-video-sentence-record-shell")).toHaveClass("is-video-background-unavailable");
  });
});
