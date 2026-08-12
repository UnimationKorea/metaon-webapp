import { describe, expect, it } from "vitest";
import { ActType } from "../types/metaonTypes";
import { allUnityActTypes, getActTypeDefinition } from "./actTypeCatalog";
import { getActivityRenderer, portedActTypes, recognizedActTypes } from "./activityRegistry";

describe("activityRegistry", () => {
  it("exposes the first six planned port targets", () => {
    expect(portedActTypes.has(ActType.Reading)).toBe(true);
    expect(portedActTypes.has(ActType.Listening)).toBe(true);
    expect(portedActTypes.has(ActType.Ebook)).toBe(true);
    expect(portedActTypes.has(ActType.VocaQuiz)).toBe(true);
    expect(portedActTypes.has(ActType.SentenceUnscramble)).toBe(true);
    expect(portedActTypes.has(ActType.ListenRecord)).toBe(true);
  });

  it("routes prioritized word act types to concrete renderers", () => {
    expect(getActivityRenderer(ActType.Listening).name).toBe("Listen & Read");
    expect(getActivityRenderer(ActType.VocaPreview).name).toBe("Vocabulary Preview");
    expect(getActivityRenderer(ActType.FlashCard).name).toBe("Flash Card");
    expect(getActivityRenderer(ActType.VocaCheck).name).toBe("Voca Check");
    expect(getActivityRenderer(ActType.MatchingGame).name).toBe("Matching Game");
    expect(getActivityRenderer(ActType.MemoryGame).name).toBe("Memory Card");
    expect(getActivityRenderer(ActType.GameSpace).name).toBe("Space Game");
    expect(getActivityRenderer(ActType.SoundCheck).name).toBe("Sound Check");
    expect(getActivityRenderer(ActType.SpellingCheck).name).toBe("Spelling Check");
    expect(getActivityRenderer(ActType.WordPuzzle).name).toBe("Word Puzzle");
    expect(getActivityRenderer(ActType.WordSearch).name).toBe("Word Search");
    expect(getActivityRenderer(ActType.PeelingWord).name).toBe("Peeling Word");
    expect(getActivityRenderer(ActType.WordPuzzle2).name).toBe("Word Puzzle 2");
    expect(getActivityRenderer(ActType.UnderSea).name).toBe("Spelling Fish");
    expect(getActivityRenderer(ActType.WriteQuiz).name).toBe("Write Quiz");
    expect(getActivityRenderer(ActType.SentenceCheckSpace).name).toBe("Sentence Blank");
    expect(getActivityRenderer(ActType.SentenceUnscrambleSpace).name).toBe("Unscramble");
  });

  it("labels unported act types from the Unity catalog", () => {
    const renderer = getActivityRenderer(ActType.MovieRecord);
    expect(renderer.name).toBe("Movie Record");
  });

  it("routes NPCQHK01 to the NPC renderer without replacing QCHK01", () => {
    expect(getActivityRenderer(ActType.QuickCheck, "NPCQHK01").name).toBe("NPC Quick Check");
    expect(getActivityRenderer(ActType.QuickCheck, "QCHK01").name).toBe("Quick Check");
  });

  it("exposes Type 67 as the Listen & Read activity contract", () => {
    expect(getActTypeDefinition(ActType.Listening)).toMatchObject({
      unityName: "EBOOK01",
      label: "Listen & Read",
      category: "book",
      status: "implemented"
    });
  });

  it("registers every Unity act type value in the web catalog", () => {
    const enumValues = Object.values(ActType).filter((value): value is ActType => typeof value === "number");
    expect(new Set(allUnityActTypes)).toEqual(new Set(enumValues));
    for (const actType of enumValues) {
      expect(recognizedActTypes.has(actType)).toBe(true);
      expect(getActTypeDefinition(actType)).toBeDefined();
    }
  });
});
