export type CaptionWordTiming = {
  text: string;
  startMs: number;
  endMs: number;
};

export type ListenCaptionCue = {
  pageIndex: number;
  audioIndex: number;
  startMs: number;
  endMs: number;
  text: string;
  lang?: string;
  words?: CaptionWordTiming[];
};

export type CaptionParseDefaults = {
  pageIndex?: number;
  audioIndex?: number;
};

export function parseCaptionCues(source: string, path = "", defaults: CaptionParseDefaults = {}): ListenCaptionCue[] {
  const trimmed = source.trim();
  if (!trimmed) return [];

  const lowerPath = path.toLowerCase();
  if (lowerPath.endsWith(".json") || trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return parseJsonCaptionCues(trimmed, defaults);
  }

  if (lowerPath.endsWith(".vtt") || trimmed.startsWith("WEBVTT")) {
    return parseVttCaptionCues(trimmed, defaults);
  }

  return parseSmiCaptionCues(trimmed, defaults);
}

export function parseSmiCaptionCues(source: string, defaults: CaptionParseDefaults = {}): ListenCaptionCue[] {
  const blocks = Array.from(source.matchAll(/<sync\s+start\s*=\s*["']?(\d+(?:\.\d+)?)["']?[^>]*>([\s\S]*?)(?=<sync\s+start\s*=|$)/gi));
  const cues = blocks
    .map((match, index) => {
      const startMs = Math.max(0, Math.round(Number(match[1])));
      const nextStartMs = blocks[index + 1] ? Math.max(0, Math.round(Number(blocks[index + 1][1]))) : startMs + 3000;
      const body = match[2] || "";
      const text = cleanCaptionText(body);
      if (!text) return undefined;
      return {
        pageIndex: defaults.pageIndex ?? 0,
        audioIndex: defaults.audioIndex ?? 0,
        startMs,
        endMs: Math.max(startMs + 1, nextStartMs),
        text,
        lang: captionLanguage(body)
      };
    })
    .filter(Boolean) as ListenCaptionCue[];

  return cues;
}

export function parseVttCaptionCues(source: string, defaults: CaptionParseDefaults = {}): ListenCaptionCue[] {
  return source
    .replace(/\r/g, "")
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      const timeIndex = lines.findIndex((line) => line.includes("-->"));
      if (timeIndex < 0) return undefined;
      const [start, end] = lines[timeIndex].split("-->").map((part) => part.trim().split(/\s+/)[0]);
      const startMs = parseTimestamp(start);
      const endMs = parseTimestamp(end);
      const text = cleanCaptionText(lines.slice(timeIndex + 1).join("\n"));
      if (startMs == null || endMs == null || !text) return undefined;
      return {
        pageIndex: defaults.pageIndex ?? 0,
        audioIndex: defaults.audioIndex ?? 0,
        startMs,
        endMs: Math.max(startMs + 1, endMs),
        text
      };
    })
    .filter(Boolean) as ListenCaptionCue[];
}

export function parseJsonCaptionCues(source: string, defaults: CaptionParseDefaults = {}): ListenCaptionCue[] {
  try {
    const parsed = JSON.parse(source) as unknown;
    const parsedRecord = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : undefined;
    const records = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsedRecord?.cues)
        ? parsedRecord.cues
        : Array.isArray(parsedRecord?.captions)
          ? parsedRecord.captions
          : [];

    if (records.length === 0 && parsedRecord) {
      const words = parseWordTimings(parsedRecord.words ?? parsedRecord.word_timings ?? parsedRecord.wordTiming ?? parsedRecord.word_timing, 0, 0);
      if (words.length > 0) {
        return [{
          pageIndex: defaults.pageIndex ?? 0,
          audioIndex: defaults.audioIndex ?? 0,
          startMs: Math.min(...words.map((word) => word.startMs)),
          endMs: Math.max(...words.map((word) => word.endMs)),
          text: words.map((word) => word.text).join(" "),
          words
        }];
      }
    }

    return records
      .map((record) => {
        const item = record && typeof record === "object" ? (record as Record<string, unknown>) : {};
        const text = String(item.text ?? item.caption ?? item.Eng ?? item.eng ?? item.word ?? "").trim();
        const startMs = millisValue(item.startMs ?? item.start_ms ?? item.start ?? item.time ?? 0);
        const endValue = item.endMs ?? item.end_ms ?? item.end;
        const duration = millisValue(item.durationMs ?? item.duration_ms ?? item.duration);
        const endMs = endValue == null ? startMs + (duration || 3000) : millisValue(endValue);
        if (!text) return undefined;
        const words = parseWordTimings(item.words ?? item.word_timings ?? item.wordTiming ?? item.word_timing, startMs, endMs);
        return {
          pageIndex: numberValue(item.pageIndex ?? item.page_index, defaults.pageIndex ?? 0),
          audioIndex: numberValue(item.audioIndex ?? item.audio_index, defaults.audioIndex ?? 0),
          startMs,
          endMs: Math.max(startMs + 1, endMs),
          text,
          lang: typeof item.lang === "string" ? item.lang : undefined,
          ...(words.length > 0 ? { words } : {})
        };
      })
      .filter(Boolean) as ListenCaptionCue[];
  } catch {
    return [];
  }
}

