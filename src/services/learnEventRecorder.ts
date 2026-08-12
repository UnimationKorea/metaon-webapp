import { LearnEventBatchConflictError, sendLearnEvents } from "../api/uniplanetApi";
import { learnEventAppVersion } from "./learnEventAppVersion";
import {
  createLearnEventRunId,
  deleteLearnEventRun,
  listBoundLearnEventRuns,
  saveLearnEventRun,
  type LearnEventOutboxRun
} from "./learnEventOutbox";
import type {
  LearnEvent,
  LearnEventExtra,
  LearnEventInput,
  LearnEventQuestionForm,
  LearnEventRecorder,
  LearnEventScope,
  LearnEventSkill
} from "../types/learnEvents";

// Kept only to deliver batches written by the previous release. New events use IndexedDB.
const LEGACY_OUTBOX_STORAGE_KEY = "metaon.learn-events.outbox.v2";

type LegacyPendingLearnEventBatch = {
  log_idx: number;
  batch_id?: string;
  app_version?: string;
  events: LearnEvent[];
  created_at: string;
  delivery_state?: "pending" | "conflict";
  last_error?: string;
};

function isLegacyPendingBatch(value: unknown): value is LegacyPendingLearnEventBatch {
  if (!value || typeof value !== "object") return false;
  const batch = value as Partial<LegacyPendingLearnEventBatch>;
  return Number.isInteger(batch.log_idx) && (batch.log_idx || 0) > 0 && Array.isArray(batch.events) && typeof batch.created_at === "string";
}

export function createLearnEventRecorder(): LearnEventRecorder {
  let events: LearnEvent[] = [];
  let nextSeq = 1;
  const attemptsByItem = new Map<string, number>();
  const questionNoByItem = new Map<string, number>();
  const questionStartedAtByItem = new Map<string, number>();
  let scope: LearnEventScope = {};
  let runId = createLearnEventRunId();
  let batchId = createLearnEventRunId();
  let appVersion = learnEventAppVersion();
  let boundLogIdx: number | undefined;
  let createdAt = new Date().toISOString();
  let persistence = Promise.resolve();
  let delivered = false;

  function enqueuePersist(): Promise<void> {
    const snapshot: LearnEventOutboxRun = {
      run_id: runId,
      batch_id: batchId,
      app_version: appVersion,
      ...(boundLogIdx ? { log_idx: boundLogIdx } : {}),
      events: [...events],
      created_at: createdAt,
      updated_at: new Date().toISOString()
    };
    persistence = persistence
      .catch(() => undefined)
      .then(() => saveLearnEventRun(snapshot));
    return persistence;
  }

  async function persistCurrent(): Promise<void> {
    try {
      await enqueuePersist();
    } catch {
      // IndexedDB can be blocked by an embedded WebView. Retain the legacy
      // fallback once a server study log is available.
      if (boundLogIdx && events.length > 0) {
        appendLegacyPendingBatch({ log_idx: boundLogIdx, batch_id: batchId, app_version: appVersion, events: [...events], created_at: createdAt });
      }
    }
  }

  function resetInMemory(): void {
    events = [];
    nextSeq = 1;
    attemptsByItem.clear();
    questionNoByItem.clear();
    questionStartedAtByItem.clear();
  }

  return {
    begin(nextScope = {}) {
      scope = { ...nextScope };
      runId = createLearnEventRunId();
      batchId = createLearnEventRunId();
      appVersion = learnEventAppVersion();
      boundLogIdx = undefined;
      createdAt = new Date().toISOString();
      delivered = false;
      resetInMemory();
    },
    async bindStudyLog(logIdx) {
      if (!logIdx) return;
      boundLogIdx = logIdx;
      await persistCurrent();
    },
    count: () => events.length,
    async flush(logIdx) {
      if (!logIdx) return undefined;
      await this.bindStudyLog(logIdx);
      const result = await flushPersistedRuns(logIdx);
      if (result !== undefined) {
        delivered = true;
        resetInMemory();
      }
      return result;
    },
    async flushPending() {
      await persistence.catch(() => undefined);
      await flushPersistedRuns();
    },
    async persist() {
      await persistCurrent();
    },
    record(event: LearnEventInput) {
      if (!event.action || !event.item_type) return;
      const transportReady = normalizeForTransport(event, scope);
      const questionKey = fallbackAttemptKey(transportReady);
      const mappedQNo = transportReady.q_no ?? questionNoByItem.get(questionKey);
      if (transportReady.action === "question_view" && mappedQNo != null) questionNoByItem.set(questionKey, mappedQNo);
      const timestamp = transportReady.ts || new Date().toISOString();
      if (transportReady.action === "question_view") questionStartedAtByItem.set(questionKey, Date.parse(timestamp));
      const elapsed = isAnswerAttempt(transportReady) && transportReady.time_ms == null
        ? elapsedFromQuestionStart(questionStartedAtByItem.get(questionKey), timestamp)
        : undefined;
      const normalized = normalizeAttemptEvent(
        mappedQNo != null && transportReady.q_no == null ? { ...transportReady, q_no: mappedQNo } : transportReady,
        attemptsByItem
      );
      events.push({
        ...normalized,
        ...(elapsed != null ? { time_ms: elapsed } : {}),
        ts: timestamp,
        seq: nextSeq
      });
      // The next answer for this question is measured from this submission,
      // not from the original question_view event.
      if (isAnswerAttempt(transportReady)) questionStartedAtByItem.set(questionKey, Date.parse(timestamp));
      nextSeq += 1;
      delivered = false;
      // Network delivery remains batched at activity exit/completion. This is
      // only a durable local append, so a process kill does not lose attempts.
      void persistCurrent();
    },
    reset() {
      if (!delivered) void persistCurrent();
      resetInMemory();
    },
    setQuestionTotal(total) {
      scope = { ...scope, questionTotal: normalizeNullablePositiveInt(total) };
    },
    snapshot: () => [...events]
  };
}

