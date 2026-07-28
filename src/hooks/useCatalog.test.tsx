import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BookCatalog } from "../types/metaonTypes";
import { useCatalog } from "./useCatalog";

const mocks = vi.hoisted(() => ({
  auth: {
    authVersion: 0,
    isAuthenticated: false,
    isLoading: false,
    profile: null as { userIdx: number } | null
  },
  getBookCatalog: vi.fn()
}));

vi.mock("./useAuth", () => ({
  useAuth: () => mocks.auth
}));

vi.mock("../api/uniplanetApi", () => ({
  getBookCatalog: mocks.getBookCatalog
}));

const catalog: BookCatalog = {
  resultCode: 1,
  resultMessage: "ok",
  fetchedAt: "2026-07-28T00:00:00.000Z",
  brands: [],
  groups: []
};

describe("useCatalog", () => {
  beforeEach(() => {
    mocks.auth = { authVersion: 0, isAuthenticated: false, isLoading: false, profile: null };
    mocks.getBookCatalog.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("does not request brands until a learning profile is selected", async () => {
    const { result } = renderHook(() => useCatalog());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mocks.getBookCatalog).not.toHaveBeenCalled();
    expect(result.current.catalog).toBeUndefined();
  });

  it("loads brands only after the selected profile is available", async () => {
    mocks.getBookCatalog.mockResolvedValue(catalog);
    const { result, rerender } = renderHook(() => useCatalog());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mocks.getBookCatalog).not.toHaveBeenCalled();

    mocks.auth = {
      authVersion: 1,
      isAuthenticated: true,
      isLoading: false,
      profile: { userIdx: 25 }
    };
    rerender();

    await waitFor(() => expect(mocks.getBookCatalog).toHaveBeenCalledWith({ refresh: undefined }));
    expect(result.current.catalog).toEqual(catalog);
  });
});
