import type { BookPackage } from "../types/metaonTypes";
import type { StoragePort, StoredPackageFile } from "../types/ports";

const DB_NAME = "metaon-web-cache";
const DB_VERSION = 2;
const PACKAGES_STORE = "packages";
const FILES_STORE = "files";
const FILES_BY_PACKAGE_KEY_INDEX = "by-package-key";
const MAX_MEMORY_BLOB_BYTES = 24 * 1024 * 1024;
const MAX_MEMORY_BLOB_ENTRY_BYTES = 2 * 1024 * 1024;

type StoredFileRecord = StoredPackageFile & {
  id: string;
};

const filePathRequests = new Map<string, Promise<string[]>>();
const memoryBlobs = new Map<string, Blob>();
let memoryBlobBytes = 0;

export const indexedDbStorage: StoragePort = {
  async getPackage(packageKey) {
    const db = await openDb();
    return requestToPromise<BookPackage | undefined>(
      db.transaction(PACKAGES_STORE, "readonly").objectStore(PACKAGES_STORE).get(packageKey)
    );
  },

  async savePackage(packageMeta, files) {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([PACKAGES_STORE, FILES_STORE], "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);

      tx.objectStore(PACKAGES_STORE).put(packageMeta, packageMeta.key);
      const fileStore = tx.objectStore(FILES_STORE);
      for (const file of files) {
        fileStore.put({ ...file, id: fileId(file.packageKey, file.path) });
      }
    });
    filePathRequests.delete(packageMeta.key);
    files.forEach((file) => cacheMemoryBlob(fileId(file.packageKey, file.path), file.blob));
  },

  async listPackages() {
    const db = await openDb();
    return requestToPromise<BookPackage[]>(
      db.transaction(PACKAGES_STORE, "readonly").objectStore(PACKAGES_STORE).getAll()
    );
  },

  async listFiles(packageKey) {
    const db = await openDb();
    const files = await requestToPromise<StoredFileRecord[]>(
      db.transaction(FILES_STORE, "readonly").objectStore(FILES_STORE).index(FILES_BY_PACKAGE_KEY_INDEX).getAll(packageKey)
    );
    return files.map(stripFileId);
  },

  async listFilePaths(packageKey) {
    const pending = filePathRequests.get(packageKey);
    if (pending) return pending;

    const request = (async () => {
      const db = await openDb();
      const index = db.transaction(FILES_STORE, "readonly").objectStore(FILES_STORE).index(FILES_BY_PACKAGE_KEY_INDEX);
      const keys = await requestToPromise<IDBValidKey[]>(index.getAllKeys(packageKey));
      const prefix = `${packageKey}::`;
      return keys
        .map((key) => String(key))
        .filter((key) => key.startsWith(prefix))
        .map((key) => key.slice(prefix.length));
    })();
    filePathRequests.set(packageKey, request);
    try {
      return await request;
    } catch (error) {
      filePathRequests.delete(packageKey);
      throw error;
    }
  },

  async getFileBlob(packageKey, path) {
    const id = fileId(packageKey, path);
    const memoryBlob = takeMemoryBlob(id);
    if (memoryBlob) return memoryBlob;
    const db = await openDb();
    const file = await requestToPromise<StoredFileRecord | undefined>(
      db.transaction(FILES_STORE, "readonly").objectStore(FILES_STORE).get(id)
    );
    if (file?.blob) cacheMemoryBlob(id, file.blob);
    return file?.blob;
  },

  async deletePackage(packageKey) {
    const db = await openDb();
    const paths = await this.listFilePaths(packageKey);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([PACKAGES_STORE, FILES_STORE], "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);

      tx.objectStore(PACKAGES_STORE).delete(packageKey);
      const fileStore = tx.objectStore(FILES_STORE);
      for (const path of paths) {
        fileStore.delete(fileId(packageKey, path));
      }
    });
    filePathRequests.delete(packageKey);
    clearMemoryBlobsForPackage(packageKey);
  }
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PACKAGES_STORE)) {
        db.createObjectStore(PACKAGES_STORE);
      }
      const fileStore = db.objectStoreNames.contains(FILES_STORE)
        ? request.transaction!.objectStore(FILES_STORE)
        : db.createObjectStore(FILES_STORE, { keyPath: "id" });
      if (!fileStore.indexNames.contains(FILES_BY_PACKAGE_KEY_INDEX)) {
        fileStore.createIndex(FILES_BY_PACKAGE_KEY_INDEX, "packageKey", { unique: false });
      }
    };
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function fileId(packageKey: string, path: string): string {
  return `${packageKey}::${path}`;
}

function stripFileId(file: StoredFileRecord): StoredPackageFile {
  const { id: _id, ...rest } = file;
  return rest;
}

function takeMemoryBlob(id: string): Blob | undefined {
  const blob = memoryBlobs.get(id);
  if (!blob) return undefined;
  memoryBlobs.delete(id);
  memoryBlobs.set(id, blob);
  return blob;
}

function cacheMemoryBlob(id: string, blob: Blob): void {
  if (blob.size > MAX_MEMORY_BLOB_ENTRY_BYTES) return;
  const existing = memoryBlobs.get(id);
  if (existing) {
    memoryBlobBytes -= existing.size;
    memoryBlobs.delete(id);
  }
  memoryBlobs.set(id, blob);
  memoryBlobBytes += blob.size;
  while (memoryBlobBytes > MAX_MEMORY_BLOB_BYTES && memoryBlobs.size > 0) {
    const oldest = memoryBlobs.entries().next().value as [string, Blob] | undefined;
    if (!oldest) break;
    memoryBlobs.delete(oldest[0]);
    memoryBlobBytes -= oldest[1].size;
  }
}

function clearMemoryBlobsForPackage(packageKey: string): void {
  const prefix = `${packageKey}::`;
  for (const [id, blob] of memoryBlobs) {
    if (!id.startsWith(prefix)) continue;
    memoryBlobs.delete(id);
    memoryBlobBytes -= blob.size;
  }
}
