import { normalizeCatalog } from "./catalogNormalizer";
import { normalizeBookResourceManifest } from "../services/metaon3ResourceAdapter";
import type { LearnEvent } from "../types/learnEvents";
import type { BookCatalog, BookResourceManifest } from "../types/metaonTypes";

const CLIENT_ID_KEY = "metaon-web-client-id";
const SESSION_ID_KEY = "metaon-session-id";
export const METAON_PROFILE_SESSION_EVENT = "metaon:profile-session-state";

export interface MetaOnAccount {
  accountIdx: number;
  userId: string;
  username: string;
  email: string;
  canChangePassword: boolean;
  canManageProfiles: boolean;
  isBtb: boolean;
  role?: number;
}

export interface MetaOnProfile {
  userIdx: number;
  username: string;
  status: number;
  isActive: boolean;
  isCurrent: boolean;
  isDeleted: boolean;
  spoint: number;
  lpoint: number;
  llevel: number;
}

// Existing Activity and Hub components use this name for the active learner.
export type MetaOnUser = MetaOnProfile;

export interface MetaOnAuthState {
  account: MetaOnAccount | null;
  accountAuthenticated: boolean;
  authenticated: boolean;
  profile: MetaOnProfile | null;
  profileSelected: boolean;
  profiles: MetaOnProfile[];
  user: MetaOnUser | null;
  userIdx: number;
}

export interface MetaOnProfileSelectionResult extends MetaOnAuthState {
  holderIdleSec?: number;
  resultCode: number;
  resultMessage: string;
}

export interface MetaOnProfileManagementState extends MetaOnAuthState {
  managedProfiles: MetaOnProfile[];
}

export class MetaOnApiError extends Error {
  readonly resultCode: number;

  constructor(message: string, resultCode = 0) {
    super(message);
    this.name = "MetaOnApiError";
    this.resultCode = resultCode;
  }
}

export async function getBookCatalog(options: { refresh?: boolean } = {}): Promise<BookCatalog> {
  const response = await fetch(options.refresh ? "/api/books?refresh=1" : "/api/books", {
    credentials: "same-origin",
    headers: {
      ...sessionHeaders(),
      ...(options.refresh ? { "Cache-Control": "no-cache" } : {})
    }
  });
  const payload = await readJsonResponse(response);
  assertMetaOnSuccess(payload);
  return normalizeCatalog(payload);
}

export async function getCurrentMetaOnAuth(): Promise<MetaOnAuthState> {
  const response = await fetch("/api/auth/me", {
    credentials: "same-origin",
    headers: sessionHeaders()
  });
  const payload = await readJsonResponse(response);
  return parseMetaOnAuthState(payload);
}

export async function loginMetaOn(userId: string, password: string): Promise<MetaOnAuthState> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      ...clientHeaders(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ user_id: userId, password })
  });
  const payload = await readJsonResponse(response);
  assertMetaOnSuccess(payload);
  return parseMetaOnAuthState(payload);
}

export async function getMetaOnProfiles(): Promise<MetaOnAuthState> {
  const response = await fetch("/api/auth/profiles", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      ...sessionHeaders(),
      "Content-Type": "application/json"
    },
    body: "{}"
  });
  const payload = await readJsonResponse(response);
  assertMetaOnSuccess(payload);
  return parseMetaOnAuthState(payload);
}

export async function selectMetaOnProfile(userIdx: number, force = false): Promise<MetaOnProfileSelectionResult> {
  const response = await fetch("/api/auth/profile/select", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      ...sessionHeaders(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ user_idx: userIdx, force: force ? 1 : 0 })
  });
  // Profile-selection result codes (notably 351, 352 and 353) are UI states,
  // so preserve their body even when an upstream gateway assigns a non-2xx status.
  const payload = await readJsonResponse(response, { allowHttpError: true });
  const state = parseMetaOnAuthState(payload);
  return {
    ...state,
    holderIdleSec: numberValue(payload.holder_idle_sec ?? payload.holderIdleSec),
    resultCode: numberValue(payload.resultCode),
    resultMessage: stringValue(payload.resultMessage)
  };
}

export async function createMetaOnProfile(username: string): Promise<MetaOnAuthState> {
  const response = await fetch("/api/auth/profile/create", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      ...sessionHeaders(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ username: username.trim() })
  });
  const payload = await readJsonResponse(response);
  assertMetaOnSuccess(payload);
  return parseMetaOnAuthState(payload);
}

