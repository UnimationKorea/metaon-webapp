import type {
  NpcQuickCheckQuestionNode,
  NpcQuickCheckScenario,
  NpcQuickCheckScenarioNode
} from "../../../shared/npcQuickCheckScenario.mjs";

export function npcScenarioNode(
  scenario: NpcQuickCheckScenario | null,
  nodeId: string
): NpcQuickCheckScenarioNode | undefined {
  return scenario?.nodes.find((node) => node.id === nodeId);
}

export function npcScenarioQuestionNode(
  scenario: NpcQuickCheckScenario | null,
  qIdx: number
): NpcQuickCheckQuestionNode | undefined {
  const node = scenario?.nodes.find((item) => item.type === "question" && item.qIdx === qIdx);
  return node?.type === "question" ? node : undefined;
}

export function resolveNpcScenarioTransition(
  scenario: NpcQuickCheckScenario,
  fromNodeId: string,
  questionCorrect?: boolean
): { nextNodeId: string; outcome: "continue" | "correct" | "incorrect" } {
  const node = npcScenarioNode(scenario, fromNodeId);
  if (!node) throw new Error("Unknown NPC scenario transition.");

  if (node.type === "dialogue") {
    return { nextNodeId: node.nextNodeId, outcome: "continue" };
  }
  if (node.type === "question") {
    if (typeof questionCorrect !== "boolean") {
      throw new Error("Submit the scenario question before advancing.");
    }
    return questionCorrect
      ? { nextNodeId: node.correctNextNodeId, outcome: "correct" }
      : { nextNodeId: node.incorrectNextNodeId, outcome: "incorrect" };
  }
  throw new Error("An ending node cannot advance.");
}
