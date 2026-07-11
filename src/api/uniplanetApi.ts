import { normalizeCatalog } from "./catalogNormalizer";
import { normalizeBookResourceManifest } from "../services/metaon3ResourceAdapter";
import type { LearnEvent } from "../types/learnEvents";
import type { BookCatalog, BookResourceManifest } from "../types/metaonTypes";

const CLIENT_ID_KEY = "metaon-web-client-id";
const SESSION_ID_KEY = "metaon-session-id";
const USER_IDX_KEY = "metaon-user-idx";

export interface MetaOnUser {
  userIdx: number;
  userId: string;
  username: string;
  email: string;
  joinstep: number;
}

export interface MetaOnAuthState {
  authenticated: boolean;
  user: MetaOnUser | null;
  userIdx: number;
}

export async function getBookCatalog(options: { refresh?: boolean } = {}): Promise<BookCatalog> {
  const response = await fetch(options.refresh ? "/api/books?refresh=1" : "/api/books", {
    credentials: "same-origin",
    headers: {
      ...sessionHeaders(),
      ...(options.refresh ? { "Cache-Control": "no-cache" } : {})
    }
  });
  await throwForBadResponse(response);
  return normalizeCatalog(await response.json());
}

export async function getCurrentMetaOnAuth(): Promise<MetaOnAuthState> {
  const response = await fetch("/api/auth/me", {
    credentials: "same-origin",
    headers: sessionHeaders()
  });
  await throwForBadResponse(response);
  const payload = await response.json();
  const user = parseMetaOnUser(payload.user);
  if (payload.authenticated && user) {
    persistAuthUser(user, payload.userIdx);
  } else {
    clearStoredAuth();
  }
  return {
    authenticated: Boolean(payload.authenticated && user),
    user,
    userIdx: Number(payload.userIdx || user?.userIdx || 0)
  };
}

export async function loginMetaOn(userId: string, password: string): Promise<MetaOnAuthState> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      ...sessionHeaders(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ user_id: userId, password })
  });
  const payload = await readJsonResponse(response);
  const user = parseMetaOnUser(payload.user);
  if (payload.authenticated && user) {
    persistAuthUser(user, payload.userIdx);
  } else {
    clearStoredAuth();
  }
  return {
    authenticated: Boolean(payload.authenticated && user),
    user,
    userIdx: Number(payload.userIdx || user?.userIdx || 0)
  };
}

export async function applyMetaOnSession(userIdx: number, sessionId: string): Promise<MetaOnAuthState> {
  const response = await fetch("/api/auth/session", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      ...sessionHeaders(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ userIdx, sessionId })
  });
  const payload = await readJsonResponse(response);
  const user = parseMetaOnUser(payload.user);
  if (payload.authenticated && user) {
    persistAuthUser(user, payload.userIdx || userIdx);
  } else {
    clearStoredAuth();
  }
  return {
    authenticated: Boolean(payload.authenticated && user),
    user,
    userIdx: Number(payload.userIdx || user?.userIdx || userIdx)
  };
}

export async function logoutMetaOn(): Promise<void> {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
      headers: sessionHeaders()
    });
  } catch {
    // Local session state still needs to be cleared if the server is unreachable.
  } finally {
    clearStoredAuth();
  }
}

export async function getBookResourceManifest(bookIdx: number): Promise<BookResourceManifest> {
  const response = await fetch(`/api/books/${bookIdx}/resource-manifest`, {
    credentials: "same-origin",
    headers: sessionHeaders()
  });
  await throwForBadResponse(response);
  const payload = await response.json();
  if (isBookResourceManifest(payload)) {
    return payload;
  }
  return normalizeBookResourceManifest(payload);
}

export async function startStudy(payload: unknown): Promise<unknown> {
  return postStudy("/api/study/start", payload);
}

export async function endStudy(payload: unknown): Promise<unknown> {
  return postStudy("/api/study/end", payload);
}

export async function acceptQuiz(payload: unknown): Promise<unknown> {
  return postStudy("/api/study/quiz-accept", payload);
}

export async function submitQuickCheck(payload: unknown): Promise<unknown> {
  return postStudy("/api/study/quiz-accept", payload);
}

export async function getQuickCheckQuiz(payload: unknown): Promise<unknown> {
  return postStudy("/api/study/quick-check", payload);
}

export async function sendLearnEvents(payload: { log_idx: number; events: LearnEvent[] }): Promise<unknown> {
  return postStudy("/api/learn/events", payload);
}

export async function uploadLearnRecording(payload: unknown): Promise<unknown> {
  return postStudy("/api/learn/recording", payload);
}

async function postStudy(url: string, payload: unknown): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      ...sessionHeaders(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  captureSessionId(response);
  await throwForBadResponse(response);
  return response.json();
}

async function throwForBadResponse(response: Response): Promise<void> {
  captureSessionId(response);
  if (response.ok) return;

  let message = response.statusText;
  try {
    const payload = await response.json();
    message = payload.detail || payload.resultMessage || payload.message || message;
  } catch {
    // Keep status text when the server returns non-JSON content.
  }

  throw new Error(message);
}

async function readJsonResponse(response: Response): Promise<Record<string, unknown>> {
  captureSessionId(response);
  let payload: Record<string, unknown> = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const message = String(payload.detail || payload.resultMessage || payload.message || response.statusText);
    throw new Error(message);
  }

  return payload;
}

function sessionHeaders(): HeadersInit {
  const userIdx = localStorage.getItem(USER_IDX_KEY) || "";
  return {
    "X-MetaOn-Client-Id": getClientId(),
    "X-MetaOn-Session-Id": localStorage.getItem(SESSION_ID_KEY) || "",
    "X-MetaOn-User-Idx": userIdx
  };
}

function isBookResourceManifest(value: unknown): value is BookResourceManifest {
  if (!value || typeof value !== "object") return false;
  const manifest = value as Partial<BookResourceManifest>;
  return Array.isArray(manifest.lessonDays) && Array.isArray(manifest.resources) && Array.isArray(manifest.generatedFiles);
}

function captureSessionId(response: Response): void {
  const sessionId = response.headers.get("x-metaon-session-id");
  if (sessionId) {
    localStorage.setItem(SESSION_ID_KEY, sessionId);
  }
}

function getClientId(): string {
  const existing = localStorage.getItem(CLIENT_ID_KEY);
  if (existing) return existing;

  const next = crypto.randomUUID();
  localStorage.setItem(CLIENT_ID_KEY, next);
  return next;
}

function parseMetaOnUser(value: unknown): MetaOnUser | null {
  if (!value || typeof value !== "object") return null;
  const user = value as Partial<MetaOnUser> & Record<string, unknown>;
  const userIdx = Number(user.userIdx || user.user_idx || 0);
  if (!Number.isFinite(userIdx) || userIdx <= 0) return null;
  return {
    userIdx,
    userId: String(user.userId || user.user_id || ""),
    username: String(user.username || `User ${userIdx}`),
    email: String(user.email || ""),
    joinstep: Number(user.joinstep || 0)
  };
}

function persistAuthUser(user: MetaOnUser | null, fallbackUserIdx?: unknown): void {
  const userIdx = user?.userIdx || Number(fallbackUserIdx || 0);
  if (Number.isFinite(userIdx) && userIdx > 0) {
    localStorage.setItem(USER_IDX_KEY, String(userIdx));
  }
}

function clearStoredAuth(): void {
  localStorage.removeItem(SESSION_ID_KEY);
  localStorage.removeItem(USER_IDX_KEY);
}
