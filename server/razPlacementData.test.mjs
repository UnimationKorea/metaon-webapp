import { describe, expect, it } from "vitest";
import {
  RAZ_PLACEMENT_SETS,
  RAZ_START_LEVEL_BY_GRADE,
  startRazIndexForGrade
} from "./razPlacementData.mjs";

const expectedCounts = new Map([
  ["aa", 4], ["A", 4], ["B", 4], ["C", 4], ["D", 4], ["E", 4],
  ["F", 5], ["G", 5], ["H", 5], ["I", 5], ["J", 5], ["K", 5],
  ["L", 6], ["M", 6], ["N", 6], ["O", 6], ["P", 6], ["Q", 6],
  ["R", 8], ["S", 8], ["T", 8], ["U", 8], ["V", 8], ["W", 8],
  ["X", 8], ["Y", 8], ["Z", 8], ["Z1", 8], ["Z2", 8]
]);

describe("Raz placement question data", () => {
  it("loads all three forms with the same 29-level order", () => {
    expect(RAZ_PLACEMENT_SETS.map((set) => set.id)).toEqual(["raz-form-1", "raz-form-2", "raz-form-3"]);

    const expectedLevelOrder = [...expectedCounts.keys()];
    for (const set of RAZ_PLACEMENT_SETS) {
      expect(set.units).toHaveLength(29);
      expect(set.units.map((unit) => unit.level)).toEqual(expectedLevelOrder);
      expect(set.units.reduce((total, unit) => total + unit.items.length, 0)).toBe(178);
    }
  });

  it("preserves each JSON item order and variable question count", () => {
    for (const set of RAZ_PLACEMENT_SETS) {
      for (const unit of set.units) {
        expect(unit.items).toHaveLength(expectedCounts.get(unit.level));
        const firstVocab = unit.items.findIndex((item) => item.skill === "vocab");
        expect(firstVocab).toBeGreaterThan(0);
        expect(unit.items.slice(0, firstVocab).every((item) => item.skill === "reading")).toBe(true);
        expect(unit.items.slice(firstVocab).every((item) => item.skill === "vocab")).toBe(true);
        expect(new Set(unit.items.map((item) => item.id)).size).toBe(unit.items.length);
        for (const item of unit.items) {
          expect(item.answerIndex).toBeGreaterThanOrEqual(0);
          expect(item.answerIndex).toBeLessThan(item.choices.length);
        }
      }
    }
  });

  it("keeps the existing EFL grade start levels", () => {
    const units = RAZ_PLACEMENT_SETS[0].units;
    for (const [grade, level] of Object.entries(RAZ_START_LEVEL_BY_GRADE)) {
      expect(units[startRazIndexForGrade(units, grade)].level).toBe(level);
    }
  });
});