const ANSWER_ATTEMPT_ACTIONS = new Set(["submit", "pair_submit", "pair_attempt", "answer_attempt", "answer_result"]);

function normalizeAttemptEvent(event: LearnEventInput, attemptsByItem: Map<string, number>): LearnEventInput {
  if (!isAnswerAttempt(event)) return event;
  const attemptKey = explicitAttemptKey(event) || fallbackAttemptKey(event);
  const attempts = (attemptsByItem.get(attemptKey) || 0) + 1;
  attemptsByItem.set(attemptKey, attempts);
  return { ...event, attempts };
}

function isAnswerAttempt(event: LearnEventInput): boolean {
  return event.item_type !== "activity" && event.correct != null && ANSWER_ATTEMPT_ACTIONS.has(event.action);
}

function explicitAttemptKey(event: LearnEventInput): string | undefined {
  return event.q_no != null ? `q:${event.q_no}` : undefined;
}

function fallbackAttemptKey(event: LearnEventInput): string {
  return [event.item_type, event.item_idx ?? "unknown", event.chunk_index ?? "all"].join(":");
}

function normalizeForTransport(event: LearnEventInput, nextScope: LearnEventScope): LearnEventInput {
  const extra = normalizeExtra(event.extra);
  const questionForm = event.question_form || nextScope.questionForm || questionFormForActivity(nextScope.activityCode);
  const qNo = normalizePositiveInt(event.q_no) ?? normalizePositiveInt(extra.q_no) ?? normalizePositiveInt(extra.question_index);
  const qTotal = normalizeNullablePositiveInt(event.q_total) ?? normalizeNullablePositiveInt(extra.q_total) ?? normalizeNullablePositiveInt(nextScope.questionTotal);
  const isAnswer = event.item_type !== "activity" && event.correct != null && ANSWER_ATTEMPT_ACTIONS.has(event.action);
  const attemptMax = event.attempt_max !== undefined
    ? normalizeNullablePositiveInt(event.attempt_max)
    : isAnswer ? nextScope.attemptMax ?? attemptMaxForQuestionForm(questionForm) : undefined;
  const skill = event.skill || (isAnswer ? skillForGradedEvent(nextScope.activityCode, event, extra) : undefined);
  return {
    ...event,
    ...(qNo != null ? { q_no: qNo } : {}),
    ...(qTotal !== undefined ? { q_total: qTotal } : {}),
    ...(attemptMax !== undefined ? { attempt_max: attemptMax } : {}),
    ...(questionForm ? { question_form: questionForm } : {}),
    ...(skill ? { skill } : {}),
    ...(Object.keys(extra).length > 0 ? { extra } : {})
  };
}

