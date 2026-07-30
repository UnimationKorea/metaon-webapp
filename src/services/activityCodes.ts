import { ActType } from "../types/metaonTypes";

export const MetaOnActivityCode = {
  ListenRead: "EBOOK01",
  WordCard: "WDCA01",
  VideoWordCard: "WDCA02",
  WordQuiz: "WDQU01",
  WordSearch: "WDQU02",
  VideoWordQuiz: "WDQU03",
  WordBlank: "WDBL01",
  VideoWordBlank: "WDBL02",
  MatchingGame: "WDPL01",
  MemoryCard: "WDPL02",
  SentenceBlank: "STBL01",
  VideoSentenceBlank: "STBL02",
  Unscramble: "STSC01",
  VideoUnscramble: "STSC02",
  SentenceRecord: "STRC01",
  VideoSentenceRecord: "STRC02",
  QuickCheck: "QCHK01",
  NpcQuickCheck: "NPCQHK01",
  LegacyNpcQuickCheck: "QCNP01",
  NpcQuickCheck2: "NPCQHK02"
} as const;

export type MetaOnActivityCode = (typeof MetaOnActivityCode)[keyof typeof MetaOnActivityCode];

const actTypeByActivityCode = new Map<string, ActType>([
  [MetaOnActivityCode.WordCard, ActType.FlashCardSpace],
  [MetaOnActivityCode.VideoWordCard, ActType.FlashCardSpace],
  [MetaOnActivityCode.WordQuiz, ActType.VocaQuizSpace],
  [MetaOnActivityCode.VideoWordQuiz, ActType.VocaQuizSpace],
  [MetaOnActivityCode.WordSearch, ActType.WordSearch],
  [MetaOnActivityCode.WordBlank, ActType.VocaCheckSpace],
  [MetaOnActivityCode.VideoWordBlank, ActType.VocaCheckSpace],
  [MetaOnActivityCode.MatchingGame, ActType.MatchingGame],
  [MetaOnActivityCode.MemoryCard, ActType.MemoryGame],
  [MetaOnActivityCode.SentenceBlank, ActType.SentenceCheckSpace],
  [MetaOnActivityCode.VideoSentenceBlank, ActType.SentenceCheckSpace],
  [MetaOnActivityCode.Unscramble, ActType.SentenceUnscrambleSpace],
  [MetaOnActivityCode.VideoUnscramble, ActType.SentenceUnscrambleSpace],
  [MetaOnActivityCode.SentenceRecord, ActType.SentenceShadowingSpace],
  [MetaOnActivityCode.VideoSentenceRecord, ActType.SentenceShadowingSpace],
  [MetaOnActivityCode.QuickCheck, ActType.QuickCheck],
  [MetaOnActivityCode.NpcQuickCheck, ActType.QuickCheck],
  [MetaOnActivityCode.LegacyNpcQuickCheck, ActType.QuickCheck],
  [MetaOnActivityCode.NpcQuickCheck2, ActType.QuickCheck]
]);

const activityCodeByActType = new Map<ActType, MetaOnActivityCode>([
  [ActType.Listening, MetaOnActivityCode.ListenRead],
  [ActType.Reading, MetaOnActivityCode.ListenRead],
  [ActType.FlashCard, MetaOnActivityCode.WordCard],
  [ActType.FlashCard2, MetaOnActivityCode.WordCard],
  [ActType.SimpleFlashCard, MetaOnActivityCode.WordCard],
  [ActType.FlashCardSpace, MetaOnActivityCode.WordCard],
  [ActType.SoundWord, MetaOnActivityCode.WordCard],
  [ActType.VocaQuiz, MetaOnActivityCode.WordQuiz],
  [ActType.VocaQuizSpace, MetaOnActivityCode.WordQuiz],
  [ActType.WordSearch, MetaOnActivityCode.WordSearch],
  [ActType.VocaCheck, MetaOnActivityCode.WordBlank],
  [ActType.VocaCheckSpace, MetaOnActivityCode.WordBlank],
  [ActType.MatchingGame, MetaOnActivityCode.MatchingGame],
  [ActType.MemoryGame, MetaOnActivityCode.MemoryCard],
  [ActType.SentenceCheck, MetaOnActivityCode.SentenceBlank],
  [ActType.SentenceCheckSpace, MetaOnActivityCode.SentenceBlank],
  [ActType.SentenceUnscramble, MetaOnActivityCode.Unscramble],
  [ActType.SentenceUnscrambleSpace, MetaOnActivityCode.Unscramble],
  [ActType.SentenceShadowing, MetaOnActivityCode.SentenceRecord],
  [ActType.SentenceShadowingSpace, MetaOnActivityCode.SentenceRecord],
  [ActType.QuickCheck, MetaOnActivityCode.QuickCheck]
]);

