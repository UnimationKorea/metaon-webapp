import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { indexedDbStorage } from "../../services/indexedDbStorage";
import { ActType, type ActivityRendererContext } from "../../types/metaonTypes";
import {
  MatchingGameActivity,
  MemoryGameActivity,
  SentenceBlankActivity,
  SentenceUnscrambleActivity,
  VocaQuizActivity,
  WordBlankActivity,
  WordSearchActivity
} from "./PackageActivities";

vi.mock("../../services/indexedDbStorage", () => ({
  indexedDbStorage: {
    getPackage: vi.fn(),
    savePackage: vi.fn(),
    listPackages: vi.fn(),
    listFiles: vi.fn(),
    getFileBlob: vi.fn(),
    deletePackage: vi.fn()
  }
}));

const packageKey = "book:renewal-fixture";
const basePath = "Lessons/L1/D1";
const words = [
  { Word_Idx: 101, Eng: "bridge", Mean: "다리", Sentence: "The bridge is strong.", WordClass: "noun" },
  { Word_Idx: 102, Eng: "river", Mean: "강", Sentence: "A river runs below.", WordClass: "noun" },
  { Word_Idx: 103, Eng: "rock", Mean: "바위", Sentence: "The rock is heavy.", WordClass: "noun" },
  { Word_Idx: 104, Eng: "wood", Mean: "나무", Sentence: "Wood floats on water.", WordClass: "noun" },
  { Word_Idx: 105, Eng: "strong", Mean: "튼튼한", Sentence: "It is strong.", WordClass: "adjective" },
  { Word_Idx: 106, Eng: "water", Mean: "물", Sentence: "Water moves quickly.", WordClass: "noun" }
];
const sentences = [
  {
    Sentence_Idx: 201,
    Eng: "Let's use rocks to see how strong each bridge is.",
    Mean: "돌을 사용해 각각의 다리가 얼마나 튼튼한지 살펴봅시다.",
    Slice: "Let's/use/rocks/to/see/how/strong/each/bridge/is/.",
    Blank_Index: 6
  }
];

function activityContext(
  actType: ActType,
  activityCode: string,
  raw?: Record<string, unknown>
): ActivityRendererContext {
  return {
    packageMeta: {
      key: packageKey,
      source: "metaon3-resources",
      bookIdx: 9001,
      bookId: "FIGMA01",
      seriesGroup: 1,
      seriesIdx: 1,
      downloadedAt: "2026-07-10T00:00:00.000Z",
      totalFiles: 15,
      totalBytes: 15,
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
      id: activityCode,
      actIdx: 3001,
      dayIdx: 1,
      activityCode,
      actType,
      title: activityCode,
      actNum: 0,
      category: actType === ActType.SentenceCheckSpace || actType === ActType.SentenceUnscrambleSpace ? "sentence" : "word",
      params: ["0"],
      raw
    }
  };
}

function mockRenewalPackage(sentenceRecords = sentences) {
  const wordInfoPath = `${basePath}/word/info_word.json`;
  const sentenceInfoPath = `${basePath}/sentence/info_sentence.json`;
  const paths = [
    wordInfoPath,
    sentenceInfoPath,
    ...words.flatMap((word, index) => [
      `${basePath}/word/img/word_${String(index + 1).padStart(2, "0")}.png`,
      `${basePath}/word/snd/snd_word_${String(index + 1).padStart(2, "0")}.mp3`
    ]),
    `${basePath}/sentence/snd/snd_sentence_01.mp3`
  ];

  vi.mocked(indexedDbStorage.listFiles).mockResolvedValue(
    paths.map((path) => ({
      packageKey,
      path,
      blob: new Blob([path]),
      size: path.length,
      mimeType: path.endsWith(".json") ? "application/json" : path.endsWith(".png") ? "image/png" : "audio/mpeg"
    }))
  );
  vi.mocked(indexedDbStorage.getFileBlob).mockImplementation(async (_key, path) => {
    if (path === wordInfoPath) return new Blob([JSON.stringify({ word: words })], { type: "application/json" });
    if (path === sentenceInfoPath) return new Blob([JSON.stringify({ sentence: sentenceRecords })], { type: "application/json" });
    const blob = new Blob([path]) as Blob & { path?: string };
    blob.path = path;
    return blob;
  });
}

