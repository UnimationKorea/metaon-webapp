import type { LearnEvent } from "../types/learnEvents";

const DB_NAME = "metaon-learn-event-outbox";
const DB_VERSION = 1;
const STORE_NAME = "runs";

export type LearnEventOutboxRun = {
  run_id: string;
  batch_id: string;
  log_idx?: number;
  events: LearnEvent[];
  created_at: string;
  updated_at: string;
};

export function createLearnEventRunId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `learn-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export async function saveLearnEventRun(run: LearnEventOutboxRun): Promise<void> {
  const db = await openDb();
  await requestToPromise(db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(run));
}

export async function listBoundLearnEventRuns(): Promise<LearnEventOutboxRun[]> {
  const db = await openDb();
  const runs = await requestToPromise<LearnEventOutboxRun[]>(
    db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll()
  );
  return runs
    .filter((run) => Number.isInteger(run.log_idx) && (run.log_idx || 0) > 0 && run.events.length > 0)
    .sort((left, right) => left.created_at.localeCompare(right.created_at));
}

export async function deleteLearnEventRun(runId: string): Promise<void> {
  const db = await openDb();
  await requestToPromise(db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(runId));
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "run_id" });
    };
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}
