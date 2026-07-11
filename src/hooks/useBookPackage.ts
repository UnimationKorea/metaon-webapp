import { useCallback, useEffect, useState } from "react";
import { downloadAndCacheBookPackage, getCachedPackage } from "../services/bookPackageImporter";
import type { BookData, BookPackage, DownloadProgress } from "../types/metaonTypes";

export function useBookPackage(book?: BookData) {
  const [packageMeta, setPackageMeta] = useState<BookPackage>();
  const [progress, setProgress] = useState<DownloadProgress>({ phase: "idle", ratio: 0 });
  const [error, setError] = useState<string>();
  const [isCheckingCache, setIsCheckingCache] = useState(true);

  const refresh = useCallback(async () => {
    if (!book) {
      setPackageMeta(undefined);
      setIsCheckingCache(false);
      return;
    }
    setIsCheckingCache(true);
    try {
      setPackageMeta(await getCachedPackage(book));
    } finally {
      setIsCheckingCache(false);
    }
  }, [book]);

  useEffect(() => {
    let active = true;

    async function loadCachedPackage() {
      if (!book) {
        if (active) {
          setPackageMeta(undefined);
          setIsCheckingCache(false);
        }
        return;
      }

      setPackageMeta(undefined);
      setError(undefined);
      setProgress({ phase: "idle", ratio: 0 });
      setIsCheckingCache(true);
      try {
        const cached = await getCachedPackage(book);
        if (active) setPackageMeta(cached);
      } catch (caught) {
        if (active) {
          const message = caught instanceof Error ? caught.message : String(caught);
          setError(message);
          setProgress({ phase: "error", ratio: 0, message });
        }
      } finally {
        if (active) setIsCheckingCache(false);
      }
    }

    void loadCachedPackage();
    return () => {
      active = false;
    };
  }, [book]);

  const download = useCallback(async (overrideBook?: BookData) => {
    const targetBook = overrideBook || book;
    if (!targetBook) {
      const message = "Book is not selected.";
      setError(message);
      setProgress({ phase: "error", ratio: 0, message });
      return;
    }
    setError(undefined);
    setProgress({ phase: "downloading", ratio: 0, message: "Requesting package" });
    try {
      const next = await downloadAndCacheBookPackage(targetBook, setProgress);
      setPackageMeta(next);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setProgress({ phase: "error", ratio: 0, message });
      setError(message);
    }
  }, [book]);

  return {
    packageMeta,
    progress,
    error,
    isDownloaded: Boolean(packageMeta),
    isCheckingCache,
    isBusy: isCheckingCache || ["downloading", "unzipping", "saving"].includes(progress.phase),
    download,
    refresh
  };
}
