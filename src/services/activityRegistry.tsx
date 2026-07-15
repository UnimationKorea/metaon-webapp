import {
  BookPageActivity,
  EbookActivity,
  FlashCardActivity,
  ListenRecordActivity,
  ListeningActivity,
  MatchingGameActivity,
  MemoryGameActivity,
  MovieActivity,
  PendingActivity,
  PeelingWordActivity,
  ReadAndFlipActivity,
  ReadingActivity,
  SentenceBlankActivity,
  SentenceRecordActivity,
  SentenceUnscrambleActivity,
  SequencingActivity,
  SpellingActivity,
  SpellingFishActivity,
  StoryCheckActivity,
  VocaQuizActivity,
  WordBlankActivity,
  WordChoiceActivity,
  WordBoxActivity,
  WordPuzzleActivity,
  WordSearchActivity,
  WriteWordActivity,
  rendererNameForActType
} from "../components/activities/PackageActivities";
import { QuickCheckActivity } from "../features/quickCheck/QuickCheckActivity";
import { NpcQuickCheckActivity } from "../features/npcQuickCheck/NpcQuickCheckActivity";
import { allUnityActTypes, getActTypeDefinition, getActTypeLabel } from "./actTypeCatalog";
import { MetaOnActivityCode, normalizeActivityCode } from "./activityCodes";
import { ActType, type ActivityRenderer } from "../types/metaonTypes";

export const recognizedActTypes = new Set<ActType>(allUnityActTypes);

export const portedActTypes = new Set<ActType>([
  ActType.Reading,
  ActType.Listening,
  ActType.Ebook,
  ActType.VocaPreview,
  ActType.FlashCard,
  ActType.FlashCard2,
  ActType.SimpleFlashCard,
  ActType.FlashCardSpace,
  ActType.SoundWord,
  ActType.VocaQuiz,
  ActType.VocaCheck,
  ActType.VocaCheckSpace,
  ActType.MatchingGame,
  ActType.MemoryGame,
  ActType.GameSpace,
  ActType.SoundCheck,
  ActType.SpellingCheck,
  ActType.WordPuzzle,
  ActType.WordSearch,
  ActType.PeelingWord,
  ActType.WordPuzzle2,
  ActType.UnderSea,
  ActType.WriteQuiz,
  ActType.SentenceCheck,
  ActType.SentenceCheckSpace,
  ActType.SentenceUnscramble,
  ActType.SentenceUnscrambleSpace,
  ActType.ListenRecord,
  ActType.BookPage,
  ActType.MoviePlay,
  ActType.Reading2,
  ActType.WordBox,
  ActType.ReadAndFlip,
  ActType.VocaQuizSpace,
  ActType.ListenRecordSpace,
  ActType.WriteWord,
  ActType.Reading5,
  ActType.SentenceShadowing,
  ActType.SentenceShadowingSpace,
  ActType.QuickCheck
]);