function parseTimestamp(value?: string): number | undefined {
  if (!value) return undefined;
  const parts = value.replace(",", ".").split(":");
  const seconds = Number(parts.pop());
  const minutes = Number(parts.pop() || 0);
  const hours = Number(parts.pop() || 0);
  if (![seconds, minutes, hours].every(Number.isFinite)) return undefined;
  return Math.round(((hours * 60 + minutes) * 60 + seconds) * 1000);
}

function cleanCaptionText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/&nbsp;/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\[[0-9a-f]{6}\]/gi, "")
    .replace(/\[ffffff\]/gi, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function captionLanguage(value: string): string | undefined {
  const match = value.match(/<p\s+class\s*=\s*["']?([a-z]+)[^>]*>/i);
  return match?.[1]?.toLowerCase();
}

function millisValue(value: unknown): number {
  if (typeof value === "number") return Math.max(0, Math.round(value));
  if (typeof value === "string") {
    const timestamp = parseTimestamp(value);
    if (timestamp != null) return timestamp;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.max(0, Math.round(parsed));
  }
  return 0;
}

function numberValue(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseWordTimings(value: unknown, cueStartMs: number, cueEndMs: number): CaptionWordTiming[] {
  const records = Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as { words?: unknown[] }).words)
      ? (value as { words: unknown[] }).words
      : [];

  return records
    .map((record) => {
      const item = record && typeof record === "object" ? (record as Record<string, unknown>) : {};
      const text = String(item.text ?? item.word ?? item.token ?? item.value ?? "").trim();
      const startMs = wordTimingMillis(item, ["startMs", "start_ms", "start", "time"], cueStartMs);
      const endMs = wordTimingMillis(item, ["endMs", "end_ms", "end"], startMs || cueEndMs);
      if (!text || endMs <= startMs) return undefined;
      return { text, startMs, endMs };
    })
    .filter(Boolean) as CaptionWordTiming[];
}

function wordTimingMillis(item: Record<string, unknown>, keys: string[], fallback: number): number {
  for (const key of keys) {
    if (item[key] == null) continue;
    const value = item[key];
    if (typeof value === "number" && !Number.isInteger(value) && Math.abs(value) < 3600) {
      return Math.round(value * 1000);
    }
    return millisValue(value);
  }
  for (const key of keys) {
    const secondsKey = `${key}_sec`;
    const seconds = Number(item[secondsKey]);
    if (Number.isFinite(seconds)) return Math.round(seconds * 1000);
  }
  return fallback;
}
