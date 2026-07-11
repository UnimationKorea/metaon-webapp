import type { BookPackage } from "../types/metaonTypes";
import type { StoragePort, StoredPackageFile } from "../types/ports";

const DB_NAME = "metaon-web-cache";
const DB_VERSION = 1;
const PACKAGES_STORE = "packages";
const FILES_STORE = "files";

type StoredFileRecord = StoredPackageFile & {
  id: string;
};

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
      db.transaction(FILES_STORE, "readonly").objectStore(FILES_STORE).getAll()
    );
    return files.filter((file) => file.packageKey === packageKey).map(stripFileId);
  },

  async getFileBlob(packageKey, path) {
    const db = await openDb();
    const file = await requestToPromise<StoredFileRecord | undefined>(
      db.transaction(FILES_STORE, "readonly").objectStore(FILES_STORE).get(fileId(packageKey, path))
    );
    return file?.blob;
  },

  async deletePackage(packageKey) {
    const db = await openDb();
    const files = await this.listFiles(packageKey);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([PACKAGES_STORE, FILES_STORE], "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);

      tx.objectStore(PACKAGES_STORE).delete(packageKey);
      const fileStore = tx.objectStore(FILES_STORE);
      for (const file of files) {
        fileStore.delete(fileId(packageKey, file.path));
      }
    });
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
      if (!db.objectStoreNames.contains(FILES_STORE)) {
        db.createObjectStore(FILES_STORE, { keyPath: "id" });
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
