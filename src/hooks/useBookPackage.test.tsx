import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BookData, BookPackage } from "../types/metaonTypes";
import { useBookPackage } from "./useBookPackage";

const mocks = vi.hoisted(() => ({
  getBookResourceVersion: vi.fn(),
  getCachedPackage: vi.fn(),
  invalidateCachedBookPackage: vi.fn(),
  isBookPackageCurrentVersion: vi.fn(),
  downloadAndCacheBookPackage: vi.fn()
}));

vi.mock("../api/uniplanetApi", () => ({ getBookResourceVersion: mocks.getBookResourceVersion }));
vi.mock("../services/bookPackageImporter", () => ({
  getCachedPackage: mocks.getCachedPackage,
  invalidateCachedBookPackage: mocks.invalidateCachedBookPackage,
  isBookPackageCurrentVersion: mocks.isBookPackageCurrentVersion,
  downloadAndCacheBookPackage: mocks.downloadAndCacheBookPackage
}));

const book: BookData = {
  seriesGroup: 7,
  seriesIdx: 17,
  bookIdx: 22,
  bookId: "GPLB64",
  bookName: "What Flies in the Sky?",
  bookNumber: 1,
  lexile: "",
  bUrl: "",
  thumbnailUrl: "",
  themeId: 0,
  appVersion: "2"
};

const cached: BookPackage = {
  key: "book:22",
  source: "metaon3-resources",
  contentVersion: "1",
  bookId: book.bookId,
  seriesGroup: book.seriesGroup,
  seriesIdx: book.seriesIdx,
  downloadedAt: "2026-08-01T00:00:00.000Z",
  totalFiles: 1,
  totalBytes: 1,
  lessonDays: []
};

describe("useBookPackage resource version validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCachedPackage.mockResolvedValue(cached);
    mocks.getBookResourceVersion.mockResolvedValue({ bookIdx: book.bookIdx, contentVersion: "2" });
    mocks.isBookPackageCurrentVersion.mockReturnValue(false);
    mocks.invalidateCachedBookPackage.mockResolvedValue(undefined);
  });

  it("removes an outdated cached Book before the Book page starts its automatic download", async () => {
    const { result } = renderHook(() => useBookPackage(book));

    await waitFor(() => expect(result.current.isCheckingCache).toBe(false));

    expect(mocks.getBookResourceVersion).toHaveBeenCalledWith(book.bookIdx);
    expect(mocks.invalidateCachedBookPackage).toHaveBeenCalledWith(cached);
    expect(result.current.packageMeta).toBeUndefined();
    expect(result.current.isDownloaded).toBe(false);
  });

  it("keeps a cached Book available when the resource version matches", async () => {
    mocks.isBookPackageCurrentVersion.mockReturnValue(true);
    const { result } = renderHook(() => useBookPackage(book));

    await waitFor(() => expect(result.current.isCheckingCache).toBe(false));

    expect(mocks.invalidateCachedBookPackage).not.toHaveBeenCalled();
    expect(result.current.packageMeta).toEqual(cached);
  });
});