export const activityRenderers: ActivityRenderer[] = [
  {
    actType: ActType.VocaPreview,
    name: "Vocabulary Preview",
    requires: ["audio", "indexeddb"],
    loadAssets: async () => undefined,
    render: (context) => <FlashCardActivity context={context} label="Vocabulary Preview" />
  },
  {
    actType: ActType.FlashCard,
    name: "Flash Card",
    requires: ["audio", "indexeddb"],
    loadAssets: async () => undefined,
    render: (context) => <FlashCardActivity context={context} />
  },
  {
    actType: ActType.FlashCard2,
    name: "Flash Card 2",
    requires: ["audio", "indexeddb"],
    loadAssets: async () => undefined,
    render: (context) => <FlashCardActivity context={context} label="Flash Card" />
  },
  {
    actType: ActType.SimpleFlashCard,
    name: "Simple Flash Card",
    requires: ["audio", "indexeddb"],
    loadAssets: async () => undefined,
    render: (context) => <FlashCardActivity context={context} label="Simple Flash Card" />
  },
  {
    actType: ActType.FlashCardSpace,
    name: "Word Card",
    requires: ["audio", "indexeddb"],
    loadAssets: async () => undefined,
    render: (context) => <FlashCardActivity context={context} label="Word Card" />
  },
  {
    actType: ActType.SoundWord,
    name: "Sound Word",
    requires: ["audio", "indexeddb"],
    loadAssets: async () => undefined,
    render: (context) => <FlashCardActivity context={context} label="Sound Word" />
  },
  {
    actType: ActType.VocaCheck,
    name: "Voca Check",
    requires: ["audio", "indexeddb"],
    loadAssets: async () => undefined,
    render: (context) => <WordBlankActivity context={context} label="Word Blank" />
  },
  {
    actType: ActType.VocaCheckSpace,
    name: "Word Blank",
    requires: ["audio", "indexeddb"],
    loadAssets: async () => undefined,
    render: (context) => <WordBlankActivity context={context} label="Word Blank" />
  },
  {
    actType: ActType.MatchingGame,
    name: "Matching Game",
    requires: ["audio", "indexeddb"],
    loadAssets: async () => undefined,
    render: (context) => <MatchingGameActivity context={context} />
  },
  {
    actType: ActType.MemoryGame,
    name: "Memory Card",
    requires: ["audio", "indexeddb"],
    loadAssets: async () => undefined,
    render: (context) => <MemoryGameActivity context={context} label="Memory Card" />
  },
  {
    actType: ActType.GameSpace,
    name: "Space Game",
    requires: ["audio", "indexeddb"],
    loadAssets: async () => undefined,
    render: (context) => <WordChoiceActivity context={context} label="Space Game" />
  },
  {
    actType: ActType.SoundCheck,
    name: "Sound Check",
    requires: ["audio", "indexeddb"],
    loadAssets: async () => undefined,
    render: (context) => <WordChoiceActivity context={context} label="Sound Check" promptMode="audio" />
  },
  {
    actType: ActType.SpellingCheck,
    name: "Spelling Check",
    requires: ["audio", "indexeddb"],
    loadAssets: async () => undefined,
    render: (context) => <SpellingActivity context={context} label="Spelling Check" />
  },
  {
    actType: ActType.UnderSea,
    name: "Spelling Fish",
    requires: ["audio", "indexeddb"],
    loadAssets: async () => undefined,
    render: (context) => <SpellingFishActivity context={context} />
  },
  {
    actType: ActType.WriteQuiz,
    name: "Write Quiz",
    requires: ["audio", "indexeddb"],
    loadAssets: async () => undefined,
    render: (context) => <SpellingActivity context={context} label="Write Quiz" />
  },
  {
    actType: ActType.WordPuzzle,
    name: "Word Puzzle",
    requires: ["audio", "indexeddb"],
    loadAssets: async () => undefined,
    render: (context) => <WordPuzzleActivity context={context} />
  },
  {
    actType: ActType.WordPuzzle2,
    name: "Word Puzzle 2",
    requires: ["audio", "indexeddb"],
    loadAssets: async () => undefined,
    render: (context) => <WordPuzzleActivity context={context} label="Word Puzzle 2" />
  },
  {
    actType: ActType.WordSearch,
    name: "Word Search",
    requires: ["audio", "indexeddb"],
    loadAssets: async () => undefined,
    render: (context) => <WordSearchActivity context={context} />
  },
  {
    actType: ActType.PeelingWord,
    name: "Peeling Word",
    requires: ["audio", "indexeddb"],
    loadAssets: async () => undefined,
    render: (context) => <PeelingWordActivity context={context} />
  },
  {
    actType: ActType.BookPage,
    name: "Preview",
    requires: ["indexeddb"],
    loadAssets: async () => undefined,
    render: (context) => <BookPageActivity context={context} />
  },
  {
    actType: ActType.MoviePlay,
    name: "Movie",
    requires: ["video", "indexeddb"],
    loadAssets: async () => undefined,
    render: (context) => <MovieActivity context={context} />
  },
  {
    actType: ActType.Reading2,
    name: "Story Check",
    requires: ["indexeddb"],
    loadAssets: async () => undefined,
    render: (context) => <StoryCheckActivity context={context} />
  },
  {
    actType: ActType.WordBox,
    name: "Word Box",
    requires: ["audio", "indexeddb"],
    loadAssets: async () => undefined,
    render: (context) => <WordBoxActivity context={context} />
  },
  {
    actType: ActType.ReadAndFlip,
    name: "Read & Flip",
    requires: ["indexeddb"],
    loadAssets: async () => undefined,
    render: (context) => <ReadAndFlipActivity context={context} />
  },
  {
    actType: ActType.VocaQuizSpace,
    name: "Word Quiz",
    requires: ["audio", "indexeddb"],
    loadAssets: async () => undefined,
    render: (context) => <VocaQuizActivity context={context} />
  },
  {
    actType: ActType.ListenRecordSpace,
    name: "Word Record",
    requires: ["audio", "microphone", "recorder", "recognition", "indexeddb"],
    loadAssets: async () => undefined,
    render: (context) => <ListenRecordActivity context={context} />
  },
  {
    actType: ActType.WriteWord,
    name: "Write Word",
    requires: ["indexeddb"],
    loadAssets: async () => undefined,
    render: (context) => <WriteWordActivity context={context} />
  },
  {
    actType: ActType.Reading5,
    name: "Sequencing",
    requires: ["indexeddb"],
    loadAssets: async () => undefined,
    render: (context) => <SequencingActivity context={context} />
  },
  {
    actType: ActType.SentenceShadowing,
    name: "Sentence Record",
    requires: ["audio", "microphone", "recorder", "recognition", "indexeddb"],
    loadAssets: async () => undefined,
    render: (context) => <SentenceRecordActivity context={context} />
  },
  {
    actType: ActType.SentenceShadowingSpace,
    name: "Sentence Record",
    requires: ["audio", "microphone", "recorder", "recognition", "indexeddb"],
    loadAssets: async () => undefined,
    render: (context) => <SentenceRecordActivity context={context} />
  },
  {
    actType: ActType.Reading,
    name: "Listen & Read",
    requires: ["audio", "indexeddb"],
    loadAssets: async () => undefined,
    render: (context) => <ReadingActivity context={context} />
  },
  {
    actType: ActType.Listening,
    name: "Listen & Read",
    requires: ["audio", "indexeddb"],
    loadAssets: async () => undefined,
    render: (context) => <ListeningActivity context={context} />
  },
  {
    actType: ActType.Ebook,
    name: "Ebook",
    requires: ["indexeddb"],
    loadAssets: async () => undefined,
    render: (context) => <EbookActivity context={context} />
  },
  {
    actType: ActType.VocaQuiz,
    name: "Voca Quiz",
    requires: ["audio", "indexeddb"],
    loadAssets: async () => undefined,
    render: (context) => <VocaQuizActivity context={context} />
  },
  {
    actType: ActType.SentenceCheck,
    name: "Sentence Blank",
    requires: ["audio", "indexeddb"],
    loadAssets: async () => undefined,
    render: (context) => <SentenceBlankActivity context={context} />
  },
  {
    actType: ActType.SentenceCheckSpace,
    name: "Sentence Blank",
    requires: ["audio", "indexeddb"],
    loadAssets: async () => undefined,
    render: (context) => <SentenceBlankActivity context={context} />
  },
  {
    actType: ActType.SentenceUnscramble,
    name: "Sentence Unscramble",
    requires: ["audio", "indexeddb"],
    loadAssets: async () => undefined,
    render: (context) => <SentenceUnscrambleActivity context={context} />
  },
  {
    actType: ActType.SentenceUnscrambleSpace,
    name: "Unscramble",
    requires: ["audio", "indexeddb"],
    loadAssets: async () => undefined,
    render: (context) => <SentenceUnscrambleActivity context={context} label="Unscramble" />
  },
  {
    actType: ActType.ListenRecord,
    name: "Listen & Record",
    requires: ["audio", "microphone", "recorder", "recognition", "indexeddb"],
    loadAssets: async () => undefined,
    render: (context) => <ListenRecordActivity context={context} />
  },
  {
    actType: ActType.QuickCheck,
    name: "Quick Check",
    requires: ["indexeddb"],
    loadAssets: async () => undefined,
    render: (context) => <QuickCheckActivity context={context} />
  }
];

