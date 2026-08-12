import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getQuickCheckQuiz, submitQuickCheck } from "../../api/uniplanetApi";
import { createLearnEventRecorder } from "../../services/learnEventRecorder";
import type { ActivityRendererContext } from "../../types/metaonTypes";
import { QuickCheckActivity } from "./QuickCheckActivity";

vi.mock("../../api/uniplanetApi", () => ({
  getQuickCheckQuiz: vi.fn(),
  submitQuickCheck: vi.fn()
}));

const getQuickCheckQuizMock = vi.mocked(getQuickCheckQuiz);
const submitQuickCheckMock = vi.mocked(submitQuickCheck);

describe("QuickCheckActivity", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    getQuickCheckQuizMock.mockResolvedValue(simplePayload());
    submitQuickCheckMock.mockResolvedValue(submissionPayload());
  });

  it("shows one question at a time and preserves answers across previous/next navigation", async () => {
    render(<QuickCheckActivity context={context} />);

    expect(await screen.findByRole("heading", { name: "First question" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Second question" })).not.toBeInTheDocument();

    const alpha = screen.getByRole("button", { name: /A Alpha/ });
    expect(alpha.closest(".quick-check-v2-options")).toHaveClass("is-one-column");
    fireEvent.click(alpha);
    expect(alpha).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Next question" }));
    expect(screen.getByRole("heading", { name: "Second question" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "First question" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Previous question" }));
    expect(screen.getByRole("button", { name: /A Alpha/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("checks completion separately and moves to the first unanswered question", async () => {
    render(<QuickCheckActivity context={context} />);
    await screen.findByRole("heading", { name: "First question" });
    fireEvent.click(screen.getByRole("button", { name: /A Alpha/ }));
    fireEvent.click(screen.getByRole("button", { name: "Submit Quick Check" }));

    expect(screen.getByRole("heading", { name: "Second question" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Answer question 2 before submitting.");
    expect(submitQuickCheckMock).not.toHaveBeenCalled();
  });

  it("records an incorrect selection and the subsequent corrected selection as separate attempts", async () => {
    const learnEventRecorder = createLearnEventRecorder();
    render(<QuickCheckActivity context={{ ...context, learnEventRecorder }} />);
    await screen.findByRole("heading", { name: "First question" });

    fireEvent.click(screen.getByRole("button", { name: /A Alpha/ }));
    fireEvent.click(screen.getByRole("button", { name: /B Beta/ }));

    const attempts = learnEventRecorder.snapshot().filter((event) => event.action === "answer_scored");
    expect(attempts).toHaveLength(2);
    expect(attempts.map((event) => event.correct)).toEqual([0, 1]);
    expect(attempts.map((event) => event.attempts)).toEqual([1, 2]);
    expect(attempts.map((event) => (event.extra?.answer as { selected_index?: number }).selected_index)).toEqual([0, 1]);
    expect(attempts[0].correct).toBe(0);
  });

  it("keeps result and review correctness aligned with the common scorer", async () => {
    render(<QuickCheckActivity context={context} />);
    await screen.findByRole("heading", { name: "First question" });
    fireEvent.click(screen.getByRole("button", { name: /B Beta/ }));
    fireEvent.click(screen.getByRole("button", { name: "Next question" }));
    fireEvent.click(screen.getByRole("button", { name: /A Red/ }));
    fireEvent.click(screen.getByRole("button", { name: "Submit Quick Check" }));

    expect(await screen.findByText("Quick Check complete")).toBeInTheDocument();
    const resultItems = screen.getByRole("list", { name: "Question results" });
    expect(resultItems.children[0]).toHaveClass("is-correct");
    expect(resultItems.children[1]).toHaveClass("is-wrong");

    fireEvent.click(screen.getByRole("button", { name: /Q2 X no point/ }));
    expect(screen.getByRole("heading", { name: "Second question" })).toBeInTheDocument();
    expect(screen.getByText("X Incorrect")).toBeInTheDocument();
    expect(screen.getByText("Correct answer: Blue")).toBeInTheDocument();
  });

  it("prevents duplicate submission while the first request is pending", async () => {
    getQuickCheckQuizMock.mockResolvedValue({
      resultCode: 1,
      attempt_id: "attempt-one",
      quizzes: [simplePayload().quizzes[0]]
    });
    let resolveSubmission: (value: unknown) => void = () => undefined;
    submitQuickCheckMock.mockImplementation(() => new Promise((resolve) => {
      resolveSubmission = resolve;
    }));

    render(<QuickCheckActivity context={context} />);
    await screen.findByRole("heading", { name: "First question" });
    fireEvent.click(screen.getByRole("button", { name: /B Beta/ }));
    const submit = screen.getByRole("button", { name: "Submit Quick Check" });
    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(submitQuickCheckMock).toHaveBeenCalledTimes(1);
    resolveSubmission({
      resultCode: 1,
      result: {
        total: 1,
        correctCount: 1,
        newPoints: 0,
        currentPoints: 0,
        existingPoints: 0,
        lessonPoints: 0,
        level: 0,
        gradedBy: "bff-final-rule",
        duplicate: false,
        items: [{ questionId: "qc:101", qIdx: 101, correct: true, point: 0, pointState: "earned-before" }]
      }
    });
    expect(await screen.findByText("Quick Check complete")).toBeInTheDocument();
  });

  it("handles an empty question list and an API error with retry", async () => {
    getQuickCheckQuizMock
      .mockResolvedValueOnce({ resultCode: 1, quizzes: [] })
      .mockRejectedValueOnce(new Error("Quick Check network failed"));

    render(<QuickCheckActivity context={context} />);
    expect(await screen.findByText("No Quick Check questions are available for this day.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Quick Check network failed")).toBeInTheDocument();
  });
});

const context = {
  studyLogIdx: 77,
  packageMeta: {
    key: "book:7405",
    source: "metaon3-resources",
    bookIdx: 7405,
    bookId: "G3LL02",
    seriesGroup: 164,
    seriesIdx: 603,
    downloadedAt: "2026-07-10T00:00:00.000Z",
    totalFiles: 1,
    totalBytes: 1,
    lessonDays: []
  },
  day: {
    id: "1:1",
    dayIdx: 536,
    lesson: 1,
    day: 1,
    title: "Day 1",
    activities: []
  },
  activity: {
    id: "7815",
    actIdx: 7815,
    dayIdx: 536,
    actType: 65,
    title: "Quick Check",
    actNum: 9
  }
} as ActivityRendererContext;

function simplePayload() {
  return {
    resultCode: 1,
    resultMessage: "ok",
    attempt_id: "attempt-two",
    quizzes: [
      {
        qc_idx: 101,
        qnum: 1,
        qcode: 100,
        question: "First question",
        answer_cnt: 2,
        answer_1: "Alpha",
        answer_2: "Beta",
        right_answer: 2
      },
      {
        qc_idx: 102,
        qnum: 2,
        qcode: 100,
        question: "Second question",
        answer_cnt: 2,
        answer_1: "Red",
        answer_2: "Blue",
        right_answer: 2
      }
    ]
  };
}

function submissionPayload() {
  return {
    resultCode: 1,
    resultMessage: "ok",
    result: {
      total: 2,
      correctCount: 1,
      newPoints: 3,
      currentPoints: 12,
      existingPoints: 9,
      lessonPoints: 12,
      level: 0,
      gradedBy: "bff-final-rule",
      duplicate: false,
      items: [
        { questionId: "qc:101", qIdx: 101, correct: true, point: 3, pointState: "earned-now" },
        { questionId: "qc:102", qIdx: 102, correct: false, point: 0, pointState: "none" }
      ]
    }
  };
}
