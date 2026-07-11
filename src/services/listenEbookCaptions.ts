export type ListenCaptionCue = {
  pageIndex: number;
  audioIndex: number;
  startMs: number;
  endMs: number;
  text: string;
  lang?: string;
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
    const records = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { cues?: unknown[] }).cues)
        ? (parsed as { cues: unknown[] }).cues
        : Array.isArray((parsed as { captions?: unknown[] }).captions)
          ? (parsed as { captions: unknown[] }).captions
          : [];

    return records
      .map((record) => {
        const item = record && typeof record === "object" ? (record as Record<string, unknown>) : {};
        const text = String(item.text ?? item.caption ?? item.Eng ?? item.eng ?? "").trim();
        const startMs = millisValue(item.startMs ?? item.start_ms ?? item.start ?? item.time ?? 0);
        const endValue = item.endMs ?? item.end_ms ?? item.end;
        const duration = millisValue(item.durationMs ?? item.duration_ms ?? item.duration);
        const endMs = endValue == null ? startMs + (duration || 3000) : millisValue(endValue);
        if (!text) return undefined;
        return {
          pageIndex: numberValue(item.pageIndex ?? item.page_index, defaults.pageIndex ?? 0),
          audioIndex: numberValue(item.audioIndex ?? item.audio_index, defaults.audioIndex ?? 0),
          startMs,
          endMs: Math.max(startMs + 1, endMs),
          text,
          lang: typeof item.lang === "string" ? item.lang : undefined
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
