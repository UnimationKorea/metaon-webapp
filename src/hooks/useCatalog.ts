import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getBookCatalog } from "../api/uniplanetApi";
import { useAuth } from "./useAuth";
import type { BookCatalog, SeriesData, SeriesGroup } from "../types/metaonTypes";

export function useCatalog() {
  const { authVersion, isAuthenticated, isLoading: isAuthLoading, profile } = useAuth();
  const [catalog, setCatalog] = useState<BookCatalog>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [usingSample, setUsingSample] = useState(false);
  const requestIdRef = useRef(0);
  const selectedProfileId = isAuthenticated && profile?.userIdx ? profile.userIdx : 0;

  const reload = useCallback(async (options: { refresh?: boolean } = {}) => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(undefined);
    // A catalog is scoped to the selected learner, not merely to the account session.
    // Do not show stale/sample brands while the learner selection is incomplete.
    if (!selectedProfileId) {
      setCatalog(undefined);
      setUsingSample(false);
      setIsLoading(false);
      return;
    }
    try {
      const remoteCatalog = await getBookCatalog({ refresh: options.refresh });
      if (requestId !== requestIdRef.current) return;
      setCatalog(remoteCatalog);
      setUsingSample(false);
    } catch (caught) {
      if (requestId !== requestIdRef.current) return;
      setCatalog(undefined);
      setUsingSample(false);
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, [selectedProfileId]);

  useEffect(() => {
    if (isAuthLoading) return;
    reload();
    return () => {
      requestIdRef.current += 1;
    };
  }, [authVersion, isAuthLoading, reload]);

  const totals = useMemo(() => {
    const brands = catalog?.brands.length || 0;
    const groups = catalog?.groups.length || 0;
    const series = catalog?.groups.reduce((sum, group) => sum + group.seriesList.length, 0) || 0;
    const books =
      catalog?.groups.reduce(
        (sum, group) => sum + group.seriesList.reduce((seriesSum, item) => seriesSum + item.books.length, 0),
        0
      ) || 0;
    return { brands, groups, series, books };
  }, [catalog]);

  return {
    catalog,
    isLoading,
    error,
    usingSample,
    totals,
    reload
  };
}

export function flattenSeries(groups: SeriesGroup[]): SeriesData[] {
  return groups.flatMap((group) => group.seriesList);
}