function skillForGradedEvent(
  activityCode: string | undefined,
  event: LearnEventInput,
  extra: LearnEventExtra
): LearnEventSkill | undefined {
  const code = (activityCode || "").trim().toUpperCase();
  const questionType = String(extra.question_type ?? extra.prompt_type ?? "").trim().toLowerCase();
  const optionType = String(extra.option_type ?? "").trim().toLowerCase();
  const blankCount = Array.isArray(extra.blank_indexes) ? extra.blank_indexes.length : 1;

  switch (code) {
    case "WDQU01":
    case "WDQU03":
      if (optionType === "image") return questionType === "audio" ? "word_sound_to_image" : "word_text_to_image";
      return questionType === "audio" ? "word_sound_to_text" : "word_image_to_text";
    case "WDQU02":
    case "WDQU04":
      return questionType === "audio" ? "word_sound_to_text" : "word_image_to_text";
    case "STBL01":
    case "STBL02":
      return blankCount >= 2 ? "sentence_blank_multi" : "sentence_blank_single";
    case "WDWR01":
    case "WDWR02":
      return event.item_type === "sentence" ? "writing_image_to_sentence" : "writing_image_to_word";
    case "WDBL01":
    case "WDBL02":
      return "word_spell_blank";
    case "STSC01":
    case "STSC02":
      return "sentence_unscramble";
    case "WDXP01":
      return "word_text_to_image";
    case "WDPL01":
      return "word_match_text_meaning";
    // WDPL02 intentionally has no client skill. The server assigns it because
    // a matching pair is not a single word-level assessment item.
    default:
      return undefined;
  }
}

function normalizeExtra(value: LearnEventExtra | undefined): LearnEventExtra {
  if (!value) return {};
  const {
    selected_text, selected_word_idx, answer_text, answer_word_idx,
    option_order, token_order, full_answer_tokens,
    attempt_key: _attemptKey, attempt_no: _attemptNo, incorrect_attempt: _incorrectAttempt,
    ...rest
  } = value;
  const normalized: LearnEventExtra = { ...rest };
  copyIfMissing(normalized, "selected", selected_text);
  copyIfMissing(normalized, "selected_idx", selected_word_idx);
  copyIfMissing(normalized, "answer", answer_text);
  copyIfMissing(normalized, "answer_idx", answer_word_idx);
  copyIfMissing(normalized, "answer_tokens", full_answer_tokens);
  copyIfMissing(normalized, "options", token_order);
  if (normalized.options === undefined && Array.isArray(option_order)) {
    normalized.options = option_order.map(optionText);
    const optionIdxs = option_order.map(optionIndex);
    if (optionIdxs.some((item) => item != null)) normalized.option_idxs = optionIdxs;
  }
  return normalized;
}

function copyIfMissing(target: LearnEventExtra, key: string, value: unknown): void {
  if (target[key] === undefined && value !== undefined) target[key] = value;
}

function optionText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["text", "label", "value", "word", "sentence"]) if (typeof record[key] === "string") return record[key] as string;
  }
  return String(value ?? "");
}

function optionIndex(value: unknown): number | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  for (const key of ["word_idx", "sentence_idx", "item_idx", "idx"]) {
    const number = normalizePositiveInt(record[key]);
    if (number != null) return number;
  }
  return null;
}

function normalizePositiveInt(value: unknown): number | undefined {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

function normalizeNullablePositiveInt(value: unknown): number | null | undefined {
  if (value === null) return null;
  return normalizePositiveInt(value);
}

function elapsedFromQuestionStart(startedAt: number | undefined, timestamp: string): number | undefined {
  const endedAt = Date.parse(timestamp);
  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt) || endedAt < (startedAt || 0)) return undefined;
  return endedAt - (startedAt || 0);
}

function questionFormForActivity(activityCode: string | undefined): LearnEventQuestionForm | undefined {
  switch ((activityCode || "").trim().toUpperCase()) {
    case "WDCA01": case "WDCA02": case "EBOOK01": case "MOVIE01": return "view";
    case "WDBL01": case "WDBL02": return "choice-letter";
    case "WDQU01": case "WDQU02": case "WDQU03": case "WDQU04": case "STBL01": case "STBL02": return "choice-word";
    case "STSC01": case "STSC02": return "order-tokens";
    case "WDPL01": return "pair-match";
    case "WDPL02": return "memory-card";
    case "WDWR01": case "WDWR02": return "write-word";
    case "WDXP01": return "puzzle-image";
    case "STRC01": case "STRC02": return "speak-sentence";
    default: return undefined;
  }
}

