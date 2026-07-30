import { sendLearnEvents } from "../api/uniplanetApi";
import type { LearnEvent, LearnEventInput, LearnEventRecorder } from "../types/learnEvents";

export function createLearnEventRecorder(): LearnEventRecorder {
  let events: LearnEvent[] = [];
  let nextSeq = 1;
  const attemptsByItem = new Map<string, number>();

  return {
    count: () => events.length,
    async flush(logIdx: number) {
      if (!logIdx || events.length === 0) return undefined;
      const payloadEvents = events;
      const result = await sendLearnEvents({ log_idx: logIdx, events: payloadEvents });
      events = [];
      nextSeq = 1;
      attemptsByItem.clear();
      return result;
    },
    record(event: LearnEventInput) {
      if (!event.action || !event.item_type) return;
      const normalized = normalizeAttemptEvent(event, attemptsByItem);
      events.push({
        ...normalized,
        ts: normalized.ts || new Date().toISOString(),
        seq: nextSeq
      });
      nextSeq += 1;
    },
    reset() {
      events = [];
      nextSeq = 1;
      attemptsByItem.clear();
    },
    snapshot: () => [...events]
  };
}

const ANSWER_ATTEMPT_ACTIONS = new Set(["submit", "pair_submit", "answer_attempt", "answer_result"]);

function normalizeAttemptEvent(event: LearnEventInput, attemptsByItem: Map<string, number>): LearnEventInput {
  if (!isAnswerAttempt(event)) return event;

  const attemptKey = explicitAttemptKey(event) || fallbackAttemptKey(event);
  const attempts = (attemptsByItem.get(attemptKey) || 0) + 1;
  attemptsByItem.set(attemptKey, attempts);

  return {
    ...event,
    attempts,
    extra: {
      ...event.extra,
      attempt_key: attemptKey,
      attempt_no: attempts,
      ...(event.correct === 0 ? { incorrect_attempt: true } : {})
    }
  };
}

function isAnswerAttempt(event: LearnEventInput): boolean {
  return event.item_type !== "activity" && event.correct != null && ANSWER_ATTEMPT_ACTIONS.has(event.action);
}

function explicitAttemptKey(event: LearnEventInput): string | undefined {
  const value = event.extra?.attempt_key;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function fallbackAttemptKey(event: LearnEventInput): string {
  return [
    event.item_type,
    event.item_idx ?? "unknown",
    event.chunk_index ?? "all"
  ].join(":");
}
