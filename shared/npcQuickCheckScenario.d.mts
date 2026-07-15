export type NpcQuickCheckDialogueNode = {
  id: string;
  type: "dialogue";
  speaker: "npc" | "student";
  text: string;
  audioUrl: string;
  nextNodeId: string;
};

export type NpcQuickCheckQuestionNode = {
  id: string;
  type: "question";
  qIdx: number;
  text: string;
  audioUrl: string;
  ttsText: string;
  hintText: string;
  hintNodeId: string;
  correctNextNodeId: string;
  incorrectNextNodeId: string;
};

export type NpcQuickCheckEndingNode = {
  id: string;
  type: "ending";
  text: string;
  audioUrl: string;
};

export type NpcQuickCheckScenarioNode =
  | NpcQuickCheckDialogueNode
  | NpcQuickCheckQuestionNode
  | NpcQuickCheckEndingNode;

export type NpcQuickCheckScenario = {
  scenarioId: string;
  version: number;
  bookIdx: number;
  dayIdx: number;
  actIdx: number;
  locale: string;
  startNodeId: string;
  npc: { id: string; name: string; avatarUrl: string; voiceId: string };
  scene: { backgroundUrl: string; bgmUrl: string };
  nodes: NpcQuickCheckScenarioNode[];
  contentHash: string;
  publishedAt: string;
};

export class NpcQuickCheckScenarioError extends Error {
  issues: string[];
  constructor(issues: string[]);
}

export function normalizeNpcQuickCheckScenario(
  value: unknown,
  options?: { bookIdx?: number; dayIdx?: number; actIdx?: number; questionQIdxs?: number[] }
): NpcQuickCheckScenario | null;
