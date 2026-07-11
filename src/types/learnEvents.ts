export type LearnEventItemType =
  | "activity"
  | "page"
  | "pair"
  | "quick_check"
  | "recording"
  | "sentence"
  | "word";

export type LearnEventExtra = Record<string, unknown>;

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
  attempts?: number;
  hints_used?: number;
  audio_replays?: number;
  extra?: LearnEventExtra;
};

export type LearnEventInput = Omit<LearnEvent, "seq" | "ts"> & {
  ts?: string;
};

export type LearnEventRecorder = {
  count: () => number;
  flush: (logIdx: number) => Promise<unknown | undefined>;
  record: (event: LearnEventInput) => void;
  reset: () => void;
  snapshot: () => LearnEvent[];
};
