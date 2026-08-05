import { describe, expect, it } from "vitest";
import { ActType } from "../types/metaonTypes";
import {
  MetaOnActivityCode,
  activityTitleForCode,
  canonicalActivityCodeForActType,
  resolveActTypeFromActivityCode
} from "./activityCodes";

describe("MetaOn activity code mapping", () => {
  it.each([
    [MetaOnActivityCode.ListenRead, ActType.Listening, "Listen & Read"],
    [MetaOnActivityCode.WordCard, ActType.FlashCardSpace, "Word Card"],
    [MetaOnActivityCode.WordQuiz, ActType.VocaQuizSpace, "Word Quiz"],
    [MetaOnActivityCode.WordSearch, ActType.WordSearch, "Word Search"],
    [MetaOnActivityCode.WordBlank, ActType.VocaCheckSpace, "Word Blank"],
    [MetaOnActivityCode.WriteWord, ActType.WriteWord, "Write Word"],
    [MetaOnActivityCode.MatchingGame, ActType.MatchingGame, "Matching Game"],
    [MetaOnActivityCode.MemoryCard, ActType.MemoryGame, "Memory Card"],
    [MetaOnActivityCode.SentenceBlank, ActType.SentenceCheckSpace, "Sentence Blank"],
    [MetaOnActivityCode.Unscramble, ActType.SentenceUnscrambleSpace, "Unscramble"],
    [MetaOnActivityCode.SentenceRecord, ActType.SentenceShadowingSpace, "Sentence Record"],
    [MetaOnActivityCode.Movie, ActType.MoviePlay, "Movie"],
    [MetaOnActivityCode.QuickCheck, ActType.QuickCheck, "Quick Check"]
  ])("maps %s to renderer type %s", (activityCode, actType, title) => {
    expect(resolveActTypeFromActivityCode(activityCode)).toBe(actType);
    expect(canonicalActivityCodeForActType(actType)).toBe(activityCode);
    expect(activityTitleForCode(activityCode, "Fallback")).toBe(title);
  });

  it("keeps old numeric codes compatible while exposing new codes", () => {
    expect(resolveActTypeFromActivityCode("1004")).toBe(ActType.VocaQuizSpace);
    expect(canonicalActivityCodeForActType(ActType.VocaQuizSpace, "1004")).toBe(MetaOnActivityCode.WordQuiz);
  });

  it("maps WDCA02 to the Word Card renderer while preserving the video-card code from Book data", () => {
    expect(resolveActTypeFromActivityCode(MetaOnActivityCode.VideoWordCard)).toBe(ActType.FlashCardSpace);
    expect(canonicalActivityCodeForActType(ActType.FlashCardSpace, MetaOnActivityCode.VideoWordCard))
      .toBe(MetaOnActivityCode.VideoWordCard);
    expect(activityTitleForCode(MetaOnActivityCode.VideoWordCard, "Fallback")).toBe("Word Card");
  });

  it("maps WDQU03 to the existing Word Quiz renderer while preserving the video-quiz code from Book data", () => {
    expect(resolveActTypeFromActivityCode(MetaOnActivityCode.VideoWordQuiz)).toBe(ActType.VocaQuizSpace);
    expect(canonicalActivityCodeForActType(ActType.VocaQuizSpace, MetaOnActivityCode.VideoWordQuiz))
      .toBe(MetaOnActivityCode.VideoWordQuiz);
    expect(activityTitleForCode(MetaOnActivityCode.VideoWordQuiz, "Fallback")).toBe("Word Quiz");
  });

  it("maps WDBL02 to the existing Word Blank renderer while preserving the video-blank code from Book data", () => {
    expect(resolveActTypeFromActivityCode(MetaOnActivityCode.VideoWordBlank)).toBe(ActType.VocaCheckSpace);
    expect(canonicalActivityCodeForActType(ActType.VocaCheckSpace, MetaOnActivityCode.VideoWordBlank))
      .toBe(MetaOnActivityCode.VideoWordBlank);
    expect(activityTitleForCode(MetaOnActivityCode.VideoWordBlank, "Fallback")).toBe("Word Blank");
  });

  it("maps WDWR02 to Unity Activity 48 Write Word", () => {
    expect(resolveActTypeFromActivityCode(MetaOnActivityCode.WriteWord)).toBe(ActType.WriteWord);
    expect(canonicalActivityCodeForActType(ActType.WriteWord, MetaOnActivityCode.WriteWord))
      .toBe(MetaOnActivityCode.WriteWord);
    expect(activityTitleForCode(MetaOnActivityCode.WriteWord, "Fallback")).toBe("Write Word");
  });

  it("maps STBL02 to the existing Sentence Blank renderer while preserving the video-blank code from Book data", () => {
    expect(resolveActTypeFromActivityCode(MetaOnActivityCode.VideoSentenceBlank)).toBe(ActType.SentenceCheckSpace);
    expect(canonicalActivityCodeForActType(ActType.SentenceCheckSpace, MetaOnActivityCode.VideoSentenceBlank))
      .toBe(MetaOnActivityCode.VideoSentenceBlank);
    expect(activityTitleForCode(MetaOnActivityCode.VideoSentenceBlank, "Fallback")).toBe("Sentence Blank");
  });

  it("maps STSC02 to the existing Unscramble renderer while preserving the video-unscramble code from Book data", () => {
    expect(resolveActTypeFromActivityCode(MetaOnActivityCode.VideoUnscramble)).toBe(ActType.SentenceUnscrambleSpace);
    expect(canonicalActivityCodeForActType(ActType.SentenceUnscrambleSpace, MetaOnActivityCode.VideoUnscramble))
      .toBe(MetaOnActivityCode.VideoUnscramble);
    expect(activityTitleForCode(MetaOnActivityCode.VideoUnscramble, "Fallback")).toBe("Unscramble");
  });

  it("maps STRC02 to the existing Sentence Record renderer while preserving the video-record code from Book data", () => {
    expect(resolveActTypeFromActivityCode(MetaOnActivityCode.VideoSentenceRecord)).toBe(ActType.SentenceShadowingSpace);
    expect(canonicalActivityCodeForActType(ActType.SentenceShadowingSpace, MetaOnActivityCode.VideoSentenceRecord))
      .toBe(MetaOnActivityCode.VideoSentenceRecord);
    expect(activityTitleForCode(MetaOnActivityCode.VideoSentenceRecord, "Fallback")).toBe("Sentence Record");
  });

  it("can route EBOOK01 to the old Reading renderer when the API marks it as reading-only", () => {
    expect(resolveActTypeFromActivityCode(MetaOnActivityCode.ListenRead, { category: "reading", title: "Read" })).toBe(ActType.Reading);
  });

  it("maps NPCQHK01 to the dedicated resource-based NPC Quick Check renderer", () => {
    expect(resolveActTypeFromActivityCode(MetaOnActivityCode.NpcQuickCheck)).toBe(ActType.QuickCheck);
    expect(canonicalActivityCodeForActType(ActType.QuickCheck, MetaOnActivityCode.NpcQuickCheck))
      .toBe(MetaOnActivityCode.NpcQuickCheck);
    expect(activityTitleForCode(MetaOnActivityCode.NpcQuickCheck, "Fallback")).toBe("NPC Quick Check");
  });

  it("keeps QCNP01 compatible while new Book data uses NPCQHK01", () => {
    expect(resolveActTypeFromActivityCode(MetaOnActivityCode.LegacyNpcQuickCheck)).toBe(ActType.QuickCheck);
    expect(activityTitleForCode(MetaOnActivityCode.LegacyNpcQuickCheck, "Fallback")).toBe("NPC Quick Check");
  });

  it("maps NPCQHK02 (personalized NPC Quick Check) to the NPC Quick Check renderer", () => {
    expect(resolveActTypeFromActivityCode(MetaOnActivityCode.NpcQuickCheck2)).toBe(ActType.QuickCheck);
    expect(canonicalActivityCodeForActType(ActType.QuickCheck, MetaOnActivityCode.NpcQuickCheck2))
      .toBe(MetaOnActivityCode.NpcQuickCheck2);
    expect(activityTitleForCode(MetaOnActivityCode.NpcQuickCheck2, "Fallback")).toBe("NPC Quick Check");
  });
});
