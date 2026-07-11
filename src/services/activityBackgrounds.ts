import { getActTypeDefinition, type ActTypeDefinition } from "./actTypeCatalog";
import { ActType } from "../types/metaonTypes";

const UNITY_ACTIVITY_BG_BASE = "/unity-activity-bg";
const DEFAULT_ACTIVITY_BACKGROUND = `${UNITY_ACTIVITY_BG_BASE}/activity-ui.png`;

const activityBackgroundByType: Partial<Record<ActType, string>> = {
  [ActType.VocaPreview]: "1004.png",
  [ActType.StoryReview]: "66.png",
  [ActType.VocaQuiz]: "4.png",
  [ActType.VocaCheck]: "5.png",
  [ActType.SentenceCheck]: "6.png",
  [ActType.SentenceUnscramble]: "7.png",
  [ActType.MatchingGame]: "1004.png",
  [ActType.SentenceShadowing]: "9.png",
  [ActType.Writing]: "48.png",
  [ActType.MemoryGame]: "1004.png",
  [ActType.FlashCard]: "17.png",
  [ActType.GameSpace]: "1004.png",
  [ActType.SoundWord]: "21.png",
  [ActType.SoundCheck]: "23.png",
  [ActType.SpellingCheck]: "24.png",
  [ActType.Dictation]: "25.png",
  [ActType.FlashCard2]: "17.png",
  [ActType.WordPuzzle]: "27.png",
  [ActType.WordSearch]: "28.png",
  [ActType.SoundCheckPen]: "23.png",
  [ActType.WriteQuiz]: "30.png",
  [ActType.ListenRecord]: "32.png",
  [ActType.QuizShow]: "44.png",
  [ActType.WriteWord]: "48.png",
  [ActType.PeelingWord]: "1004.png",
  [ActType.WordBox]: "1004.png",
  [ActType.StoryBook]: "51.png",
  [ActType.WordPuzzle2]: "27.png",
  [ActType.SpinAndRead]: "56.png",
  [ActType.ReadAndFlip]: "56.png",
  [ActType.CatchImage]: "58.png",
  [ActType.UnderSea]: "1004.png",
  [ActType.QuickCheck]: "65.png",
  [ActType.Reading]: "66.png",
  [ActType.SimpleFlashCard]: "17.png",
  [ActType.VocaQuizSpace]: "1004.png",
  [ActType.VocaCheckSpace]: "1005.png",
  [ActType.SentenceCheckSpace]: "1006.png",
  [ActType.SentenceUnscrambleSpace]: "1007.png",
  [ActType.SentenceShadowingSpace]: "1009.png",
  [ActType.FlashCardSpace]: "1017.png",
  [ActType.ListenRecordSpace]: "1032.png",
  [ActType.StoryBookSpace]: "1051.png",
  [ActType.Reading1]: "1101.png",
  [ActType.Reading2]: "1201.png",
  [ActType.Reading3]: "1301.png",
  [ActType.Reading4]: "1401.png",
  [ActType.Reading5]: "1501.png"
};

const fallbackByCategory: Record<ActTypeDefinition["category"], string> = {
  word: "1004.png",
  sentence: "1007.png",
  story: "66.png",
  video: "activity-ui.png",
  book: "activity-ui.png",
  quiz: "65.png",
  tool: "activity-ui.png",
  external: "activity-ui.png"
};

export function getActivityBackgroundUrl(actType?: ActType): string {
  const mappedFile = actType == null ? undefined : activityBackgroundByType[actType];
  if (mappedFile) return `${UNITY_ACTIVITY_BG_BASE}/${mappedFile}`;

  const fallbackFile = fallbackByCategory[getActTypeDefinition(actType)?.category || "book"];
  return fallbackFile ? `${UNITY_ACTIVITY_BG_BASE}/${fallbackFile}` : DEFAULT_ACTIVITY_BACKGROUND;
}
