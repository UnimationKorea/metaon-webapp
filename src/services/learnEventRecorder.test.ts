import { afterEach, describe, expect, it, vi } from "vitest";

const { sendLearnEventsMock } = vi.hoisted(() => ({ sendLearnEventsMock: vi.fn() }));

vi.mock("../api/uniplanetApi", () => ({
  sendLearnEvents: sendLearnEventsMock
}));

import { createLearnEventRecorder } from "./learnEventRecorder";

describe("createLearnEventRecorder", () => {
  afterEach(() => {
    sendLearnEventsMock.mockReset();
    window.localStorage.clear();
  });
  it("keeps every incorrect choice and assigns cumulative attempts per question without legacy extra keys", () => {
    const recorder = createLearnEventRecorder();

    recorder.record({
      action: "submit",
      item_type: "word",
      item_idx: 41,
      correct: 0,
      attempts: 1,
      extra: { selected: "b" }
    });
    recorder.record({
      action: "submit",
      item_type: "word",
      item_idx: 41,
      correct: 0,
      attempts: 1,
      extra: { selected: "c" }
    });
    recorder.record({
      action: "submit",
      item_type: "word",
      item_idx: 41,
      correct: 1,
      attempts: 1,
      extra: { selected: "a" }
    });

    const events = recorder.snapshot();
    expect(events.map((event) => event.attempts)).toEqual([1, 2, 3]);
    expect(events.slice(0, 2).map((event) => event.correct)).toEqual([0, 0]);
    expect(events.map((event) => event.extra?.selected)).toEqual(["b", "c", "a"]);
    expect(events.every((event) => event.extra?.attempt_no === undefined)).toBe(true);
    expect(events.every((event) => event.extra?.incorrect_attempt === undefined)).toBe(true);
  });

  it("keeps attempts independent when a blank has its own attempt key", () => {
    const recorder = createLearnEventRecorder();
    recorder.record({ action: "submit", item_type: "sentence", item_idx: 9, chunk_index: 2, correct: 0 });
    recorder.record({ action: "submit", item_type: "sentence", item_idx: 9, chunk_index: 4, correct: 0 });
    recorder.record({ action: "submit", item_type: "sentence", item_idx: 9, chunk_index: 2, correct: 1 });

    expect(recorder.snapshot().map((event) => event.attempts)).toEqual([1, 1, 2]);
  });

  it("uses q_no as the stable attempt identity and normalizes the new query fields", () => {
    const recorder = createLearnEventRecorder();
    recorder.begin({ activityCode: "STBL01", questionTotal: 8 });

    recorder.record({
      action: "question_view",
      item_type: "sentence",
      item_idx: 12,
      q_no: 3,
      extra: { option_order: [{ word_idx: 21, text: "tears" }, { word_idx: null, text: "good care" }] }
    });
    recorder.record({
      action: "submit",
      item_type: "sentence",
      item_idx: 12,
      correct: 0,
      extra: { answer_text: "tears", selected_text: "good care" }
    });
    recorder.record({
      action: "submit",
      item_type: "sentence",
      item_idx: 12,
      correct: 1,
      extra: { answer_text: "tears", selected_text: "tears" }
    });

    const [, firstSubmit, secondSubmit] = recorder.snapshot();
    expect(firstSubmit).toMatchObject({
      q_no: 3,
      q_total: 8,
      attempts: 1,
      attempt_max: 3,
      question_form: "choice-word",
      extra: { answer: "tears", selected: "good care" }
    });
    expect(secondSubmit).toMatchObject({ q_no: 3, attempts: 2 });
    expect(firstSubmit.extra?.answer_text).toBeUndefined();
    expect(firstSubmit.extra?.selected_text).toBeUndefined();
  });

  it("persists a failed batch and retries the exact log_idx later", async () => {
    const recorder = createLearnEventRecorder();
    recorder.begin({ activityCode: "WDQU03", questionTotal: 1 });
    recorder.record({ action: "question_view", item_type: "word", item_idx: 44, q_no: 1 });
    recorder.record({ action: "submit", item_type: "word", item_idx: 44, correct: 1, extra: { answer: "fox", selected: "fox" } });
    sendLearnEventsMock.mockRejectedValueOnce(new Error("offline"));

    await expect(recorder.flush(901)).rejects.toThrow("offline");
    expect(window.localStorage.getItem("metaon.learn-events.outbox.v2")).toContain('"log_idx":901');

    sendLearnEventsMock.mockImplementationOnce(({ events, batch_id }) =>
      Promise.resolve({ resultCode: 1, accepted_event_count: events.length, batch_id })
    );
    await expect(recorder.flushPending()).resolves.toBeUndefined();
    expect(sendLearnEventsMock).toHaveBeenLastCalledWith(expect.objectContaining({ log_idx: 901 }));
    expect(window.localStorage.getItem("metaon.learn-events.outbox.v2")).toBeNull();
  });

  it("retains a batch when the server acknowledgement is incomplete", async () => {
    const recorder = createLearnEventRecorder();
    recorder.record({ action: "submit", item_type: "word", item_idx: 44, correct: 1, extra: { answer: "fox", selected: "fox" } });
    sendLearnEventsMock.mockResolvedValueOnce({ resultCode: 1, accepted_event_count: 0, batch_id: "wrong-batch" });

    await expect(recorder.flush(901)).rejects.toThrow("acknowledgement");
    expect(window.localStorage.getItem("metaon.learn-events.outbox.v2")).toContain('"log_idx":901');
  });
});