export async function renameMetaOnProfile(userIdx: number, username: string): Promise<MetaOnAuthState> {
  const response = await fetch("/api/auth/profile/rename", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      ...sessionHeaders(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ user_idx: userIdx, username: username.trim() })
  });
  const payload = await readJsonResponse(response);
  assertMetaOnSuccess(payload);
  return parseMetaOnAuthState(payload);
}

export async function getMetaOnManagedProfiles(): Promise<MetaOnProfileManagementState> {
  const response = await fetch("/api/auth/profiles/manage", {
    method: "POST",
    credentials: "same-origin",
    headers: { ...sessionHeaders(), "Content-Type": "application/json" },
    body: "{}"
  });
  const payload = await readJsonResponse(response);
  assertMetaOnSuccess(payload);
  return parseMetaOnProfileManagementState(payload);
}

export async function setMetaOnProfileActive(userIdx: number, active: boolean): Promise<MetaOnProfileManagementState> {
  const response = await fetch("/api/auth/profile/set-active", {
    method: "POST",
    credentials: "same-origin",
    headers: { ...sessionHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ user_idx: userIdx, active })
  });
  const payload = await readJsonResponse(response);
  assertMetaOnSuccess(payload);
  return parseMetaOnProfileManagementState(payload);
}

export async function deleteMetaOnProfile(userIdx: number): Promise<MetaOnProfileManagementState> {
  const response = await fetch("/api/auth/profile/delete", {
    method: "POST",
    credentials: "same-origin",
    headers: { ...sessionHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ user_idx: userIdx })
  });
  const payload = await readJsonResponse(response);
  assertMetaOnSuccess(payload);
  return parseMetaOnProfileManagementState(payload);
}

export async function changeMetaOnPassword(currentPassword: string, newPassword: string): Promise<MetaOnAuthState> {
  const response = await fetch("/api/auth/password/change", {
    method: "POST",
    credentials: "same-origin",
    headers: { ...sessionHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
  });
  const payload = await readJsonResponse(response);
  assertMetaOnSuccess(payload);
  return parseMetaOnAuthState(payload);
}

export async function releaseMetaOnProfile(): Promise<MetaOnAuthState> {
  const response = await fetch("/api/auth/profile/release", {
    method: "POST",
    credentials: "same-origin",
    headers: { ...sessionHeaders(), "Content-Type": "application/json" },
    body: "{}"
  });
  const payload = await readJsonResponse(response);
  assertMetaOnSuccess(payload);
  return parseMetaOnAuthState(payload);
}

export async function releaseStoredMetaOnProfileOnStartup(): Promise<void> {
  const storedSessionId = localStorage.getItem(SESSION_ID_KEY);
  if (!storedSessionId) return;

  try {
    const response = await fetch("/api/auth/startup-release", {
      method: "POST",
      credentials: "same-origin",
      headers: { ...clientHeaders(), "X-MetaOn-Session-Id": storedSessionId, "Content-Type": "application/json" },
      body: "{}"
    });
    await readJsonResponse(response);
  } catch {
    // Startup release is best effort. The stored session must still be discarded.
  } finally {
    clearStoredAuth();
  }
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
  const payload = await readJsonResponse(response);
  assertMetaOnSuccess(payload);
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

export type WrongLearnItem = { item_idx: number; text: string };
export type WrongLearnItems = { words: WrongLearnItem[]; sentences: WrongLearnItem[] };

export async function getWrongItems(bookIdx: number): Promise<WrongLearnItems> {
  const data = asRecord(await postStudy("/api/learn/wrong-items", { book_idx: bookIdx }));
  return {
    words: normalizeWrongItemList(data.words),
    sentences: normalizeWrongItemList(data.sentences)
  };
}

function normalizeWrongItemList(value: unknown): WrongLearnItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((raw) => {
      const item = asRecord(raw);
      const itemIdx = Number(item.item_idx ?? item.itemIdx ?? item.idx ?? 0);
      const text = String(item.text ?? item.en ?? item.word ?? item.sentence ?? "").trim();
      return { item_idx: Number.isFinite(itemIdx) ? itemIdx : 0, text };
    })
    .filter((item) => item.item_idx > 0);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
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
  const data = await readJsonResponse(response);
  assertMetaOnSuccess(data);
  return data;
}

async function readJsonResponse(
  response: Response,
  options: { allowHttpError?: boolean } = {}
): Promise<Record<string, unknown>> {
  captureSessionId(response);
  let payload: Record<string, unknown> = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const message = String(payload.detail || payload.resultMessage || payload.message || response.statusText);
    const resultCode = numberValue(payload.resultCode);
    notifyProfileSessionState(resultCode);
    if (!options.allowHttpError) {
      throw new MetaOnApiError(message, resultCode);
    }
  }

  return payload;
}