const titleByActivityCode = new Map<MetaOnActivityCode, string>([
  [MetaOnActivityCode.ListenRead, "Listen & Read"],
  [MetaOnActivityCode.WordCard, "Word Card"],
  [MetaOnActivityCode.VideoWordCard, "Word Card"],
  [MetaOnActivityCode.WordQuiz, "Word Quiz"],
  [MetaOnActivityCode.WordSearch, "Word Search"],
  [MetaOnActivityCode.VideoWordQuiz, "Word Quiz"],
  [MetaOnActivityCode.WordBlank, "Word Blank"],
  [MetaOnActivityCode.VideoWordBlank, "Word Blank"],
  [MetaOnActivityCode.MatchingGame, "Matching Game"],
  [MetaOnActivityCode.MemoryCard, "Memory Card"],
  [MetaOnActivityCode.SentenceBlank, "Sentence Blank"],
  [MetaOnActivityCode.VideoSentenceBlank, "Sentence Blank"],
  [MetaOnActivityCode.Unscramble, "Unscramble"],
  [MetaOnActivityCode.VideoUnscramble, "Unscramble"],
  [MetaOnActivityCode.SentenceRecord, "Sentence Record"],
  [MetaOnActivityCode.VideoSentenceRecord, "Sentence Record"],
  [MetaOnActivityCode.QuickCheck, "Quick Check"],
  [MetaOnActivityCode.NpcQuickCheck, "NPC Quick Check"],
  [MetaOnActivityCode.LegacyNpcQuickCheck, "NPC Quick Check"],
  [MetaOnActivityCode.NpcQuickCheck2, "NPC Quick Check"]
]);

export function normalizeActivityCode(value: unknown): string {
  return value == null ? "" : String(value).trim().toUpperCase();
}

export function resolveActTypeFromActivityCode(
  value: unknown,
  options: { category?: string; title?: string } = {}
): ActType | undefined {
  const code = normalizeActivityCode(value);
  if (!code) return undefined;

  if (code === MetaOnActivityCode.ListenRead) {
    return isReadingOnlyActivity(options) ? ActType.Reading : ActType.Listening;
  }

  const mapped = actTypeByActivityCode.get(code);
  if (mapped) return mapped;

  const parsed = Number(code);
  if (Number.isFinite(parsed) && parsed > 0) return parsed as ActType;

  return undefined;
}

export function canonicalActivityCodeForActType(actType?: ActType, fallback?: unknown): string {
  const normalizedFallback = normalizeActivityCode(fallback);
  if (normalizedFallback && (actTypeByActivityCode.has(normalizedFallback) || normalizedFallback === MetaOnActivityCode.ListenRead)) {
    return normalizedFallback;
  }

  if (actType != null) {
    return activityCodeByActType.get(actType) || normalizedFallback || String(actType);
  }

  return normalizedFallback;
}

export function activityTitleForCode(activityCode: unknown, fallbackTitle: string): string {
  const normalized = normalizeActivityCode(activityCode) as MetaOnActivityCode;
  return titleByActivityCode.get(normalized) || fallbackTitle;
}

function isReadingOnlyActivity(options: { category?: string; title?: string }): boolean {
  const category = normalizeActivityCode(options.category).toLowerCase();
  const title = normalizeActivityCode(options.title).toLowerCase();
  return category === "reading" && !title.includes("listen");
}
