import { describe, expect, it } from "vitest";
import { normalizeQuickCheckLoadResponse, normalizeRawQuestion } from "./quickCheckAdapter";

describe("Quick Check response adapter", () => {
  it("keeps the existing simple MetaOn3 quizzes response compatible and normalizes to zero-based indexes", () => {
    const result = normalizeQuickCheckLoadResponse({
      resultCode: 1,
      resultMessage: "ok",
      quizzes: [
        {
          qc_idx: 11724,
          qnum: 1,
          qcode: 100,
          question: "Choose B",
          answer_cnt: 3,
          answer_1: "A",
          answer_2: "B",
          answer_3: "C",
          right_answer: 2
        }
      ]
    });

    expect(result.sourceContract).toBe("metaon3-current");
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0]).toMatchObject({
      qIdx: 11724,
      kind: "single-select",
      sourceIndexBase: 1,
      indexBase: 0,
      correctAnswer: { mode: "single", selectedIndex: 1 }
    });
    expect(result.questions[0].options.map((option) => option.index)).toEqual([0, 1, 2]);
  });

  it("maps Type 11 right answers by blank order instead of token index", () => {
    const question = normalizeRawQuestion({
      q_idx: 91,
      quizCode: 1100,
      question: "Complete the sentence",
      qjson: JSON.stringify({
        question: ["I", "_", "to", "_", "."],
        answers: ["want", "go", "like", "school"],
        right_answer: [0, 3]
      })
    }, 0);

    expect(question.kind).toBe("drag-sentence");
    expect(question.blankPositions).toEqual([1, 3]);
    expect(question.correctAnswer).toEqual({ mode: "composite", selectedIndexes: [0, 3] });
  });

  it("maps Type 9 character blanks from the character-indexed answer table", () => {
    const question = normalizeRawQuestion({
      q_idx: 92,
      quizCode: 900,
      qjson: JSON.stringify({
        question: "CAT",
        blank_index: [0, 2],
        answers: [{ text: "C" }, { text: "T" }],
        right_answer: [0, null, 1]
      })
    }, 0);

    expect(question.blankPositions).toEqual([0, 2]);
    expect(question.correctAnswer).toEqual({ mode: "composite", selectedIndexes: [0, 1] });
  });
});
