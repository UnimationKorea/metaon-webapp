import { describe, expect, it } from "vitest";
import {
  NpcQuickCheckScenarioError,
  normalizeNpcQuickCheckScenario
} from "../shared/npcQuickCheckScenario.mjs";

function validScenario() {
  return {
    scenario_id: "scenario-g1-001",
    version: 3,
    book_idx: 7228,
    day_idx: 33,
    act_idx: 65,
    start_node_id: "intro",
    npc: { id: "jade", name: "Jade" },
    nodes: [
      { id: "intro", type: "dialogue", speaker: "npc", text: "Let's begin.", next_node_id: "q1" },
      { id: "q1", type: "question", q_idx: 101, audio_url: "https://cdn.example.com/audio/q1.mp3", tts_text: "Question one.", correct_next_node_id: "q2", incorrect_next_node_id: "retry" },
      { id: "retry", type: "dialogue", speaker: "npc", text: "Try the next one.", next_node_id: "q2" },
      { id: "q2", type: "question", q_idx: 102, correct_next_node_id: "end", incorrect_next_node_id: "end" },
      { id: "end", type: "ending", text: "Mission complete." }
    ]
  };
}

describe("NPC Quick Check scenario normalization", () => {
  it("normalizes snake_case data and validates the requested question set", () => {
    const scenario = normalizeNpcQuickCheckScenario({ data: { scenario: validScenario() } }, {
      bookIdx: 7228,
      dayIdx: 33,
      actIdx: 65,
      questionQIdxs: [101, 102]
    });

    expect(scenario).toMatchObject({
      scenarioId: "scenario-g1-001",
      startNodeId: "intro",
      npc: { id: "jade", name: "Jade" }
    });
    expect(scenario?.nodes[1]).toMatchObject({
      type: "question",
      qIdx: 101,
      audioUrl: "https://cdn.example.com/audio/q1.mp3",
      ttsText: "Question one."
    });
  });

  it("rejects missing and duplicate question references", () => {
    const source = validScenario();
    source.nodes[3].q_idx = 101;

    expect(() => normalizeNpcQuickCheckScenario(source, { questionQIdxs: [101, 102] }))
      .toThrow(NpcQuickCheckScenarioError);
    try {
      normalizeNpcQuickCheckScenario(source, { questionQIdxs: [101, 102] });
    } catch (error) {
      expect(error.issues.join(" ")).toContain("referenced by 2");
      expect(error.issues.join(" ")).toContain("does not reference qIdx 102");
    }
  });

  it("rejects broken graph references and paths without an ending", () => {
    const source = validScenario();
    source.nodes[3].correct_next_node_id = "missing";
    source.nodes[3].incorrect_next_node_id = "q2";

    expect(() => normalizeNpcQuickCheckScenario(source, { questionQIdxs: [101, 102] }))
      .toThrow(/missing node|cannot reach an ending/);
  });

  it("rejects a retry branch that cycles back to an answered question", () => {
    const source = validScenario();
    source.nodes[3].incorrect_next_node_id = "q2";

    expect(() => normalizeNpcQuickCheckScenario(source, { questionQIdxs: [101, 102] }))
      .toThrow(/must not contain a cycle/);
  });

  it("treats an explicit null scenario as a valid fallback signal", () => {
    expect(normalizeNpcQuickCheckScenario({ scenario: null })).toBeNull();
  });
});
