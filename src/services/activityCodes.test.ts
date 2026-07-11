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
    [MetaOnActivityCode.WordBlank, ActType.VocaCheckSpace, "Word Blank"],
    [MetaOnActivityCode.MatchingGame, ActType.MatchingGame, "Matching Game"],
    [MetaOnActivityCode.MemoryCard, ActType.MemoryGame, "Memory Card"],
    [MetaOnActivityCode.SentenceBlank, ActType.SentenceCheckSpace, "Sentence Blank"],
    [MetaOnActivityCode.Unscramble, ActType.SentenceUnscrambleSpace, "Unscramble"],
    [MetaOnActivityCode.SentenceRecord, ActType.SentenceShadowingSpace, "Sentence Record"],
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

  it("can route EBOOK01 to the old Reading renderer when the API marks it as reading-only", () => {
    expect(resolveActTypeFromActivityCode(MetaOnActivityCode.ListenRead, { category: "reading", title: "Read" })).toBe(ActType.Reading);
  });
});