const npcQuickCheckRenderer: ActivityRenderer = {
  actType: ActType.QuickCheck,
  name: "NPC Quick Check",
  requires: ["audio", "indexeddb"],
  loadAssets: async () => undefined,
  render: (context) => <NpcQuickCheckActivity context={context} />
};

export function getActivityRenderer(actType?: ActType, activityCode?: string): ActivityRenderer {
  const normalizedActivityCode = normalizeActivityCode(activityCode);
  if (
    normalizedActivityCode === MetaOnActivityCode.NpcQuickCheck ||
    normalizedActivityCode === MetaOnActivityCode.LegacyNpcQuickCheck
  ) {
    return npcQuickCheckRenderer;
  }

  const renderer = activityRenderers.find((item) => item.actType === actType);
  if (renderer) return renderer;

  const compatibleRenderer = getCompatibleActivityRenderer(actType);
  if (compatibleRenderer) return compatibleRenderer;

  return {
    actType: actType || ActType.BookPage,
    name: rendererNameForActType(actType),
    requires: [],
    loadAssets: async () => undefined,
    render: (context) => <PendingActivity context={context} />
  };
}

function getCompatibleActivityRenderer(actType?: ActType): ActivityRenderer | undefined {
  if (!actType) return undefined;

  const definition = getActTypeDefinition(actType);
  if (!definition || definition.status !== "compatible-renderer") return undefined;

  const base: Omit<ActivityRenderer, "render"> = {
    actType,
    name: getActTypeLabel(actType),
    requires: definition.category === "video" ? ["video", "indexeddb"] : definition.category === "external" ? [] : ["indexeddb"],
    loadAssets: async () => undefined
  };

  if (definition.category === "word") {
    return { ...base, render: (context) => <WordBoxActivity context={context} /> };
  }

  if (definition.category === "sentence") {
    return { ...base, render: (context) => <SentenceUnscrambleActivity context={context} /> };
  }

  if (definition.category === "story") {
    return { ...base, render: (context) => <ReadingActivity context={context} /> };
  }

  if (definition.category === "video") {
    return { ...base, render: (context) => <MovieActivity context={context} label={definition.label} /> };
  }

  if (definition.category === "book") {
    return { ...base, render: (context) => <BookPageActivity context={context} /> };
  }

  if (definition.category === "quiz") {
    return { ...base, render: (context) => <StoryCheckActivity context={context} /> };
  }

  return undefined;
}