function matchVisibleMemoryPairs(container: HTMLElement) {
  const wordFaces = Array.from(container.querySelectorAll<HTMLElement>(".memory-renewal-card-front strong"));
  for (const face of wordFaces) {
    const word = face.textContent || "";
    const wordCard = face.closest("button");
    const imageCard = container.querySelector(`.memory-renewal-card-front img[alt="${word}"]`)?.closest("button");
    expect(wordCard).not.toBeNull();
    expect(imageCard).not.toBeNull();
    fireEvent.click(wordCard as HTMLButtonElement);
    fireEvent.click(imageCard as HTMLButtonElement);
  }
}

describe("Figma renewal activities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn((blob: Blob & { path?: string }) => `blob:${blob.path || "resource"}`)
    });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined)
    });
    Object.defineProperty(HTMLMediaElement.prototype, "pause", { configurable: true, value: vi.fn() });
    mockRenewalPackage();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("renders WDQU01 as a spaced spelling question with an underline blank", async () => {
    const { container } = render(
      <VocaQuizActivity context={activityContext(ActType.VocaQuizSpace, "WDQU01", { quiz_type: 1 })} />
    );

    const shell = container.querySelector(".voca-quiz-renewal-shell");
    await waitFor(() => expect(shell).toHaveAttribute("data-quiz-mode", "spelling-letter"));
    const spelling = container.querySelector<HTMLElement>(".voca-quiz-spelling-word");
    await waitFor(() => expect(spelling).toHaveAttribute("data-answer", "bridge"));
    expect(container.querySelector(".voca-quiz-spelling-media img")).toBeInTheDocument();
    expect(spelling?.querySelectorAll(".voca-quiz-spelling-letter")).toHaveLength(6);
    expect(spelling?.querySelectorAll(".voca-quiz-spelling-letter.is-blank")).toHaveLength(1);
    const textOptions = Array.from(container.querySelectorAll<HTMLElement>(".voca-quiz-spelling-options .voca-quiz-spelling-option-text"));
    expect(textOptions).toHaveLength(4);
    textOptions.forEach((option) => expect(option).toHaveAttribute("data-fit-single-line", "true"));
    const textOptionGroup = container.querySelector(".voca-quiz-spelling-options");
    expect(textOptionGroup).toHaveAttribute("data-uniform-fit-group", "true");
    textOptions.forEach((option, optionIndex) => {
      Object.defineProperty(option, "clientWidth", { configurable: true, value: 100 });
      Object.defineProperty(option, "scrollWidth", {
        configurable: true,
        get: () => (Number.parseFloat(option.style.fontSize) || 32) * (optionIndex === 0 ? 8 : 2)
      });
    });
    fireEvent(window, new Event("resize"));
    await waitFor(() => {
      const fittedSizes = textOptions.map((option) => option.style.fontSize);
      expect(new Set(fittedSizes).size).toBe(1);
      expect(Number.parseFloat(fittedSizes[0])).toBeLessThan(32);
    });
    expect(screen.getByLabelText("Question 1 of 6")).toHaveTextContent(/^1\/6$/);

    const answer = spelling?.getAttribute("data-answer") || "";
    const blank = spelling?.querySelector<HTMLElement>(".voca-quiz-spelling-letter.is-blank");
    const expectedLetter = answer[(Array.from(spelling?.children || []).indexOf(blank as HTMLSpanElement))];
    fireEvent.click(screen.getByRole("button", { name: `Choose ${expectedLetter}` }));
    expect(spelling?.classList).toContain("is-complete");
    expect(spelling?.querySelector(".voca-quiz-spelling-letter.is-blank")).toBeNull();
    expect(spelling).toHaveTextContent("bridge");

    const nextQuestion = screen.getByRole("button", { name: "Next question" });
    expect(nextQuestion.querySelector("img")).toHaveAttribute(
      "src",
      "/metaon-assets/activity/common-controls/btn-page-next.png"
    );
    fireEvent.click(nextQuestion);
    expect(await screen.findByLabelText("Question 2 of 6")).toBeInTheDocument();
    expect(await screen.findByRole("img", { name: "river" })).toBeInTheDocument();
  });

  it("renders WDQU02 as the Figma Word Search image-to-word quiz", async () => {
    const { container } = render(
      <WordSearchActivity context={activityContext(ActType.WordSearch, "WDQU02")} />
    );

    await waitFor(() => expect(container.querySelectorAll(".word-search-options button")).toHaveLength(3));
    expect(container.querySelector(".word-search-renewal-shell")).toBeInTheDocument();
    expect(screen.getByLabelText("Question 1 of 6")).toHaveTextContent(/^1\/6$/);
    expect(screen.getByRole("button", { name: "Play bridge" }).querySelector("img")).toHaveAttribute(
      "src",
      "/metaon-assets/activity/figma-renewal/word-search-sound.png"
    );
    expect(container.querySelector(".word-search-prompt img")).toHaveAttribute("alt", "bridge");
    expect(container.querySelector(".word-search-answer-slot")).toHaveTextContent("Choose the word");

    fireEvent.click(screen.getByRole("button", { name: "Answer bridge" }));
    expect(container.querySelector(".word-search-answer-slot")).toHaveTextContent("bridge");
    expect(screen.getByRole("button", { name: "Answer bridge" })).toHaveClass("is-correct");
  });

  it("renders Voca Quiz with a text prompt and image choices", async () => {
    const { container } = render(
      <VocaQuizActivity context={activityContext(ActType.VocaQuiz, "4", { quiz_type: 0 })} />
    );

    await waitFor(() => expect(container.querySelectorAll(".voca-quiz-options.is-image img")).toHaveLength(4));
    expect(container.querySelector(".voca-quiz-renewal-shell")).toHaveAttribute("data-quiz-mode", "text-image");
    expect(container.querySelector(".voca-quiz-prompt .voca-quiz-fit-text"))
      .toHaveTextContent("bridge");
    expect(container.querySelector(".voca-quiz-prompt .voca-quiz-fit-text"))
      .toHaveAttribute("data-fit-single-line", "true");
    container.querySelectorAll(".voca-quiz-options.is-image img").forEach((image) => {
      expect(image.closest(".voca-quiz-option")).toBeInTheDocument();
    });
  });

  it("keeps the Word Blank slot inline with its surrounding letters", async () => {
    const { container } = render(
      <WordBlankActivity context={activityContext(ActType.VocaCheckSpace, "WDBL01")} />
    );

    await waitFor(() => expect(container.querySelectorAll(".word-blank-renewal-options button")).toHaveLength(4));
    expect(screen.getByRole("button", { name: "Play bridge" }).querySelector("img")).toHaveAttribute(
      "src",
      "/metaon-assets/activity/common-controls/listening.png"
    );
    const word = container.querySelector(".word-blank-renewal-word");
    expect(word).toBeInTheDocument();
    expect(word?.children).toHaveLength(3);
    expect(word?.querySelector(".renewal-blank")).toBeInTheDocument();
    expect(container.querySelectorAll(".word-blank-renewal-options button")).toHaveLength(4);
    expect(container.querySelectorAll(".word-blank-renewal-options [data-uniform-fit-text='true']")).toHaveLength(4);
  });

  it("aligns five English words with five Korean meaning choices", async () => {
    const { container } = render(
      <MatchingGameActivity context={activityContext(ActType.MatchingGame, "WDPL01")} />
    );

    const timer = screen.getByLabelText("60 seconds remaining");
    expect(timer).toHaveClass("is-framed");
    expect(timer.querySelector(".activity-timer-frame")).toHaveAttribute(
      "src",
      "/metaon-assets/activity/common-controls/timer_frame.png"
    );
    expect(timer.querySelector(".activity-timer-watch")).toHaveAttribute(
      "src",
      "/metaon-assets/activity/common-controls/watch.png"
    );
    expect(await screen.findByRole("button", { name: "bridge" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다리" })).toBeInTheDocument();
    const columns = container.querySelectorAll(".matching-renewal-column");
    expect(columns).toHaveLength(2);
    expect(columns[0].querySelectorAll("button")).toHaveLength(5);
    expect(columns[1].querySelectorAll("button")).toHaveLength(5);
    expect(container.querySelectorAll(".matching-renewal-board [data-uniform-fit-text='true']")).toHaveLength(10);
  });

  it("uses the configured card count and timer for every Memory Card round", async () => {
    const { container } = render(
      <MemoryGameActivity context={activityContext(ActType.MemoryGame, "WDPL02")} />
    );

    expect(await screen.findByText("ROUND 1 / 4")).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole("button", { name: /Open memory card/ })).toHaveLength(4));
    expect(container.querySelector(".memory-renewal-shell")).toHaveAttribute("data-time-limit", "7");
    expect(screen.getByLabelText("7 seconds remaining")).toHaveTextContent("00:07");
    const timer = screen.getByLabelText("7 seconds remaining");
    expect(timer).toHaveClass("is-framed");
    expect(timer.querySelector(".activity-timer-frame")).toHaveAttribute(
      "src",
      "/metaon-assets/activity/common-controls/timer_frame.png"
    );
    expect(timer.querySelector(".activity-timer-watch")).toHaveAttribute(
      "src",
      "/metaon-assets/activity/common-controls/watch.png"
    );
    expect(screen.getByRole("button", { name: "Hint" }).querySelector("img")).toHaveAttribute(
      "src",
      "/metaon-assets/activity/common-controls/hint.png"
    );
    expect(screen.getAllByRole("button", { name: /Open memory card/ })).toHaveLength(4);

    const wordFaces = Array.from(container.querySelectorAll<HTMLElement>(".memory-renewal-card-front strong"));
    expect(wordFaces).toHaveLength(2);
    wordFaces.forEach((face) => expect(face).toHaveAttribute("data-uniform-fit-text", "true"));
    matchVisibleMemoryPairs(container);

    expect(await screen.findByText("Round clear!")).toBeInTheDocument();
    expect(await screen.findByText("ROUND 2 / 4", {}, { timeout: 1600 })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Open memory card/ })).toHaveLength(6);
    expect(container.querySelector(".memory-renewal-shell")).toHaveAttribute("data-time-limit", "10");
    expect(screen.getByLabelText("10 seconds remaining")).toHaveTextContent("00:10");

    matchVisibleMemoryPairs(container);
    expect(await screen.findByText("ROUND 3 / 4", {}, { timeout: 1600 })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Open memory card/ })).toHaveLength(8);
    expect(container.querySelector(".memory-renewal-shell")).toHaveAttribute("data-time-limit", "20");
    expect(screen.getByLabelText("20 seconds remaining")).toHaveTextContent("00:20");

    matchVisibleMemoryPairs(container);
    expect(await screen.findByText("ROUND 4 / 4", {}, { timeout: 1600 })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Open memory card/ })).toHaveLength(12);
    expect(container.querySelector(".memory-renewal-shell")).toHaveAttribute("data-time-limit", "40");
    expect(screen.getByLabelText("40 seconds remaining")).toHaveTextContent("00:40");
  }, 8_000);

  it("ends Memory Card when round one expires and restarts from round one", async () => {
    vi.useFakeTimers();
    render(<MemoryGameActivity context={activityContext(ActType.MemoryGame, "WDPL02")} />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText("ROUND 1 / 4")).toBeInTheDocument();

    for (let second = 0; second < 8; second += 1) {
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
    }

    expect(screen.getByText("Round 1 time out")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /처음부터 다시하기/ }));
    expect(screen.getByText("ROUND 1 / 4")).toBeInTheDocument();
    expect(screen.getByLabelText("7 seconds remaining")).toHaveTextContent("00:07");
  });

  it("renders Sentence Blank as one sentence with an inline answer slot", async () => {
    const { container } = render(
      <SentenceBlankActivity context={activityContext(ActType.SentenceCheckSpace, "STBL01")} />
    );

    expect(await screen.findByLabelText("Sentence with blank")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play sentence 1" }).querySelector("img")).toHaveAttribute(
      "src",
      "/metaon-assets/activity/common-controls/sound.png"
    );
    await waitFor(() => expect(container.querySelector(".sentence-renewal-question p")).toBeInTheDocument());
    const sentence = container.querySelector(".sentence-renewal-question p");
    expect(sentence?.children).toHaveLength(3);
    expect(sentence?.querySelector(".renewal-sentence-blank")).toBeInTheDocument();
    expect(container.querySelectorAll(".sentence-renewal-options button")).toHaveLength(4);
    const optionTexts = container.querySelectorAll(".sentence-renewal-options .sentence-blank-option-text");
    expect(optionTexts).toHaveLength(4);
    optionTexts.forEach((option) => expect(option).toHaveAttribute("data-fit-single-line", "true"));
    expect(container.querySelector(".sentence-renewal-options")).toHaveAttribute("data-uniform-fit-group", "true");
    const previous = screen.getByRole("button", { name: "Previous question" });
    const next = screen.getByRole("button", { name: "Next question" });
    expect(previous.closest(".sentence-blank-renewal-shell")).not.toBeNull();
    expect(next.closest(".sentence-blank-renewal-shell")).not.toBeNull();
    expect(previous.closest(".sentence-renewal-panel")).toBeNull();
    expect(next.closest(".sentence-renewal-panel")).toBeNull();
  });

  it("uses bracketed Slice content when the API does not provide a blank index", async () => {
    mockRenewalPackage([
      { Sentence_Idx: 7618, Eng: "Over the log.", Mean: "통나무 위로 폴짝.", Slice: "Over/[the log].", Blank_Index: -1 },
      { Sentence_Idx: 7619, Eng: "Over the pot.", Mean: "냄비 위로 폴짝.", Slice: "Over/[the pot].", Blank_Index: -1 },
      { Sentence_Idx: 7620, Eng: "Over the bike.", Mean: "자전거 위로 폴짝.", Slice: "Over/[the bike.]", Blank_Index: -1 },
      { Sentence_Idx: 7621, Eng: "Over the bat.", Mean: "방망이 위로 폴짝.", Slice: "Over/[the bat.]", Blank_Index: -1 }
    ]);

    const { container } = render(<SentenceBlankActivity context={activityContext(ActType.SentenceCheckSpace, "STBL01")} />);

    expect(await screen.findByText("Over")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "the log" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "the pot" })).toBeInTheDocument();
    expect(container.querySelector(".sentence-renewal-question .is-punctuation")).toHaveTextContent(".");
    const optionLabels = Array.from(container.querySelectorAll(".sentence-renewal-options button"), (button) => button.textContent || "");
    expect(optionLabels.every((label) => !label.includes("[") && !label.includes("]") && !label.includes("."))).toBe(true);
    expect(screen.queryByText("No sentence data.")).not.toBeInTheDocument();
  });

  it("keeps fixed sentence text around the Sentence Unscramble slots", async () => {
    mockRenewalPackage([
      {
        ...sentences[0],
        Slice: "to/see/how/strong/each",
        Blank_Index: 0
      }
    ]);
    const { container } = render(
      <SentenceUnscrambleActivity context={activityContext(ActType.SentenceUnscrambleSpace, "STSC01")} />
    );

    expect(await screen.findByLabelText("Built sentence")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play sentence 1" }).querySelector("img")).toHaveAttribute(
      "src",
      "/metaon-assets/activity/common-controls/sound.png"
    );
    await waitFor(() => expect(container.querySelectorAll(".unscramble-renewal-slot")).toHaveLength(5));
    expect(screen.getByText("Let's")).toBeInTheDocument();
    expect(screen.getByText("bridge")).toBeInTheDocument();
    expect(container.querySelector(".unscramble-renewal-workspace")).toContainElement(
      container.querySelector(".unscramble-renewal-sentence")
    );
    expect(container.querySelector(".unscramble-renewal-workspace")).toContainElement(
      container.querySelector(".unscramble-renewal-bank")
    );
    expect(container.querySelectorAll(".unscramble-renewal-bank button")).toHaveLength(5);
    const previous = screen.getByRole("button", { name: "Previous question" });
    const next = screen.getByRole("button", { name: "Next question" });
    expect(previous.closest(".unscramble-renewal-shell")).not.toBeNull();
    expect(next.closest(".unscramble-renewal-shell")).not.toBeNull();
    expect(previous.closest(".sentence-renewal-panel")).toBeNull();
    expect(next.closest(".sentence-renewal-panel")).toBeNull();
  });

  it("limits long Sentence Unscramble questions to ten choices and prefills the remaining words", async () => {
    mockRenewalPackage([
      {
        Sentence_Idx: 7622,
        Eng: "When the storm finally ended the children carefully carried their supplies across the old wooden bridge together.",
        Mean: "폭풍이 끝나자 아이들은 물품을 함께 옮겼습니다.",
        Slice: "When/the/storm/finally/ended/the/children/carefully/carried/their/supplies/across/the/old/wooden/bridge/together/.",
        Blank_Index: 0
      }
    ]);
    const { container } = render(
      <SentenceUnscrambleActivity context={activityContext(ActType.SentenceUnscrambleSpace, "STSC01")} />
    );

    await waitFor(() => expect(container.querySelectorAll(".unscramble-renewal-slot")).toHaveLength(10));
    expect(container.querySelectorAll(".unscramble-renewal-bank button")).toHaveLength(10);
    expect(container.querySelectorAll(".unscramble-renewal-bank [data-uniform-fit-text='true']")).toHaveLength(10);
    await waitFor(() => {
      const fittedSize = Number(container.querySelector(".unscramble-renewal-bank")?.getAttribute("data-uniform-fit-size"));
      expect(fittedSize).toBeGreaterThan(0);
      expect(fittedSize).toBeLessThanOrEqual(26);
    });
    const builtSentence = screen.getByLabelText("Built sentence");
    expect(builtSentence).toHaveTextContent("supplies");
    expect(builtSentence).toHaveTextContent("together");
    expect(screen.queryByRole("button", { name: "supplies" })).not.toBeInTheDocument();
  });

  it("removes Slice bracket markers from Sentence Unscramble choices", async () => {
    mockRenewalPackage([
      { Sentence_Idx: 7618, Eng: "Over the log.", Mean: "통나무 위로 폴짝.", Slice: "Over/[the log].", Blank_Index: -1 }
    ]);
    const { container } = render(
      <SentenceUnscrambleActivity context={activityContext(ActType.SentenceUnscrambleSpace, "STSC01")} />
    );

    await waitFor(() => expect(container.querySelectorAll(".unscramble-renewal-bank button")).toHaveLength(2));
    const choiceLabels = Array.from(container.querySelectorAll(".unscramble-renewal-bank button"), (button) => button.textContent || "");
    expect(choiceLabels).toContain("the log");
    expect(choiceLabels.every((label) => !label.includes("[") && !label.includes("]") && !label.includes("."))).toBe(true);
    expect(container.querySelector(".unscramble-renewal-sentence .is-punctuation")).toHaveTextContent(".");
  });
});
