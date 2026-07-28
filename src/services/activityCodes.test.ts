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
