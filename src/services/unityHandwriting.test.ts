import { describe, expect, it } from "vitest";
import {
  checkUnityWordScore,
  evaluateUnityHandwriting,
  normalizeHandwritingCandidates
} from "./unityHandwriting";

describe("Unity Activity 48 handwriting scoring", () => {
  it("uses the Unity positional score and ignores trailing candidate characters", () => {
    expect(checkUnityWordScore("fox", "FOX ")).toBe(100);
    expect(checkUnityWordScore("fox", "foxes")).toBe(100);
    expect(checkUnityWordScore("fox", "fax")).toBe(66);
  });

  it("counts non alphabetic expected characters as matching like Unity", () => {
    expect(checkUnityWordScore("ice-cream", "ice cream")).toBe(100);
  });

  it("accepts the first candidate at or above Unity's 70 point boundary", () => {
    const result = evaluateUnityHandwriting("bridge", ["brxdge", "bridge"]);
    expect(result.correct).toBe(true);
    expect(result.bestCandidate).toBe("brxdge");
    expect(result.bestScore).toBe(83);
  });

  it("normalizes the BFF candidate list with Unity's newline removal", () => {
    expect(normalizeHandwritingCandidates({ candidates: ["f\no\nx", null, 3, "Fox"] }))
      .toEqual(["fox", "Fox"]);
  });
});
