import { describe, expect, it } from "vitest";
import type { NpcQuickCheckScenario } from "../../../shared/npcQuickCheckScenario.mjs";
import {
  npcScenarioQuestionNode,
  resolveNpcScenarioTransition
} from "./npcQuickCheckScenarioRuntime";

const scenario: NpcQuickCheckScenario = {
  scenarioId: "scenario-1",
  version: 1,
  bookIdx: 10,
  dayIdx: 20,
  actIdx: 65,
  locale: "ko-KR",
  startNodeId: "intro",
  npc: { id: "jade", name: "Jade", avatarUrl: "", voiceId: "" },
  scene: { backgroundUrl: "", bgmUrl: "" },
  contentHash: "hash",
  publishedAt: "",
  nodes: [
    { id: "intro", type: "dialogue", speaker: "npc", text: "Hello", audioUrl: "", nextNodeId: "question" },
    { id: "question", type: "question", qIdx: 99, text: "", audioUrl: "", ttsText: "", hintText: "", hintNodeId: "", correctNextNodeId: "success", incorrectNextNodeId: "retry" },
    { id: "success", type: "ending", text: "Done", audioUrl: "" },
    { id: "retry", type: "ending", text: "Review", audioUrl: "" }
  ]
};

describe("NPC Quick Check scenario transition authority", () => {
  it("resolves dialogue and correct/incorrect question branches", () => {
    expect(resolveNpcScenarioTransition(scenario, "intro")).toEqual({ nextNodeId: "question", outcome: "continue" });
    expect(resolveNpcScenarioTransition(scenario, "question", true)).toEqual({ nextNodeId: "success", outcome: "correct" });
    expect(resolveNpcScenarioTransition(scenario, "question", false)).toEqual({ nextNodeId: "retry", outcome: "incorrect" });
  });

  it("rejects advancing an unanswered question or ending node", () => {
    expect(() => resolveNpcScenarioTransition(scenario, "question")).toThrow(/Submit/);
    expect(() => resolveNpcScenarioTransition(scenario, "success")).toThrow(/ending/);
  });

  it("finds a scenario question by the authoritative qIdx", () => {
    expect(npcScenarioQuestionNode(scenario, 99)?.id).toBe("question");
    expect(npcScenarioQuestionNode(scenario, 100)).toBeUndefined();
  });
});
