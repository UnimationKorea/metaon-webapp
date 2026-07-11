const EBOOK_ACTIVITY_CODE = "EBOOK01";
const LISTENING_ACT_TYPE = 67;
const SOURCE_SECTION_PATTERN = /\/(?:word|sentence|reading|listening)\//i;

export async function discoverEbookResources(
  manifest,
  { fetchImpl = globalThis.fetch, bookDataBase, timeoutMs = 5000 } = {}
) {
  if (!manifest || !Array.isArray(manifest.resources) || !Array.isArray(manifest.lessonDays)) {
    return manifest;
  }

  const existingPaths = new Set(manifest.resources.map((resource) => normalizePath(resource?.path).toLowerCase()));
  const candidates = manifest.lessonDays
    .filter(hasListeningActivity)
    .map((day) => ebookCandidateForDay(day, manifest.resources, bookDataBase))
    .filter(Boolean)
    .filter((candidate) => !existingPaths.has(candidate.path.toLowerCase()));

  if (candidates.length === 0 || typeof fetchImpl !== "function") return manifest;

  const discovered = (
    await Promise.all(candidates.map((candidate) => probeEbookCandidate(candidate, fetchImpl, timeoutMs)))
  ).filter(Boolean);

  if (discovered.length === 0) return manifest;

  return {
    ...manifest,
    resources: [...manifest.resources, ...discovered]
  };
}

function hasListeningActivity(day) {
  return (day?.activities || []).some(
    (activity) =>
      Number(activity?.actType) === LISTENING_ACT_TYPE ||
      String(activity?.activityCode || "").trim().toUpperCase() === EBOOK_ACTIVITY_CODE
  );
}

function ebookCandidateForDay(day, resources, bookDataBase) {
  const virtualBase = `Lessons/L${Number(day?.lesson) || 1}/D${Number(day?.day) || 1}`;
  const sourceRoot = sourceRootForDay(resources, virtualBase);
  if (!sourceRoot) return undefined;

  const sourcePath = `${sourceRoot}/ebook/book.json`;
  const url = resourceUrl(sourcePath, bookDataBase);
  if (!url) return undefined;

  return {
    path: `${virtualBase}/ebook/book.json`,
    sourcePath,
    url,
    mimeType: "application/json",
    category: "ebook"
  };
}

function sourceRootForDay(resources, virtualBase) {
  const virtualPrefix = `${virtualBase.toLowerCase()}/`;
  for (const resource of resources) {
    if (!normalizePath(resource?.path).toLowerCase().startsWith(virtualPrefix)) continue;
    const sourcePath = String(resource?.sourcePath || "").replace(/\\/g, "/").split(/[?#]/, 1)[0];
    const match = SOURCE_SECTION_PATTERN.exec(sourcePath);
    if (match?.index != null) return sourcePath.slice(0, match.index);
  }
  return "";
}

function resourceUrl(sourcePath, bookDataBase) {
  if (/^https?:\/\//i.test(sourcePath)) return sourcePath;
  const base = String(bookDataBase || "").replace(/\/+$/, "");
  if (!base) return "";
  return `${base}/${sourcePath.replace(/^\/+/, "")}`;
}

async function probeEbookCandidate(candidate, fetchImpl, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  timeout.unref?.();

  try {
    const response = await fetchImpl(candidate.url, { method: "HEAD", signal: controller.signal });
    if (!response?.ok) return undefined;

    const size = Number(response.headers?.get?.("content-length") || 0) || undefined;
    return {
      ...candidate,
      ...(size ? { size } : {}),
      etag: response.headers?.get?.("etag") || undefined,
      lastModified: response.headers?.get?.("last-modified") || undefined
    };
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizePath(value) {
  return String(value || "").replace(/\\/g, "/").replace(/^\/+/, "");
}
