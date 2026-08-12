import { MetaOnActivityCode, normalizeActivityCode } from "./activityCodes";
import type { Activity, BookResource, LessonDay } from "../types/metaonTypes";

export type BookResourceDownloadPlan = {
  immediateResources: BookResource[];
  deferredResources: BookResource[];
  orderedResources: BookResource[];
};

/**
 * The Book screen always starts from its first Activity. Fetch that Activity
 * and the next one first, then let the remaining Book resources follow in a
 * stable manifest order.
 */
export function planBookResourceDownload(
  resources: BookResource[],
  lessonDays: LessonDay[]
): BookResourceDownloadPlan {
  const firstActivities = lessonDays
    .flatMap((day) => day.activities.map((activity) => ({ activity, day })))
    .slice(0, 2);
  const ranked = resources.map((resource, index) => ({
    resource,
    index,
    priority: resourcePriority(resource, firstActivities)
  }));
  const immediateResources = ranked
    .filter((entry) => entry.priority < 2)
    .sort(compareByPriority)
    .map((entry) => entry.resource);
  const deferredResources = ranked
    .filter((entry) => entry.priority >= 2)
    .sort(compareByPriority)
    .map((entry) => entry.resource);

  return {
    immediateResources,
    deferredResources,
    orderedResources: [...immediateResources, ...deferredResources]
  };
}

function compareByPriority(
  left: { priority: number; index: number },
  right: { priority: number; index: number }
): number {
  return left.priority - right.priority || left.index - right.index;
}

function resourcePriority(
  resource: BookResource,
  activities: Array<{ activity: Activity; day: LessonDay }>
): number {
  for (const [index, entry] of activities.entries()) {
    if (resourceMatchesActivity(resource, entry.activity, entry.day)) return index;
  }
  return 2;
}

function resourceMatchesActivity(resource: BookResource, activity: Activity, day: LessonDay): boolean {
  const base = `Lessons/L${day.lesson}/D${day.day}/`.toLowerCase();
  const path = resource.path.replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase();
  if (!path.startsWith(base)) return false;

  const relativePath = path.slice(base.length);
  return foldersForActivity(activity).some((folder) => relativePath.startsWith(folder));
}

function foldersForActivity(activity: Activity): string[] {
  const code = normalizeActivityCode(activity.activityCode);
  switch (code) {
    case MetaOnActivityCode.ListenRead:
      return ["ebook/", "reading/", "listening/"];
    case MetaOnActivityCode.WordCard:
    case MetaOnActivityCode.WordQuiz:
    case MetaOnActivityCode.WordSearch:
    case MetaOnActivityCode.WordBlank:
    case MetaOnActivityCode.MatchingGame:
    case MetaOnActivityCode.MemoryCard:
      return ["word/"];
    case MetaOnActivityCode.VideoWordCard:
    case MetaOnActivityCode.VideoWordQuiz:
    case MetaOnActivityCode.VideoWordBlank:
      return ["word/", `${code.toLowerCase()}/`, "video/"];
    case MetaOnActivityCode.SentenceBlank:
      return ["sentence/", "word/"];
    case MetaOnActivityCode.VideoSentenceBlank:
      return ["sentence/", "word/", "stbl02/", "video/"];
    case MetaOnActivityCode.Unscramble:
      return ["sentence/"];
    case MetaOnActivityCode.VideoUnscramble:
      return ["sentence/", "stsc02/", "video/"];
    case MetaOnActivityCode.SentenceRecord:
      return ["sentence/"];
    case MetaOnActivityCode.VideoSentenceRecord:
      return ["sentence/", "strc02/", "video/"];
    case MetaOnActivityCode.Movie:
      return ["movie/"];
    case MetaOnActivityCode.NpcQuickCheck:
      return ["npcqhk/"];
    case MetaOnActivityCode.NpcQuickCheck2:
      return ["npcqhk2/"];
    default:
      return foldersForActivityCategory(activity.category);
  }
}

function foldersForActivityCategory(category?: string): string[] {
  switch ((category || "").trim().toLowerCase()) {
    case "word":
      return ["word/"];
    case "sentence":
      return ["sentence/"];
    case "reading":
    case "listening":
      return ["ebook/", "reading/", "listening/"];
    case "book":
      return ["bookpage/", "ebook/"];
    case "movie":
      return ["movie/"];
    default:
      return [];
  }
}
