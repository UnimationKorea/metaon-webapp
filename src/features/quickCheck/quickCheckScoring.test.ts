import { describe, expect, it } from "vitest";
import {
  isQuickCheckAnswerComplete,
  scoreQuickCheckAnswer
} from "../../../shared/quickCheckScoring.mjs";
import type { QuickCheckAnswer, QuickCheckQuestion } from "./quickCheckTypes";

describe("Quick Check final scoring", () => {
  it("requires an exact Sentence match including case and spaces", () => {
    const question = textQuestion("The cat sleeps.");
    expect(scoreQuickCheckAnswer(question, { mode: "text", value: "The cat sleeps." })).toBe(true);
    expect(scoreQuickCheckAnswer(question, { mode: "text", value: "the cat sleeps." })).toBe(false);
    expect(scoreQuickCheckAnswer(question, { mode: "text", value: "The cat  sleeps." })).toBe(false);
    expect(scoreQuickCheckAnswer(question, { mode: "text", value: " The cat sleeps." })).toBe(false);
    expect(isQuickCheckAnswerComplete(question, { mode: "text", value: "   " })).toBe(false);
  });

  it("scores single selection by normalized index equality", () => {
    const question = singleQuestion(2);
    expect(scoreQuickCheckAnswer(question, { mode: "single", selectedIndex: 2 })).toBe(true);
    expect(scoreQuickCheckAnswer(question, { mode: "single", selectedIndex: 1 })).toBe(false);
    expect(isQuickCheckAnswerComplete(question, { mode: "single", selectedIndex: null })).toBe(false);
  });

  it.each([
    { selected: [0, 9], expected: [0, 1], correct: false, label: "1/2" },
    { selected: [0, 1], expected: [0, 1], correct: true, label: "2/2" },
    { selected: [0, 1, 9], expected: [0, 1, 2], correct: true, label: "2/3" },
    { selected: [0, 1, 9, 9], expected: [0, 1, 2, 3], correct: false, label: "2/4" },
    { selected: [0, 1, 2, 9], expected: [0, 1, 2, 3], correct: true, label: "3/4" }
  ])("uses strict majority for composite boundary $label", ({ selected, expected, correct }) => {
    const question = compositeQuestion(expected);
    const answer: QuickCheckAnswer = { mode: "composite", selectedIndexes: selected };
    expect(scoreQuickCheckAnswer(question, answer)).toBe(correct);
  });
});

function baseQuestion(): Omit<QuickCheckQuestion, "kind" | "correctAnswer"> {
  return {
    id: "qc:1",
    qIdx: 1,
    sequence: 1,
    quizCode: 100,
    unityType: 1,
    sourceIndexBase: 1,
    indexBase: 0,
    question: "Question",
    options: [],
    subItems: [],
    tokens: [],
    blankPositions: []
  };
}

function textQuestion(value: string): QuickCheckQuestion {
  return {
    ...baseQuestion(),
    kind: "sentence-input",
    unityType: 5,
    quizCode: 500,
    correctAnswer: { mode: "text", value }
  };
}

function singleQuestion(selectedIndex: number): QuickCheckQuestion {
  return {
    ...baseQuestion(),
    kind: "single-select",
    correctAnswer: { mode: "single", selectedIndex }
  };
}

function compositeQuestion(selectedIndexes: number[]): QuickCheckQuestion {
  return {
    ...baseQuestion(),
    kind: "drag-sentence",
    unityType: 11,
    quizCode: 1100,
    sourceIndexBase: 0,
    correctAnswer: { mode: "composite", selectedIndexes }
  };
}
