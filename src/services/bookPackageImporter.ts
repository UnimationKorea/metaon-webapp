import { getBookResourceManifest } from "../api/uniplanetApi";
import { indexedDbStorage } from "./indexedDbStorage";
import { guessMimeType } from "./mime";
import { packageKeyFor } from "./packageKeys";
import { planBookResourceDownload } from "./bookResourcePriority";
import { cacheBookMediaResponse, deleteCachedBookMedia, isBookMediaCacheResource } from "./videoMediaCache";
import type { StoredPackageFile } from "../types/ports";
import type { BookData, BookPackage, BookResource, BookResourceManifest, DownloadProgress } from "../types/metaonTypes";

// MOVIE01 now caches optional script audio and word-level caption timing files.
export const BOOK_PACKAGE_CACHE_VERSION = 9;
export const BOOK_MEDIA_CACHE_VERSION = 1;

export function bookPackageContentVersion(packageMeta: Pick<BookPackage, "contentVersion" | "manifest">): string {
  const explicitVersion = normalizeContentVersion(packageMeta.contentVersion);
  if (explicitVersion) return explicitVersion;

  const manifestBook = (packageMeta.manifest as Partial<BookResourceManifest> | undefined)?.book;
  return normalizeContentVersion(manifestBook?.appVersion);
}

export function isBookPackageCurrentVersion(packageMeta: Pick<BookPackage, "contentVersion" | "manifest">, contentVersion?: string): boolean {
  const expectedVersion = normalizeContentVersion(contentVersion);
  if (!expectedVersion) return true;

  const cachedVersion = bookPackageContentVersion(packageMeta);
  return Boolean(cachedVersion) && cachedVersion === expectedVersion;
}

export async function invalidateCachedBookPackage(packageMeta: Pick<BookPackage, "key">): Promise<void> {
  await Promise.all([indexedDbStorage.deletePackage(packageMeta.key), deleteCachedBookMedia(packageMeta.key)]);
}

