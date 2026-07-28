import { describe, expect, it } from "vitest";
import {
  buildLegacyQuickCheckRequest,
  buildCurrentQuickCheckSubmission,
  buildLegacyQuickCheckSubmission,
  normalizeQuickCheckPayload,
  normalizeSubmittedQuickCheckAnswers
} from "./quickCheckAdapter.mjs";

describe("Quick Check BFF adapter", () => {
  const currentPayload = normalizeQuickCheckPayload({
    resultCode: 1,
    quizzes: [
      {
        qc_idx: 10,
        qnum: 1,
        qcode: 100,
        question: "Pick one",
        answer_cnt: 2,
        answer_1: "A",
        answer_2: "B",
        right_answer: 2
      }
    ]
  }, "metaon3-current");

  it("regrades current submissions in the BFF instead of accepting a client correct flag", () => {
    const submitted = normalizeSubmittedQuickCheckAnswers(currentPayload.questions, [
      { q_idx: 10, answer: { mode: "single", selectedIndex: 1 }, correct: false, time_ms: 1250 }
    ]);
    const built = buildCurrentQuickCheckSubmission(
      123,
      currentPayload.questions,
      submitted.answersByQuestionId,
      submitted.metadataByQuestionId
    );

    expect(built.payload.results[0]).toMatchObject({
      qc_idx: 10,
      u_answer: "2",
      correct: 1,
      sec: 1
    });
  });

  it("encodes legacy sentence answers without slash or caret delimiter collisions", () => {
    const legacyPayload = normalizeQuickCheckPayload({
      resultCode: 1,
      qlist: [
        {
          q_idx: 20,
          quizCode: 500,
          question: "Write it",
          subAnswer: "and/or ^ exact"
        }
      ]
    }, "unity-new");
    const submitted = normalizeSubmittedQuickCheckAnswers(legacyPayload.questions, [
      { q_idx: 20, answer: { mode: "text", value: "and/or ^ exact" } }
    ]);
    const built = buildLegacyQuickCheckSubmission({
      context: { book_idx: 7405, lesson_num: 1, day_num: 1, act_code: 65 },
      questions: legacyPayload.questions,
      answersByQuestionId: submitted.answersByQuestionId,
      metadataByQuestionId: submitted.metadataByQuestionId
    });

    expect(built.payload.useranswer).toMatch(/^json:/);
    expect(built.payload.useranswer).not.toContain("and/or");
    expect(built.payload.useranswer).not.toContain("^");
    expect(built.payload).not.toHaveProperty("userIdx");
  });

  it("does not include a learner index in the legacy query request", () => {
    const request = buildLegacyQuickCheckRequest({
      user_idx: 28,
      book_idx: 7405,
      lesson_num: 1,
      day_num: 2
    });

    expect(request).toEqual({ bookIdx: 7405, lessonNum: 1, dayNum: 2 });
    expect(request).not.toHaveProperty("userIdx");
  });

  it("keeps explicit content PK references for mastery events", () => {
    const payload = normalizeQuickCheckPayload({
      resultCode: 1,
      quizzes: [{
        qc_idx: 30,
        qcode: 100,
        question: "Pick one",
        word_idx: 84512,
        sentence_idx: 33120,
        answer_cnt: 2,
        answer_1: "A",
        answer_2: "B",
        right_answer: 1
      }]
    }, "metaon3-current");

    expect(payload.questions[0].contentRefs).toEqual([
      { itemType: "word", itemIdx: 84512 },
      { itemType: "sentence", itemIdx: 33120 }
    ]);
  });
});
