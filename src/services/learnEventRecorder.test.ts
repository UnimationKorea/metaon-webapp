import { describe, expect, it } from "vitest";
import { createLearnEventRecorder } from "./learnEventRecorder";

describe("createLearnEventRecorder", () => {
  it("keeps every incorrect choice and assigns cumulative attempts per question", () => {
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
    expect(events.slice(0, 2).every((event) => event.extra?.incorrect_attempt === true)).toBe(true);
    expect(events.map((event) => event.extra?.selected)).toEqual(["b", "c", "a"]);
    expect(events.map((event) => event.extra?.attempt_no)).toEqual([1, 2, 3]);
  });

  it("keeps attempts independent when a blank has its own attempt key", () => {
    const recorder = createLearnEventRecorder();
    recorder.record({ action: "submit", item_type: "sentence", item_idx: 9, chunk_index: 2, correct: 0 });
    recorder.record({ action: "submit", item_type: "sentence", item_idx: 9, chunk_index: 4, correct: 0 });
    recorder.record({ action: "submit", item_type: "sentence", item_idx: 9, chunk_index: 2, correct: 1 });

    expect(recorder.snapshot().map((event) => event.attempts)).toEqual([1, 1, 2]);
  });
});
