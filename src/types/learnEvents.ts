export type LearnEventItemType =
  | "activity"
  | "page"
  | "pair"
  | "quick_check"
  | "recording"
  | "sentence"
  | "word";

export type LearnEventExtra = Record<string, unknown>;

export type LearnEventQuestionForm =
  | "choice-word"
  | "choice-letter"
  | "order-tokens"
  | "pair-match"
  | "memory-card"
  | "write-word"
  | "puzzle-image"
  | "speak-sentence"
  | "view";

export type LearnEventScope = {
  activityCode?: string;
  questionForm?: LearnEventQuestionForm;
  questionTotal?: number | null;
  attemptMax?: number | null;
};

export type LearnEvent = {
  ts?: string;
  seq?: number;
  action: string;
  item_type: LearnEventItemType;
  item_idx?: number | null;
  chunk_index?: number;
  correct?: 0 | 1;
  score?: number;
  time_ms?: number;
  /** 1-based question identity within one study log. */
  q_no?: number;
  /** Total questions for this study log. Games use null. */
  q_total?: number | null;
  attempts?: number;
  /** Maximum attempts allowed for the question. Timed games use null. */
  attempt_max?: number | null;
  question_form?: LearnEventQuestionForm;
  hints_used?: number;
  audio_replays?: number;
  extra?: LearnEventExtra;
};

export type LearnEventInput = Omit<LearnEvent, "seq" | "ts"> & {
  ts?: string;
};

export type LearnEventRecorder = {
  begin: (scope?: LearnEventScope) => void;
  bindStudyLog: (logIdx: number) => Promise<void>;
  count: () => number;
  flush: (logIdx: number) => Promise<unknown | undefined>;
  flushPending: () => Promise<void>;
  persist: () => Promise<void>;
  record: (event: LearnEventInput) => void;
  reset: () => void;
  setQuestionTotal: (total: number | null | undefined) => void;
  snapshot: () => LearnEvent[];
};
