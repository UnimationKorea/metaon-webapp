import type { LearnEventRecorder } from "./learnEvents";

export enum ActType {
  VocaPreview = 1,
  StoryReview = 3,
  VocaQuiz = 4,
  VocaCheck = 5,
  SentenceCheck = 6,
  SentenceUnscramble = 7,
  MatchingGame = 8,
  SentenceShadowing = 9,
  Writing = 10,
  MoviePlay = 13,
  Chant = 14,
  MemoryGame = 15,
  Ebook = 16,
  FlashCard = 17,
  NeopenNote = 18,
  GameSpace = 20,
  SoundWord = 21,
  Youtube = 22,
  SoundCheck = 23,
  SpellingCheck = 24,
  Dictation = 25,
  FlashCard2 = 26,
  WordPuzzle = 27,
  WordSearch = 28,
  SoundCheckPen = 29,
  WriteQuiz = 30,
  MonthTest = 31,
  ListenRecord = 32,
  WorkBook = 33,
  TextBook = 35,
  FindImage = 36,
  DrawBoard = 37,
  MultiLink = 38,
  MovieRecord = 39,
  PointPlay = 40,
  AudioList = 41,
  VideoList = 42,
  SpeakRecog = 43,
  QuizShow = 44,
  FlipImage = 45,
  BookPage = 46,
  PeelingWord = 47,
  WriteWord = 48,
  PowerPoint = 49,
  WordBox = 50,
  StoryBook = 51,
  ImageQuiz = 52,
  WordPuzzle2 = 53,
  DragImage = 54,
  ImagePage = 55,
  SpinAndRead = 56,
  ReadAndFlip = 57,
  CatchImage = 58,
  UnderSea = 59,
  ARQuiz = 61,
  OMR = 62,
  WritingAct = 63,
  QuickCheck = 65,
  Reading = 66,
  Listening = 67,
  Phonics1 = 68,
  Phonics2 = 69,
  ResizeRead = 72,
  DrawSave = 73,
  CameraWord = 74,
  TimerDraw = 75,
  TempletQuiz = 76,
  KeyWord = 77,
  TempletQuiz2 = 78,
  ScratchWord = 79,
  QuickQuiz = 80,
  RolePlay = 81,
  PhonicsBlandSimple = 82,
  SimpleFlashCard = 117,
  SpeakRecogSentence = 1043,
  SpeakRecogStory = 2043,
  VocaQuizSpace = 1004,
  VocaCheckSpace = 1005,
  SentenceCheckSpace = 1006,
  SentenceUnscrambleSpace = 1007,
  SentenceShadowingSpace = 1009,
  FlashCardSpace = 1017,
  MultyWordCard = 1018,
  MultyWordFind = 1019,
  ListenRecordSpace = 1032,
  StoryBookSpace = 1051,
  Reading1 = 1101,
  Reading2 = 1201,
  Reading3 = 1301,
  Reading4 = 1401,
  Reading5 = 1501
}

export type BookCatalog = {
  resultCode: number;
  resultMessage: string;
  fetchedAt: string;
  brands: BrandData[];
  groups: SeriesGroup[];
};

export type BrandData = {
  brandId: number;
  brandName: string;
  mainImageUrl: string;
  groups: SeriesGroup[];
};

export type SeriesGroup = {
  groupId: number;
  groupName: string;
  groupNumber: number;
  appVersion: string;
  brandId?: number;
  brandName?: string;
  mainImageUrl?: string;
  seriesList: SeriesData[];
};

export type SeriesData = {
  seriesGroup: number;
  seriesIdx: number;
  seriesName: string;
  seriesNumber: number;
  mainImageUrl: string;
  icon1Url: string;
  icon2Url: string;
  appVersion: string;
  books: BookData[];
};

export type BookData = {
  seriesGroup: number;
  seriesIdx: number;
  bookIdx: number;
  bookId: string;
  bookCode?: string;
  bookName: string;
  title?: string;
  bookNumber: number;
  lexile: string;
  bUrl: string;
  thumbnailUrl: string;
  themeId: number;
  appVersion: string;
  brandIdx?: number;
  sgIdx?: number;
};

export type BookPackage = {
  key: string;
  cacheVersion?: number;
  source?: "unity-zip" | "metaon3-resources";
  bookIdx?: number;
  bookId: string;
  seriesGroup: number;
  seriesIdx: number;
  downloadedAt: string;
  totalFiles: number;
  totalBytes: number;
  lessonDays: LessonDay[];
  manifest?: unknown;
};

export type LessonDay = {
  id: string;
  dayIdx?: number;
  lessonIdx?: number;
  lesson: number;
  day: number;
  title: string;
  lessonTitle?: string;
  dayTitle?: string;
  basePath?: string;
  activities: Activity[];
};

export type Activity = {
  id: string;
  actIdx?: number;
  dayIdx?: number;
  activityCode?: string;
  legacyActCode?: string;
  actType: ActType;
  title: string;
  actNum: number;
  category?: "word" | "sentence" | "reading" | "listening" | "quickcheck" | "book" | "movie" | string;
  params?: string[];
  useWordList?: number[];
  commentStart?: string;
  commentFinish?: string;
  raw?: unknown;
};

export type ActivityRequirement =
  | "audio"
  | "video"
  | "microphone"
  | "recorder"
  | "recognition"
  | "indexeddb";

export type ActivityCompletionResult = {
  correctCount?: number;
  newPoints?: number;
  score?: number;
  total?: number;
};

export type ActivityRendererContext = {
  packageMeta?: BookPackage;
  day?: LessonDay;
  activity?: Activity;
  learnEventRecorder?: LearnEventRecorder;
  studyLogIdx?: number;
  onComplete?: (result?: ActivityCompletionResult) => Promise<void>;
  onExit?: () => Promise<void>;
};

export type ActivityRenderer = {
  actType: ActType;
  name: string;
  requires: ActivityRequirement[];
  loadAssets: (context: ActivityRendererContext) => Promise<void>;
  render: (context: ActivityRendererContext) => JSX.Element;
};

export type DownloadProgress = {
  phase: "idle" | "downloading" | "unzipping" | "saving" | "done" | "error";
  ratio: number;
  loadedBytes?: number;
  totalBytes?: number;
  currentFile?: string;
  message?: string;
};

export type BookResource = {
  path: string;
  sourcePath: string;
  url: string;
  mimeType: string;
  size?: number;
  category?: string;
  etag?: string;
  lastModified?: string;
};

export type GeneratedPackageFile = {
  path: string;
  content: string;
  mimeType: string;
};

export type BookResourceManifest = {
  key: string;
  book: BookData;
  progress?: {
    actTotal: number;
    actDone: number;
  };
  lessonDays: LessonDay[];
  resources: BookResource[];
  generatedFiles: GeneratedPackageFile[];
  raw?: unknown;
};
