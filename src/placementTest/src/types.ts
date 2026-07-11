export type SectionId = "vocabulary" | "grammar" | "reading" | "listening";

export interface Question {
  id: string;
  type: string;
  difficulty: number;
  prompt: string;
  emoji?: string;
  sentence?: string;
  passage?: string;
  speak?: string;
  choices: string[];
}

export interface TestSection {
  section: SectionId;
  questions: Question[];
}

export interface TestPaper {
  sections: TestSection[];
}

export type Answers = Record<string, number>;

export interface SectionResult {
  section: SectionId;
  correct: number;
  total: number;
  ratio: number;
  level: number;
}

export interface GradeResult {
  id: string;
  name: string;
  overallLevel: number;
  totalCorrect: number;
  totalQuestions: number;
  sections: SectionResult[];
}

// ---------- Raz 적응형 배치 테스트 ----------
export interface RazItem {
  id: string;
  skill: "reading" | "vocab";
  q: string;
  choices: string[];
}
export interface RazUnit {
  step: number;
  confirm?: boolean;
  placementFormId?: string;
  grade?: string;
  level?: string;
  seriesId?: number;
  targetLexile?: number;
  passage: string;
  items: RazItem[];
}
export interface RazBook {
  book_code: string;
  title: string;
  lexile: string;
  thumb_url: string | null;
}
export interface RazRecoBucket {
  role: string;
  grade: string;
  level: string;
  count: number;
  books: RazBook[];
}
export interface RazResult {
  done: true;
  sessionId: string;
  name: string;
  placementFormId?: string;
  placement: {
    grade: string;
    level: string;
    index: number;
    measured: boolean;
    truncated: boolean;
    reachedCeiling: boolean;
    belowFloor: boolean;
    needsLowerStart: boolean;
    lexileAvg: number | null;
  };
  fluency: { totalMs: number | null; msPerWord: number | null; label: string | null };
  areas: {
    reading: { correct: number; total: number; ratio: number | null };
    vocab: { correct: number; total: number; ratio: number | null };
  };
  gradeCompare: { count: number; higherPct: number | null } | null;
  path: {
    seq?: number;
    grade: string;
    level: string;
    correct: number;
    total: number;
    ratio: number;
    confirm?: boolean;
    ms?: number | null;
    words?: number | null;
    passageKey?: string;
    placementFormId?: string;
    seriesId?: number;
    globalAccuracy?: number | null;
    globalAvgMs?: number | null;
    globalN?: number | null;
  }[];
  recommendation: {
    target: { grade: string; level: string; index: number };
    independent: RazRecoBucket | null;
    instructional: RazRecoBucket | null;
    challenge: RazRecoBucket | null;
  };
}
