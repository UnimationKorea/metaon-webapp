export type QuickCheckQuestionKind =
  | "single-select"
  | "sentence-input"
  | "multi-select"
  | "connect-line"
  | "drag-alphabet"
  | "drag-image"
  | "drag-sentence";

export type QuickCheckIndexBase = 0 | 1;

export type QuickCheckOption = {
  index: number;
  sourceIndex: number;
  label: string;
  imageUrl?: string;
  audioUrl?: string;
};

export type QuickCheckSubItem = {
  id: string;
  prompt: string;
  imageUrl?: string;
  audioUrl?: string;
  options?: QuickCheckOption[];
};

export type QuickCheckContentRef = {
  itemType: "sentence" | "word";
  itemIdx: number;
  subItemIndex?: number;
};

export type QuickCheckCorrectAnswer =
  | { mode: "single"; selectedIndex: number }
  | { mode: "text"; value: string }
  | { mode: "composite"; selectedIndexes: number[] };

export type QuickCheckQuestion = {
  id: string;
  qIdx: number;
  sequence: number;
  quizCode: number;
  unityType: number;
  kind: QuickCheckQuestionKind;
  sourceIndexBase: QuickCheckIndexBase;
  indexBase: 0;
  question: string;
  questionKo?: string;
  questionSoundUrl?: string;
  exampleText?: string;
  exampleImageUrl?: string;
  exampleSoundUrl?: string;
  attributeName?: string;
  options: QuickCheckOption[];
  subItems: QuickCheckSubItem[];
  tokens: string[];
  blankPositions: number[];
  contentRefs?: QuickCheckContentRef[];
  correctAnswer: QuickCheckCorrectAnswer;
};

export type QuickCheckAnswer =
  | { mode: "single"; selectedIndex: number | null }
  | { mode: "text"; value: string }
  | { mode: "composite"; selectedIndexes: Array<number | null> };

export type QuickCheckAnswerRecord = Record<string, QuickCheckAnswer | undefined>;

export type QuickCheckSourceContract = "metaon3-current" | "unity-new" | "unknown";

export type QuickCheckLoadResult = {
  resultCode: number;
  resultMessage: string;
  sourceContract: QuickCheckSourceContract;
  attemptId: string;
  questions: QuickCheckQuestion[];
};

export type QuickCheckPointState = "earned-now" | "earned-before" | "none";

export type QuickCheckResultItem = {
  questionId: string;
  qIdx: number;
  correct: boolean;
  point: number;
  pointState: QuickCheckPointState;
  upstreamCorrect?: boolean;
};

export type QuickCheckSubmissionResult = {
  resultCode: number;
  resultMessage: string;
  total: number;
  correctCount: number;
  newPoints: number;
  currentPoints: number;
  existingPoints: number;
  lessonPoints: number;
  level: number;
  gradedBy: "bff-final-rule" | "client-fallback";
  duplicate: boolean;
  items: QuickCheckResultItem[];
};

export type QuickCheckSubmissionAnswer = {
  q_idx: number;
  answer: QuickCheckAnswer;
  time_ms: number;
  answered_at: string;
};
