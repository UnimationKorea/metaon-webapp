import type { NpcQuickCheckScenario } from "../../../shared/npcQuickCheckScenario.mjs";
import { getWrongItems, type WrongLearnItems } from "../../api/uniplanetApi";
import { indexedDbStorage } from "../../services/indexedDbStorage";
import type { ActivityRendererContext } from "../../types/metaonTypes";
import type { QuickCheckContentRef, QuickCheckQuestion } from "../quickCheck/quickCheckTypes";
import type { NpcQuickCheckAudioAsset, NpcQuickCheckResourceBundle } from "./npcQuickCheckResourceAdapter";

type NpcQuickCheck2Scope = {
  actIdx: number;
  bookCode: string;
  bookIdx: number;
  dayIdx: number;
  lesson: number;
  day: number;
};

type SelectedItem = {
  itemIdx: number;
  itemType: "word" | "sentence";
  ko: string;
  variantName: "weak" | "relearn";
  variant: Record<string, unknown>;
};

/**
 * Loads the personalized NPC Quick Check (NPCQHK02) resource bundle.
 *
 * Unlike NPCQHK01, the cached script.json lives under `.../npcqhk2` and is authored as
 * `opening` / `items[]` / `closing`, where every item carries an `item_idx` plus two
 * variants (`weak` = 취약/오답 학습, `relearn` = 재학습). On entry we ask the server which
 * word/sentence items the learner has gotten wrong at least once (`/learn/wrong-items`,
 * scoped by book) and pick the `weak` variant for those and `relearn` for the rest — every
 * item is presented exactly once. The wrong-items snapshot is taken once here, so the
 * resulting question set is immutable for the session.
 *
 * The bundle shape is identical to NPCQHK01 so the Parent host, RPC, scenario runtime and
 * iframe Viewer are reused without modification. Audio files are `.webm` (Opus) — we force
 * `audio/webm` MIME so the Viewer treats them as audio, not video.
 */
export async function loadNpcQuickCheck2Resource(context: ActivityRendererContext): Promise<NpcQuickCheckResourceBundle> {
  const scope = resolveScope(context);
  const packageKey = context.packageMeta?.key;
  const resourceBase = `Lessons/L${scope.lesson}/D${scope.day}/npcqhk2`;
  const scriptPath = `${resourceBase}/script.json`;
  if (!packageKey) throw new Error("Book resources are not cached.");

  const scriptBlob = await indexedDbStorage.getFileBlob(packageKey, scriptPath);
  if (!scriptBlob) throw new Error("NPCQHK02 script.json is not cached. Download this Book again.");
  const script = parseScript(await readBlobText(scriptBlob));

  const wrongItems = await loadWrongItems(scope.bookIdx);
  const wrongIdx = collectWrongIdx(wrongItems);
  const selected = selectItems(script, wrongIdx);
  if (selected.length === 0) throw new Error("NPCQHK02 script has no items.");

  const audioAssets: Record<string, NpcQuickCheckAudioAsset> = {};
  const bundle = buildNpcQuickCheck2ResourceBundle(script, scope, selected, resourceBase);

  // Load only the audio referenced by the built scenario/questions (opening + selected variants + closing).
  await Promise.all(
    Array.from(collectBundleAudioPaths(bundle)).map(async (path) => {
      const blob = await indexedDbStorage.getFileBlob(packageKey, path);
      if (!blob) throw new Error(`NPCQHK02 audio is not cached: ${path}`);
      audioAssets[path] = {
        data: await blob.arrayBuffer(),
        mimeType: mimeTypeForAudio(path, blob.type)
      };
    })
  );

  return { ...bundle, audioAssets };
}

async function loadWrongItems(bookIdx: number): Promise<WrongLearnItems> {
  try {
    return await getWrongItems(bookIdx);
  } catch {
    // If the personalization endpoint is unavailable, fall back to "no wrong items"
    // (every item is presented as relearn), so the activity still runs.
    return { words: [], sentences: [] };
  }
}

function collectWrongIdx(wrongItems: WrongLearnItems): Set<number> {
  const idx = new Set<number>();
  for (const item of [...wrongItems.words, ...wrongItems.sentences]) {
    if (item.item_idx > 0) idx.add(item.item_idx);
  }
  return idx;
}

export function selectItems(script: unknown, wrongIdx: Set<number>): SelectedItem[] {
  const source = recordValue(script);
  return arrayValue(source.items)
    .map(recordValue)
    .map((item) => {
      const itemIdx = numberValue(item.item_idx ?? item.itemIdx);
      const itemType: "word" | "sentence" = stringValue(item.type) === "sentence" ? "sentence" : "word";
      const variantName: "weak" | "relearn" = wrongIdx.has(itemIdx) ? "weak" : "relearn";
      const variant = recordValue(item[variantName] ?? item.relearn ?? item.weak);
      return { itemIdx, itemType, ko: stringValue(item.ko), variantName, variant };
    })
    .filter((item) => item.itemIdx > 0 && arrayValue(item.variant.choices).length >= 2);
}