function clientHeaders(): HeadersInit {
  return { "X-MetaOn-Client-Id": getClientId() };
}

function sessionHeaders(): HeadersInit {
  return {
    ...clientHeaders(),
    "X-MetaOn-Session-Id": localStorage.getItem(SESSION_ID_KEY) || ""
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

function parseMetaOnAuthState(value: unknown): MetaOnAuthState {
  const payload = asRecord(value);
  const account = parseMetaOnAccount(payload.account);
  const profiles = Array.isArray(payload.profiles)
    ? payload.profiles.map(parseMetaOnProfile).filter((profile): profile is MetaOnProfile => Boolean(profile))
    : [];
  const selected = parseMetaOnProfile(payload.profile ?? payload.user) || profiles.find((profile) => profile.isCurrent) || null;

  return {
    account,
    accountAuthenticated: Boolean(payload.accountAuthenticated && account),
    authenticated: Boolean(payload.profileSelected && selected),
    profile: selected,
    profileSelected: Boolean(payload.profileSelected && selected),
    profiles,
    user: selected,
    userIdx: selected?.userIdx || 0
  };
}

function parseMetaOnProfileManagementState(value: unknown): MetaOnProfileManagementState {
  const payload = asRecord(value);
  const auth = parseMetaOnAuthState(payload);
  const rawManagedProfiles = payload.managedProfiles ?? payload.managed_profiles;
  const managedProfiles = Array.isArray(rawManagedProfiles)
    ? rawManagedProfiles.map(parseMetaOnProfile).filter((profile): profile is MetaOnProfile => Boolean(profile))
    : auth.profiles;
  return { ...auth, managedProfiles };
}

function parseMetaOnAccount(value: unknown): MetaOnAccount | null {
  const account = asRecord(value);
  const accountIdx = numberValue(account.accountIdx ?? account.account_idx ?? account.idx);
  const userId = stringValue(account.userId ?? account.user_id);
  if (!accountIdx && !userId) return null;
  return {
    accountIdx,
    userId,
    username: stringValue(account.username ?? account.userName) || (accountIdx ? `Account ${accountIdx}` : "MetaOn Account"),
    email: stringValue(account.email),
    canChangePassword: booleanValue(account.canChangePassword ?? account.can_change_password, true),
    canManageProfiles: booleanValue(account.canManageProfiles ?? account.can_manage_profiles, true),
    isBtb: booleanValue(account.isBtb ?? account.is_btb, false),
    role: numberValue(account.role) || undefined
  };
}

function parseMetaOnProfile(value: unknown): MetaOnProfile | null {
  if (!value || typeof value !== "object") return null;
  const user = value as Partial<MetaOnProfile> & Record<string, unknown>;
  const userIdx = numberValue(user.userIdx ?? user.user_idx ?? user.idx);
  if (!Number.isFinite(userIdx) || userIdx <= 0) return null;
  return {
    userIdx,
    username: stringValue(user.username ?? user.userName) || `Profile ${userIdx}`,
    status: numberValue(user.status),
    isActive: booleanValue(user.isActive ?? user.is_active, numberValue(user.status) !== 1),
    isCurrent: booleanValue(user.isCurrent ?? user.is_current, false),
    isDeleted: booleanValue(user.isDeleted ?? user.is_deleted, false),
    spoint: numberValue(user.spoint ?? user.userSPoint ?? user.userPoint),
    lpoint: numberValue(user.lpoint ?? user.userLPoint),
    llevel: numberValue(user.llevel ?? user.lLevel)
  };
}

function assertMetaOnSuccess(payload: Record<string, unknown>): void {
  const resultCode = numberValue(payload.resultCode);
  if (!resultCode || resultCode === 1) return;
  const message = stringValue(payload.resultMessage ?? payload.detail ?? payload.message) || `MetaOn request failed (${resultCode}).`;
  notifyProfileSessionState(resultCode);
  throw new MetaOnApiError(message, resultCode);
}

function notifyProfileSessionState(resultCode: number): void {
  if (typeof window === "undefined" || ![340, 346, 352].includes(resultCode)) return;
  window.dispatchEvent(new CustomEvent(METAON_PROFILE_SESSION_EVENT, { detail: { resultCode } }));
}

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stringValue(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function booleanValue(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1") return true;
  if (value === 0 || value === "0") return false;
  return fallback;
}

function clearStoredAuth(): void {
  localStorage.removeItem(SESSION_ID_KEY);
}
