import type { NpcQuickCheckScenario } from "../../../shared/npcQuickCheckScenario.mjs";
import { indexedDbStorage } from "../../services/indexedDbStorage";
import type { ActivityRendererContext } from "../../types/metaonTypes";
import type { QuickCheckQuestion } from "../quickCheck/quickCheckTypes";

export type NpcQuickCheckAudioAsset = {
  data: ArrayBuffer;
  mimeType: string;
};

export type NpcQuickCheckResourceBundle = {
  attemptId: string;
  audioAssets: Record<string, NpcQuickCheckAudioAsset>;
  questions: QuickCheckQuestion[];
  scenario: NpcQuickCheckScenario;
};

type NpcQuickCheckScope = {
  actIdx: number;
  bookCode: string;
  bookIdx: number;
  dayIdx: number;
  lesson: number;
  day: number;
};

export async function loadNpcQuickCheckResource(context: ActivityRendererContext): Promise<NpcQuickCheckResourceBundle> {
  const scope = resolveScope(context);
  const packageKey = context.packageMeta?.key;
  const resourceBase = `Lessons/L${scope.lesson}/D${scope.day}/npcqhk`;
  const scriptPath = `${resourceBase}/script.json`;
  if (!packageKey) throw new Error("Book resources are not cached.");

  const scriptBlob = await indexedDbStorage.getFileBlob(packageKey, scriptPath);
  if (!scriptBlob) throw new Error("NPCQHK01 script.json is not cached. Download this Book again.");
  const script = parseScript(await readBlobText(scriptBlob));

  const sourceAudioPaths = collectScriptAudioPaths(script);
  const virtualPathBySource = new Map<string, string>();
  for (const sourcePath of sourceAudioPaths) {
    virtualPathBySource.set(sourcePath, resolveCachedAudioPath(resourceBase, sourcePath));
  }

  const audioAssets: Record<string, NpcQuickCheckAudioAsset> = {};
  await Promise.all(
    Array.from(virtualPathBySource.values()).map(async (path) => {
      const blob = await indexedDbStorage.getFileBlob(packageKey, path);
      if (!blob) throw new Error(`NPCQHK01 audio is not cached: ${path}`);
      audioAssets[path] = {
        data: await blob.arrayBuffer(),
        mimeType: blob.type || "audio/mpeg"
      };
    })
  );

  return buildNpcQuickCheckResourceBundle(script, scope, virtualPathBySource, audioAssets);
}

export function buildNpcQuickCheckResourceBundle(
  script: unknown,
  scope: NpcQuickCheckScope,
  virtualPathBySource: Map<string, string>,
  audioAssets: Record<string, NpcQuickCheckAudioAsset> = {}
): NpcQuickCheckResourceBundle {
  const source = recordValue(script);
  const rawQuestions = arrayValue(source.questions).map(recordValue);
  if (rawQuestions.length === 0) throw new Error("NPCQHK01 script has no questions.");

  const questionBase = Math.max(1, scope.actIdx) * 100;
  const questions = rawQuestions.map((question, index) => {
    const choices = arrayValue(question.choices).map(recordValue);
    const correctIndex = choices.findIndex((choice) => choice.ok === true);
    if (choices.length < 2 || correctIndex < 0) {
      throw new Error(`NPCQHK01 question ${index + 1} requires choices with one correct answer.`);
    }

    return {
      id: `npcqhk:${scope.bookIdx}:${scope.dayIdx}:${stringValue(question.id) || index + 1}`,
      qIdx: questionBase + index + 1,
      sequence: index + 1,
      quizCode: 100,
      unityType: 1,
      kind: "single-select" as const,
      sourceIndexBase: 1 as const,
      indexBase: 0 as const,
      question: stringValue(question.original_question),
      questionKo: stringValue(question.ko_hint),
      questionSoundUrl: resourceAudioReference(question.audio, virtualPathBySource),
      options: choices.map((choice, optionIndex) => ({
        index: optionIndex,
        sourceIndex: optionIndex + 1,
        label: stringValue(choice.t ?? choice.text ?? choice.label)
      })),
      subItems: [],
      tokens: [],
      blankPositions: [],
      contentRefs: [],
      correctAnswer: { mode: "single" as const, selectedIndex: correctIndex }
    } satisfies QuickCheckQuestion;
  });

  const endingId = "ending";
  const nodes: NpcQuickCheckScenario["nodes"] = [
    {
      id: "intro",
      type: "dialogue",
      speaker: "npc",
      text: stringValue(recordValue(source.opening).text),
      audioUrl: resourceAudioReference(recordValue(source.opening).audio, virtualPathBySource),
      nextNodeId: "question:1"
    }
  ];

  rawQuestions.forEach((question, index) => {
    const number = index + 1;
    const nextNodeId = index < rawQuestions.length - 1 ? `question:${number + 1}` : endingId;
    const correct = recordValue(question.fb_ok);
    const incorrect = recordValue(question.fb_no);
    nodes.push(
      {
        id: `question:${number}`,
        type: "question",
        qIdx: questions[index].qIdx,
        text: stringValue(question.ko_hint),
        audioUrl: resourceAudioReference(question.audio, virtualPathBySource),
        ttsText: stringValue(question.tts),
        hintText: stringValue(question.ko_hint),
        hintNodeId: "",
        correctNextNodeId: `correct:${number}`,
        incorrectNextNodeId: `incorrect:${number}`
      },
      {
        id: `correct:${number}`,
        type: "dialogue",
        speaker: "npc",
        text: stringValue(correct.text),
        audioUrl: resourceAudioReference(correct.audio, virtualPathBySource),
        nextNodeId
      },
      {
        id: `incorrect:${number}`,
        type: "dialogue",
        speaker: "npc",
        text: stringValue(incorrect.text),
        audioUrl: resourceAudioReference(incorrect.audio, virtualPathBySource),
        nextNodeId
      }
    );
  });

  const closing = recordValue(source.closing);
  nodes.push({
    id: endingId,
    type: "ending",
    text: stringValue(closing.text),
    audioUrl: resourceAudioReference(closing.audio, virtualPathBySource)
  });

  return {
    attemptId: createAttemptId(scope),
    audioAssets,
    questions,
    scenario: {
      scenarioId: `npcqhk:${scope.bookCode}:${scope.dayIdx}:${scope.actIdx}`,
      version: numberValue(source.version) || 1,
      bookIdx: scope.bookIdx,
      dayIdx: scope.dayIdx,
      actIdx: scope.actIdx,
      locale: "ko-KR",
      startNodeId: "intro",
      npc: {
        id: "jade",
        name: stringValue(recordValue(source.voice).name) || "Jade",
        avatarUrl: "",
        voiceId: stringValue(recordValue(source.voice).id)
      },
      scene: { backgroundUrl: "", bgmUrl: "" },
      nodes,
      contentHash: `${scope.bookCode}:${scope.dayIdx}:${numberValue(source.version) || 1}`,
      publishedAt: ""
    }
  };
}

