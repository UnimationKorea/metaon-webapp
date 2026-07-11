import { ActType } from "../types/metaonTypes";

const UNITY_APP_UI_BASE = "/unity-app-ui";

export const unityBrandAssets = {
  appIcon: `${UNITY_APP_UI_BASE}/brand/app-icon.png`,
  logo: `${UNITY_APP_UI_BASE}/brand/logo.png`
};

export const unityMenuAssets = {
  home: `${UNITY_APP_UI_BASE}/menu/home.png`,
  download: `${UNITY_APP_UI_BASE}/menu/download.png`,
  myBooks: `${UNITY_APP_UI_BASE}/menu/my-books.png`,
  option: `${UNITY_APP_UI_BASE}/menu/option.png`,
  openMenu: `${UNITY_APP_UI_BASE}/menu/open-menu.png`,
  bookStrip: `${UNITY_APP_UI_BASE}/menu/book-strip.png`,
  myBooksHero: `${UNITY_APP_UI_BASE}/menu/my-books-hero.png`,
  downloadHero: `${UNITY_APP_UI_BASE}/menu/download-hero.png`,
  myPlanetHero: `${UNITY_APP_UI_BASE}/menu/my-planet-hero.png`
};

export const unityHomeMenuAssets = {
  phonics: `${UNITY_APP_UI_BASE}/home-menu/phonics.png`,
  speaking1: `${UNITY_APP_UI_BASE}/home-menu/speaking-1.png`,
  speaking2: `${UNITY_APP_UI_BASE}/home-menu/speaking-2.png`,
  gradePre: `${UNITY_APP_UI_BASE}/home-menu/grade-pre.png`,
  gradeK: `${UNITY_APP_UI_BASE}/home-menu/grade-k.png`,
  grade1: `${UNITY_APP_UI_BASE}/home-menu/grade-1.png`
};

const razKidsHomeImages = [unityHomeMenuAssets.gradePre, unityHomeMenuAssets.gradeK, unityHomeMenuAssets.grade1];

export const unityBookAssets = {
  background: `${UNITY_APP_UI_BASE}/book/bg.png`,
  bookStrip: `${UNITY_APP_UI_BASE}/menu/book-strip.png`,
  lessonDayBox: `${UNITY_APP_UI_BASE}/book/lesson-day-box.png`,
  star: `${UNITY_APP_UI_BASE}/book/star.png`,
  active: `${UNITY_APP_UI_BASE}/book/act-ing.png`,
  complete: `${UNITY_APP_UI_BASE}/book/act-ok.png`
};

const activityIconByType: Partial<Record<ActType, string>> = {
  [ActType.StoryBook]: "icon-act-ebook.png",
  [ActType.StoryBookSpace]: "icon-act-ebook.png",
  [ActType.Ebook]: "icon-act-ebook.png",
  [ActType.BookPage]: "icon-act-ebook.png",
  [ActType.Listening]: "icon-act-ebook.png",
  [ActType.FlashCard]: "icon-act-flashcard.png",
  [ActType.FlashCard2]: "icon-act-flashcard.png",
  [ActType.FlashCardSpace]: "icon-act-flashcard.png",
  [ActType.SimpleFlashCard]: "icon-act-flashcard.png",
  [ActType.VocaPreview]: "icon-act-flashcard.png",
  [ActType.VocaQuiz]: "icon-act-word-quiz.png",
  [ActType.VocaQuizSpace]: "icon-act-word-quiz.png",
  [ActType.VocaCheck]: "icon-act-word-check.png",
  [ActType.VocaCheckSpace]: "icon-act-word-check.png",
  [ActType.SentenceCheck]: "icon-act-word-check.png",
  [ActType.SentenceCheckSpace]: "icon-act-word-check.png",
  [ActType.SentenceUnscramble]: "icon-act-unscramble.png",
  [ActType.SentenceUnscrambleSpace]: "icon-act-unscramble.png"
};

export function getSeriesBackgroundUrl(groupNumber?: number, groupId?: number): string {
  const base = Number.isFinite(groupNumber) && groupNumber ? groupNumber : groupId || 1;
  const normalized = ((Math.abs(base) - 1) % 6) + 1;
  return `${UNITY_APP_UI_BASE}/series-bg/bg-${normalized}.png`;
}

export function getHomeMenuImageUrl(groupId?: number, groupName = ""): string {
  switch (groupId) {
    case 1:
      return unityHomeMenuAssets.phonics;
    case 2:
      return unityHomeMenuAssets.speaking1;
    case 3:
      return unityHomeMenuAssets.speaking2;
    case 4:
      return unityHomeMenuAssets.gradePre;
    case 5:
      return unityHomeMenuAssets.gradeK;
    case 6:
      return unityHomeMenuAssets.grade1;
    default:
      break;
  }

  if (groupName.toLowerCase().includes("reading training")) {
    return unityHomeMenuAssets.phonics;
  }

  const normalizedIndex = Math.max(0, (groupId || 7) - 7) % razKidsHomeImages.length;
  return razKidsHomeImages[normalizedIndex];
}

export function getActivityIconUrl(actType?: ActType): string {
  const file = actType == null ? undefined : activityIconByType[actType];
  return `${UNITY_APP_UI_BASE}/icons/${file || "icon-act-default.png"}`;
}