export function buildNpcQuickCheck2ResourceBundle(
  script: unknown,
  scope: NpcQuickCheck2Scope,
  selected: SelectedItem[],
  resourceBase: string
): NpcQuickCheckResourceBundle {
  const source = recordValue(script);
  const questionBase = Math.max(1, scope.actIdx) * 100;

  const questions: QuickCheckQuestion[] = selected.map((item, index) => {
    const choices = arrayValue(item.variant.choices).map(recordValue);
    const correctIndex = choices.findIndex((choice) => choice.ok === true);
    if (choices.length < 2 || correctIndex < 0) {
      throw new Error(`NPCQHK02 item ${item.itemIdx} requires choices with one correct answer.`);
    }
    const contentRefs: QuickCheckContentRef[] = [{ itemType: item.itemType, itemIdx: item.itemIdx }];

    return {
      id: `npcqhk2:${scope.bookIdx}:${scope.dayIdx}:${item.itemIdx}:${item.variantName}`,
      qIdx: questionBase + index + 1,
      sequence: index + 1,
      quizCode: 100,
      unityType: 1,
      kind: "single-select" as const,
      sourceIndexBase: 1 as const,
      indexBase: 0 as const,
      question: stringValue(item.variant.question),
      questionKo: item.ko,
      questionSoundUrl: audioReference(resourceBase, item.variant.audio),
      options: choices.map((choice, optionIndex) => ({
        index: optionIndex,
        sourceIndex: optionIndex + 1,
        label: stringValue(choice.t ?? choice.text ?? choice.label)
      })),
      subItems: [],
      tokens: [],
      blankPositions: [],
      contentRefs,
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
      audioUrl: audioReference(resourceBase, recordValue(source.opening).audio),
      nextNodeId: "question:1"
    }
  ];

  selected.forEach((item, index) => {
    const number = index + 1;
    const nextNodeId = index < selected.length - 1 ? `question:${number + 1}` : endingId;
    const correct = recordValue(item.variant.fb_ok);
    const incorrect = recordValue(item.variant.fb_no);
    nodes.push(
      {
        id: `question:${number}`,
        type: "question",
        qIdx: questions[index].qIdx,
        text: item.ko || stringValue(item.variant.question),
        audioUrl: audioReference(resourceBase, item.variant.audio),
        ttsText: stringValue(item.variant.tts),
        hintText: item.ko || stringValue(item.variant.question),
        hintNodeId: "",
        correctNextNodeId: `correct:${number}`,
        incorrectNextNodeId: `incorrect:${number}`
      },
      {
        id: `correct:${number}`,
        type: "dialogue",
        speaker: "npc",
        text: stringValue(correct.text),
        audioUrl: audioReference(resourceBase, correct.audio),
        nextNodeId
      },
      {
        id: `incorrect:${number}`,
        type: "dialogue",
        speaker: "npc",
        text: stringValue(incorrect.text),
        audioUrl: audioReference(resourceBase, incorrect.audio),
        nextNodeId
      }
    );
  });

  const closing = recordValue(source.closing);
  nodes.push({
    id: endingId,
    type: "ending",
    text: stringValue(closing.text),
    audioUrl: audioReference(resourceBase, closing.audio)
  });

  return {
    attemptId: createAttemptId(scope),
    audioAssets: {},
    questions,
    scenario: {
      scenarioId: `npcqhk2:${scope.bookCode}:${scope.dayIdx}:${scope.actIdx}`,
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

function resolveScope(context: ActivityRendererContext): NpcQuickCheck2Scope {
  const bookIdx = Number(context.packageMeta?.bookIdx || 0);
  const dayIdx = Number(context.day?.dayIdx || 0);
  const actIdx = Number(context.activity?.actIdx || 0);
  const lesson = Number(context.day?.lesson || 0);
  const day = Number(context.day?.day || 0);
  if (!bookIdx || !dayIdx || !actIdx || !lesson || !day) {
    throw new Error("NPCQHK02 activity scope is incomplete.");
  }
  return {
    bookIdx,
    dayIdx,
    actIdx,
    lesson,
    day,
    bookCode: String(context.packageMeta?.bookId || "NPCQHK2")
  };
}

function collectBundleAudioPaths(bundle: NpcQuickCheckResourceBundle): Set<string> {
  const paths = new Set<string>();
  const add = (value: string | undefined) => {
    if (value && value.startsWith("asset:")) paths.add(value.slice("asset:".length));
  };
  for (const node of bundle.scenario.nodes) {
    add((node as { audioUrl?: string }).audioUrl);
  }
  for (const question of bundle.questions) {
    add(question.questionSoundUrl);
  }
  return paths;
}

function audioReference(resourceBase: string, value: unknown): string {
  const sourcePath = stringValue(value);
  if (!sourcePath) return "";
  if (/^https?:\/\//i.test(sourcePath)) return sourcePath;
  const normalized = sourcePath.replace(/\\/g, "/").split("?")[0].replace(/^\.?\/+/, "");
  return `asset:${resourceBase}/${normalized}`;
}

function mimeTypeForAudio(path: string, blobType: string): string {
  if (/\.webm(?:\?.*)?$/i.test(path)) return "audio/webm";
  return blobType || "audio/mpeg";
}

function createAttemptId(scope: NpcQuickCheck2Scope): string {
  const suffix = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `npcqhk2:${scope.bookIdx}:${scope.dayIdx}:${scope.actIdx}:${suffix}`;
}

function parseScript(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("NPCQHK02 script.json is invalid.");
  }
}

function readBlobText(blob: Blob): Promise<string> {
  if (typeof blob.text === "function") return blob.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Failed to read NPCQHK02 script."));
    reader.readAsText(blob);
  });
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