export async function downloadAndCacheBookPackage(
  book: BookData,
  onProgress?: (progress: DownloadProgress) => void
): Promise<BookPackage> {
  const manifest = await getBookResourceManifest(book.bookIdx);
  const key = manifest.key || packageKeyFor(book);
  const contentVersion = normalizeContentVersion(manifest.book.appVersion || book.appVersion);
  const existingPackage = await indexedDbStorage.getPackage(key);
  if (existingPackage && !isBookPackageCurrentVersion(existingPackage, contentVersion)) {
    await invalidateCachedBookPackage(existingPackage);
  }
  const generatedFiles = manifest.generatedFiles.map<StoredPackageFile>((file) => {
    const blob = new Blob([file.content], { type: file.mimeType });
    return {
      packageKey: key,
      path: normalizePath(file.path),
      blob,
      size: blob.size,
      mimeType: file.mimeType
    };
  });
  const downloadedFiles: StoredPackageFile[] = [];
  const downloadedFileMap = new Map<string, StoredPackageFile>();
  const cachedBlobMap = new Map<string, Blob>();
  const mediaCachePaths = new Set<string>();
  const downloadPlan = planBookResourceDownload(manifest.resources, manifest.lessonDays);
  const seenResourcePaths = new Set(manifest.resources.map((resource) => normalizePath(resource.path)));
  let totalFiles = manifest.resources.length;
  let loadedFiles = 0;
  let loadedBytes = generatedFiles.reduce((sum, file) => sum + file.size, 0);

  onProgress?.({
    phase: "downloading",
    ratio: 0,
    loadedBytes,
    totalBytes: totalFiles,
    message: "Preparing MetaOn3 resources"
  });

  async function downloadResource(resource: BookResource): Promise<void> {
    const path = normalizePath(resource.path);
    const cached = await indexedDbStorage.getFileBlob(key, path);
    if (cached) {
      cachedBlobMap.set(path, cached);
      const restoredToMediaCache = await cacheBookMediaResponse(
        key,
        { path, mimeType: resource.mimeType || cached.type, category: resource.category },
        new Response(cached, { headers: { "Content-Type": resource.mimeType || cached.type || "application/octet-stream" } })
      );
      if (restoredToMediaCache) mediaCachePaths.add(path);
      loadedFiles += 1;
      loadedBytes += cached.size;
      onProgress?.({
        phase: "downloading",
        ratio: totalFiles > 0 ? loadedFiles / totalFiles : 1,
        loadedBytes,
        totalBytes: totalFiles,
        currentFile: path,
        message: "Using cached resource"
      });
      return;
    }

    let response: Response;
    try {
      response = await fetch(resource.url);
    } catch (caught) {
      // NPC Quick Check resources are only prepared for some books — a missing one must not fail
      // the whole book import. Skip it; the Book page hides NPC activities without resources.
      if (isNpcResource(resource)) return skipOptionalResource(path);
      throw caught;
    }
    if (!response.ok) {
      if (isNpcResource(resource)) return skipOptionalResource(path);
      throw new Error(`Failed to download ${resource.sourcePath}: ${response.status} ${response.statusText}`);
    }
    // Keep raw image, audio, and video responses in Cache Storage. Failure never
    // fails the existing IndexedDB import, which remains the compatibility path.
    const cacheMediaPromise = cacheBookMediaResponse(
      key,
      { path, mimeType: resource.mimeType, category: resource.category },
      response.clone()
    );
    const responseBlob = await response.blob();
    // IndexedDB persists the Blob's MIME type. Keep the manifest type when S3
    // returns a generic response type so cached video still decodes as media.
    const mimeType = resource.mimeType || responseBlob.type || "application/octet-stream";
    const blob = responseBlob.type === mimeType ? responseBlob : new Blob([responseBlob], { type: mimeType });
    downloadedFiles.push({
      packageKey: key,
      path,
      blob,
      size: blob.size,
      mimeType
    });
    downloadedFileMap.set(path, downloadedFiles[downloadedFiles.length - 1]);
    if (await cacheMediaPromise) mediaCachePaths.add(path);
    loadedFiles += 1;
    loadedBytes += blob.size;
    onProgress?.({
      phase: "downloading",
      ratio: totalFiles > 0 ? loadedFiles / totalFiles : 1,
      loadedBytes,
      totalBytes: totalFiles,
      currentFile: path
    });
  }

  function skipOptionalResource(path: string): void {
    loadedFiles += 1;
    onProgress?.({
      phase: "downloading",
      ratio: totalFiles > 0 ? loadedFiles / totalFiles : 1,
      loadedBytes,
      totalBytes: totalFiles,
      currentFile: path,
      message: "Optional resource not prepared — skipping"
    });
  }

  for (const resource of downloadPlan.orderedResources) {
    await downloadResource(resource);
  }

  const ebookAssetResources = await collectEbookAssetResources(manifest.resources, key, downloadedFileMap, cachedBlobMap);
  const npcQuickCheckAssetResources = await collectNpcQuickCheckAssetResources(manifest.resources, key, downloadedFileMap, cachedBlobMap);
  const discoveredAssetResources = [...ebookAssetResources, ...npcQuickCheckAssetResources];
  const newDiscoveredAssetResources = discoveredAssetResources.filter((resource) => {
    const path = normalizePath(resource.path);
    if (seenResourcePaths.has(path)) return false;
    seenResourcePaths.add(path);
    return true;
  });

  if (newDiscoveredAssetResources.length > 0) {
    totalFiles += newDiscoveredAssetResources.length;
    const discoveredPlan = planBookResourceDownload(newDiscoveredAssetResources, manifest.lessonDays);
    for (const resource of discoveredPlan.orderedResources) {
      await downloadResource(resource);
    }
  }

  const npcScriptPaths = Array.from(new Set([...downloadedFileMap.keys(), ...cachedBlobMap.keys()])).filter((path) =>
    /\/npcqhk2?\/script\.json$/i.test(path)
  );

  const packageMeta: BookPackage = {
    key,
    cacheVersion: BOOK_PACKAGE_CACHE_VERSION,
    contentVersion,
    source: "metaon3-resources",
    bookIdx: manifest.book.bookIdx || book.bookIdx,
    bookId: manifest.book.bookId || book.bookId,
    seriesGroup: manifest.book.seriesGroup || book.seriesGroup,
    seriesIdx: manifest.book.seriesIdx || book.seriesIdx,
    downloadedAt: new Date().toISOString(),
    totalFiles: generatedFiles.length + totalFiles,
    totalBytes: loadedBytes,
    lessonDays: manifest.lessonDays,
    npcScriptPaths,
    mediaCachePaths: Array.from(mediaCachePaths),
    mediaCacheVersion: BOOK_MEDIA_CACHE_VERSION,
    // Persist only files that were successfully written or reused from IndexedDB.
    // Optional resources can be absent from an API manifest, so the renderer must
    // not treat every declared manifest path as locally available.
    filePaths: Array.from(
      new Set([
        ...generatedFiles.map((file) => file.path),
        ...downloadedFileMap.keys(),
        ...cachedBlobMap.keys()
      ])
    ),
    manifest
  };

  onProgress?.({ phase: "saving", ratio: 0.96, message: "Saving resources to browser cache" });
  await indexedDbStorage.savePackage(packageMeta, [...generatedFiles, ...downloadedFiles]);
  onProgress?.({ phase: "done", ratio: 1, message: "Resources are ready" });

  return packageMeta;
}

