const INSTALL_MARKER = "__metaonApiConsoleTraceInstalled";
const SECRET_KEY = /(?:password|authorization|cookie|session(?:[_-]?id)?|token|secret|api[_-]?key|signature|image(?:[_-]?(?:base64|data))?)/i;
const MAX_STRING_LENGTH = 8_000;

type TraceWindow = Window & { [INSTALL_MARKER]?: boolean };

/**
 * Shows BFF traffic in the browser DevTools Console. Server-side tracing is
 * separate; both intentionally redact credentials and binary handwriting data.
 */
export function installApiConsoleTrace(): void {
  if (typeof window === "undefined") return;
  const traceWindow = window as TraceWindow;
  if (traceWindow[INSTALL_MARKER]) return;
  traceWindow[INSTALL_MARKER] = true;

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init);
    if (!isSameOriginApiRequest(request.url)) return nativeFetch(input, init);

    const startedAt = performance.now();
    const requestId = createRequestId();
    void logBrowserRequest(requestId, request);

    try {
      const response = await nativeFetch(input, init);
      void logBrowserResponse(requestId, request, response, startedAt);
      return response;
    } catch (error) {
      console.error("[MetaOn API] browser response error", redact({
        request_id: requestId,
        method: request.method,
        url: request.url,
        elapsed_ms: Math.round(performance.now() - startedAt),
        error: error instanceof Error ? error.message : String(error)
      }));
      throw error;
    }
  };
}

function isSameOriginApiRequest(value: string): boolean {
  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin && url.pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

async function logBrowserRequest(requestId: string, request: Request): Promise<void> {
  console.info("[MetaOn API] browser request", redact({
    request_id: requestId,
    method: request.method,
    url: request.url,
    headers: Object.fromEntries(request.headers.entries()),
    body: await readBody(request.clone())
  }));
}

async function logBrowserResponse(
  requestId: string,
  request: Request,
  response: Response,
  startedAt: number
): Promise<void> {
  console.info("[MetaOn API] browser response", redact({
    request_id: requestId,
    method: request.method,
    url: request.url,
    status: response.status,
    elapsed_ms: Math.round(performance.now() - startedAt),
    headers: Object.fromEntries(response.headers.entries()),
    body: await readBody(response.clone())
  }));
}

async function readBody(response: Response | Request): Promise<unknown> {
  try {
    const text = await response.text();
    if (!text) return undefined;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  } catch {
    return "[unavailable]";
  }
}

function redact(value: unknown, key = ""): unknown {
  if (SECRET_KEY.test(key)) return "[REDACTED]";
  if (typeof value === "string") {
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}...[truncated ${value.length - MAX_STRING_LENGTH} chars]`
      : value;
  }
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([entryKey, entryValue]) => [entryKey, redact(entryValue, entryKey)]));
}

function createRequestId(): string {
  return typeof crypto?.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
