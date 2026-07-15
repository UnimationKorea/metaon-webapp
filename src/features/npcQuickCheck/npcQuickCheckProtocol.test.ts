import { describe, expect, it } from "vitest";
import type { QuickCheckQuestion } from "../quickCheck/quickCheckTypes";
import {
  normalizeViewerAnswer,
  parseNpcQuickCheckRpcCall,
  sanitizeQuickCheckQuestions
} from "./npcQuickCheckProtocol";

const question: QuickCheckQuestion = {
  id: "qc:1",
  qIdx: 1,
  sequence: 1,
  quizCode: 100,
  unityType: 1,
  kind: "single-select",
  sourceIndexBase: 1,
  indexBase: 0,
  question: "Choose one",
  options: [{ index: 0, sourceIndex: 1, label: "A" }],
  subItems: [],
  tokens: [],
  blankPositions: [],
  contentRefs: [{ itemType: "word", itemIdx: 10 }],
  correctAnswer: { mode: "single", selectedIndex: 0 }
};

describe("NPC Quick Check protocol", () => {
  it("removes answers from the iframe payload", () => {
    const [safe] = sanitizeQuickCheckQuestions([question]);
    expect(safe).not.toHaveProperty("correctAnswer");
    expect(safe.contentRefs).toEqual([{ itemType: "word", itemIdx: 10 }]);
  });

  it("normalizes answer values to the question answer mode", () => {
    expect(normalizeViewerAnswer(question, { mode: "text", selectedIndex: 0 })).toEqual({
      mode: "single",
      selectedIndex: 0
    });
  });

  it("accepts only version-neutral RPC call envelopes", () => {
    expect(parseNpcQuickCheckRpcCall({ type: "rpc_call", id: "1", method: "activity.bootstrap", params: {} }))
      .toMatchObject({ id: "1", method: "activity.bootstrap" });
    expect(parseNpcQuickCheckRpcCall({ type: "ready" })).toBeNull();
  });
});