export async function getCachedPackage(book: Pick<BookData, "bookIdx" | "seriesGroup" | "seriesIdx" | "bookId">): Promise<BookPackage | undefined> {
  const cached = await indexedDbStorage.getPackage(packageKeyFor(book));
  if (cached?.cacheVersion !== BOOK_PACKAGE_CACHE_VERSION) return undefined;
  return hydratePriorityMediaCache(cached);
}

async function hydratePriorityMediaCache(packageMeta: BookPackage): Promise<BookPackage> {
  if (packageMeta.mediaCacheVersion === BOOK_MEDIA_CACHE_VERSION || typeof caches === "undefined") return packageMeta;
  if (!isBookResourceManifest(packageMeta.manifest)) return packageMeta;

  const plan = planBookResourceDownload(packageMeta.manifest.resources, packageMeta.manifest.lessonDays);
  const mediaCachePaths = new Set(packageMeta.mediaCachePaths || []);
  let updated = false;

  for (const resource of plan.immediateResources) {
    if (!isBookMediaCacheResource(resource)) continue;
    const path = normalizePath(resource.path);
    const blob = await indexedDbStorage.getFileBlob(packageMeta.key, path);
    if (!blob) continue;
    const cached = await cacheBookMediaResponse(
      packageMeta.key,
      { path, mimeType: resource.mimeType || blob.type, category: resource.category },
      new Response(blob, { headers: { "Content-Type": resource.mimeType || blob.type || "application/octet-stream" } })
    );
    if (cached) {
      mediaCachePaths.add(path);
      updated = true;
    }
  }

  if (!updated) return packageMeta;
  const nextPackage = {
    ...packageMeta,
    mediaCachePaths: Array.from(mediaCachePaths),
    mediaCacheVersion: BOOK_MEDIA_CACHE_VERSION
  };
  await indexedDbStorage.savePackage(nextPackage, []);
  return nextPackage;
}