function resolveScope(context: ActivityRendererContext): NpcQuickCheckScope {
  const bookIdx = Number(context.packageMeta?.bookIdx || 0);
  const dayIdx = Number(context.day?.dayIdx || 0);
  const actIdx = Number(context.activity?.actIdx || 0);
  const lesson = Number(context.day?.lesson || 0);
  const day = Number(context.day?.day || 0);
  if (!bookIdx || !dayIdx || !actIdx || !lesson || !day) {
    throw new Error("NPCQHK01 activity scope is incomplete.");
  }
  return {
    bookIdx,
    dayIdx,
    actIdx,
    lesson,
    day,
    bookCode: String(context.packageMeta?.bookId || "NPCQHK")
  };
}

function collectScriptAudioPaths(script: unknown): string[] {
  const result = new Set<string>();
  const seen = new Set<unknown>();

  function visit(value: unknown): void {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (isAudioKey(key) && typeof child === "string" && child.trim()) result.add(child.trim());
      visit(child);
    }
  }

  visit(script);
  return Array.from(result);
}

function resolveCachedAudioPath(resourceBase: string, sourcePath: string): string {
  const normalized = sourcePath.replace(/\\/g, "/").split("?")[0];
  const marker = "/npcqhk/";
  const markerIndex = normalized.toLowerCase().lastIndexOf(marker);
  if (markerIndex >= 0) return `${resourceBase}/${normalized.slice(markerIndex + marker.length)}`;
  if (/^https?:\/\//i.test(normalized)) throw new Error(`NPCQHK01 audio must be under npcqhk/: ${sourcePath}`);
  return `${resourceBase}/${normalized.replace(/^\/+/, "")}`;
}

function resourceAudioReference(value: unknown, virtualPathBySource: Map<string, string>): string {
  const sourcePath = stringValue(value);
  if (!sourcePath) return "";
  const path = virtualPathBySource.get(sourcePath);
  if (!path) throw new Error(`NPCQHK01 audio reference is missing from cache: ${sourcePath}`);
  return `asset:${path}`;
}

function createAttemptId(scope: NpcQuickCheckScope): string {
  const suffix = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `npcqhk:${scope.bookIdx}:${scope.dayIdx}:${scope.actIdx}:${suffix}`;
}

function parseScript(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("NPCQHK01 script.json is invalid.");
  }
}

function readBlobText(blob: Blob): Promise<string> {
  if (typeof blob.text === "function") return blob.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Failed to read NPCQHK01 script."));
    reader.readAsText(blob);
  });
}

function isAudioKey(value: string): boolean {
  const key = value.replace(/[_-]/g, "").toLowerCase();
  return key === "audio" || key === "audios" || key === "audiopath" || key === "audiopaths" || key === "audiourl";
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function numberValue(value: unknown): number {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
