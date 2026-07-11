import { sendLearnEvents } from "../api/uniplanetApi";
import type { LearnEvent, LearnEventInput, LearnEventRecorder } from "../types/learnEvents";

export function createLearnEventRecorder(): LearnEventRecorder {
  let events: LearnEvent[] = [];
  let nextSeq = 1;

  return {
    count: () => events.length,
    async flush(logIdx: number) {
      if (!logIdx || events.length === 0) return undefined;
      const payloadEvents = events;
      const result = await sendLearnEvents({ log_idx: logIdx, events: payloadEvents });
      events = [];
      nextSeq = 1;
      return result;
    },
    record(event: LearnEventInput) {
      if (!event.action || !event.item_type) return;
      events.push({
        ...event,
        ts: event.ts || new Date().toISOString(),
        seq: nextSeq
      });
      nextSeq += 1;
    },
    reset() {
      events = [];
      nextSeq = 1;
    },
    snapshot: () => [...events]
  };
}