function isBookResourceManifest(value: unknown): value is BookResourceManifest {
  if (!value || typeof value !== "object") return false;
  const manifest = value as Partial<BookResourceManifest>;
  return Array.isArray(manifest.resources) && Array.isArray(manifest.lessonDays);
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

function normalizeContentVersion(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function isNpcResource(resource: BookResource): boolean {
  return resource.category === "npcqhk" || resource.category === "npcqhk2";
}

async function collectEbookAssetResources(
  resources: BookResource[],
  key: string,
  downloadedFileMap: Map<string, StoredPackageFile>,
  cachedBlobMap: Map<string, Blob>
): Promise<BookResource[]> {
  const result: BookResource[] = [];

  for (const resource of resources) {
    const bookJsonPath = normalizePath(resource.path);
    if (!/\/ebook\/book\.json$/i.test(bookJsonPath)) continue;

    const blob = downloadedFileMap.get(bookJsonPath)?.blob || cachedBlobMap.get(bookJsonPath) || (await indexedDbStorage.getFileBlob(key, bookJsonPath));
    if (!blob) continue;

    const json = parseJsonSafely(await readBlobText(blob));
    if (!json) continue;

    result.push(...ebookAssetResourcesFromBookJson(json, resource));
  }

  return result;
}

async function collectNpcQuickCheckAssetResources(
  resources: BookResource[],
  key: string,
  downloadedFileMap: Map<string, StoredPackageFile>,
  cachedBlobMap: Map<string, Blob>
): Promise<BookResource[]> {
  const result: BookResource[] = [];

  for (const resource of resources) {
    const scriptPath = normalizePath(resource.path);
    if (!/\/npcqhk2?\/script\.json$/i.test(scriptPath)) continue;

    const blob = downloadedFileMap.get(scriptPath)?.blob || cachedBlobMap.get(scriptPath) || (await indexedDbStorage.getFileBlob(key, scriptPath));
    if (!blob) continue;

    const script = parseJsonSafely(await readBlobText(blob));
    if (!script) continue;
    for (const audioPath of npcQuickCheckAudioPaths(script)) {
      result.push(npcQuickCheckAssetResource(resource, audioPath));
    }
  }

  return result;
}

function ebookAssetResourcesFromBookJson(value: unknown, bookJsonResource: BookResource): BookResource[] {
  const book = recordValue(value);
  const pages = Array.isArray(book.pages) ? book.pages : [];
  const resources: BookResource[] = [];

  pages.forEach((rawPage) => {
    const page = recordValue(rawPage);
    const imagePath = firstString(page.img, page.image, page.imagePath, page.page);
    if (imagePath) resources.push(ebookAssetResource(bookJsonResource, imagePath));

    firstStringArray(page.audioPaths, page.audio, page.audios).forEach((audioPath) => {
      resources.push(ebookAssetResource(bookJsonResource, audioPath));
    });
  });

  return resources;
}

function ebookAssetResource(bookJsonResource: BookResource, relativePath: string): BookResource {
  const normalizedRelativePath = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  const bookJsonVirtualPath = normalizePath(bookJsonResource.path);
  const ebookVirtualBase = bookJsonVirtualPath.replace(/\/book\.json$/i, "");
  const sourcePath = resolveRelativeSourcePath(bookJsonResource.sourcePath, normalizedRelativePath);
  const url = resolveRelativeUrl(bookJsonResource.url, normalizedRelativePath);

  return {
    path: resolveRelativeVirtualPath(ebookVirtualBase, normalizedRelativePath),
    sourcePath,
    url,
    mimeType: guessMimeType(normalizedRelativePath),
    category: "ebook"
  };
}

function npcQuickCheckAssetResource(scriptResource: BookResource, relativePath: string): BookResource {
  const normalizedRelativePath = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  const scriptVirtualPath = normalizePath(scriptResource.path);
  const npcqhkVirtualBase = scriptVirtualPath.replace(/\/script\.json$/i, "");
  const sourcePath = resolveRelativeSourcePath(scriptResource.sourcePath, normalizedRelativePath);
  const url = resolveRelativeUrl(scriptResource.url, normalizedRelativePath);

  return {
    path: resolveRelativeVirtualPath(npcqhkVirtualBase, normalizedRelativePath),
    sourcePath,
    url,
    mimeType: guessMimeType(normalizedRelativePath),
    category: "npcqhk"
  };
}

function resolveRelativeVirtualPath(ebookVirtualBase: string, relativePath: string): string {
  if (/^https?:\/\//i.test(relativePath)) return relativePath;
  if (/^Lessons\//i.test(relativePath)) return normalizePath(relativePath);
  if (relativePath.toLowerCase().startsWith(`${ebookVirtualBase.toLowerCase()}/`)) return normalizePath(relativePath);
  if (relativePath.toLowerCase().startsWith("ebook/")) return `${ebookVirtualBase}/${relativePath.slice("ebook/".length)}`;
  return `${ebookVirtualBase}/${relativePath}`;
}

function resolveRelativeSourcePath(bookJsonSourcePath: string, relativePath: string): string {
  if (/^https?:\/\//i.test(relativePath)) return relativePath;
  if (/^https?:\/\//i.test(bookJsonSourcePath)) return new URL(relativePath, bookJsonSourcePath).href;
  const normalizedBookPath = bookJsonSourcePath.replace(/\\/g, "/");
  const sourceBase = normalizedBookPath.replace(/\/(?:book|script)\.json(?:\?.*)?$/i, "");
  return `${sourceBase}/${relativePath}`.replace(/\/{2,}/g, "/");
}

function resolveRelativeUrl(bookJsonUrl: string, relativePath: string): string {
  if (/^https?:\/\//i.test(relativePath)) return relativePath;
  return new URL(relativePath, bookJsonUrl).href;
}

async function readBlobText(blob: Blob): Promise<string> {
  if (typeof blob.text === "function") return blob.text();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Failed to read blob text."));
    reader.readAsText(blob);
  });
}

function parseJsonSafely(text: string): unknown | undefined {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function firstStringArray(...values: unknown[]): string[] {
  for (const value of values) {
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
    if (typeof value === "string" && value.trim()) return [value.trim()];
  }
  return [];
}

function npcQuickCheckAudioPaths(value: unknown): string[] {
  const result = new Set<string>();
  const seen = new Set<unknown>();

  function visit(current: unknown): void {
    if (!current || typeof current !== "object" || seen.has(current)) return;
    seen.add(current);
    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }

    for (const [key, entry] of Object.entries(current as Record<string, unknown>)) {
      if (isNpcQuickCheckAudioKey(key)) {
        if (typeof entry === "string" && entry.trim()) result.add(entry.trim());
        if (Array.isArray(entry)) {
          entry.filter((item): item is string => typeof item === "string" && item.trim().length > 0).forEach((item) => result.add(item.trim()));
        }
      }
      visit(entry);
    }
  }

  visit(value);
  return Array.from(result);
}

function isNpcQuickCheckAudioKey(value: string): boolean {
  const key = value.replace(/[_-]/g, "").toLowerCase();
  return key === "audio" || key === "audios" || key === "audiopath" || key === "audiopaths" || key === "audiourl";
}