function attemptMaxForQuestionForm(questionForm: LearnEventQuestionForm | undefined): number | null | undefined {
  if (questionForm === "pair-match" || questionForm === "memory-card") return null;
  if (["choice-word", "choice-letter", "order-tokens", "write-word", "puzzle-image"].includes(questionForm || "")) return 3;
  return undefined;
}

async function flushPersistedRuns(targetLogIdx?: number): Promise<unknown | undefined> {
  let targetResult: unknown;
  let runs: LearnEventOutboxRun[] = [];
  try {
    runs = await listBoundLearnEventRuns();
  } catch {
    // The old localStorage outbox remains available if IndexedDB is unavailable.
  }
  for (const run of runs) {
    try {
      const result = await sendAndVerify(run.log_idx!, run.events, run.batch_id, run.app_version || learnEventAppVersion());
      await deleteLearnEventRun(run.run_id);
      if (run.log_idx === targetLogIdx) targetResult = result;
    } catch (error) {
      if (error instanceof LearnEventBatchConflictError) {
        await saveLearnEventRun({
          ...run,
          delivery_state: "conflict",
          last_error: error.message,
          updated_at: new Date().toISOString()
        });
        if (run.log_idx === targetLogIdx) throw error;
        continue;
      }
      throw error;
    }
  }
  const legacyResult = await flushLegacyPendingBatches(targetLogIdx);
  return targetResult ?? legacyResult;
}

async function sendAndVerify(logIdx: number, eventList: LearnEvent[], batchId: string, appVersion: string): Promise<unknown> {
  const result = await sendLearnEvents({ log_idx: logIdx, app_version: appVersion, events: eventList, batch_id: batchId });
  const receipt = result && typeof result === "object" ? result as Record<string, unknown> : {};
  const accepted = Number(receipt.accepted ?? receipt.accepted_event_count ?? receipt.acceptedEventCount ?? 0);
  const duplicated = Number(receipt.duplicated ?? 0);
  if (
    Number(receipt.resultCode) !== 1 ||
    !Number.isInteger(accepted) ||
    !Number.isInteger(duplicated) ||
    accepted < 0 ||
    duplicated < 0 ||
    accepted + duplicated !== eventList.length
  ) {
    throw new Error("LearnEvent batch acknowledgement was incomplete.");
  }
  return result;
}

function readLegacyPendingBatches(): LegacyPendingLearnEventBatch[] {
  try {
    const raw = window.localStorage.getItem(LEGACY_OUTBOX_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isLegacyPendingBatch) : [];
  } catch {
    return [];
  }
}

function writeLegacyPendingBatches(batches: LegacyPendingLearnEventBatch[]): boolean {
  try {
    if (batches.length === 0) window.localStorage.removeItem(LEGACY_OUTBOX_STORAGE_KEY);
    else window.localStorage.setItem(LEGACY_OUTBOX_STORAGE_KEY, JSON.stringify(batches));
    return true;
  } catch {
    return false;
  }
}

function appendLegacyPendingBatch(batch: LegacyPendingLearnEventBatch): void {
  const pending = readLegacyPendingBatches().filter((item) => item.batch_id !== batch.batch_id);
  pending.push(batch);
  writeLegacyPendingBatches(pending);
}

async function flushLegacyPendingBatches(targetLogIdx?: number): Promise<unknown | undefined> {
  const pending = readLegacyPendingBatches();
  const blocked = pending.filter((batch) => batch.delivery_state === "conflict");
  const deliverable = pending.filter((batch) => batch.delivery_state !== "conflict");
  let targetResult: unknown;
  for (let index = 0; index < deliverable.length; index += 1) {
    const batch = deliverable[index];
    const batchId = batch.batch_id || `legacy-${batch.log_idx}-${batch.created_at}`;
    try {
      const result = await sendAndVerify(batch.log_idx, batch.events, batchId, batch.app_version || learnEventAppVersion());
      if (batch.log_idx === targetLogIdx) targetResult = result;
    } catch (error) {
      if (error instanceof LearnEventBatchConflictError) {
        const conflicted = { ...batch, delivery_state: "conflict" as const, last_error: error.message };
        blocked.push(conflicted);
        writeLegacyPendingBatches([...blocked, ...deliverable.slice(index + 1)]);
        if (batch.log_idx === targetLogIdx) throw error;
        continue;
      }
      writeLegacyPendingBatches([...blocked, ...deliverable.slice(index)]);
      throw error;
    }
  }
  writeLegacyPendingBatches(blocked);
  return targetResult;
}
