import { useCallback, useEffect, useMemo, useState } from "react";
import { getBookCatalog } from "../api/uniplanetApi";
import { sampleCatalog } from "../data/sampleCatalog";
import { useAuth } from "./useAuth";
import type { BookCatalog, SeriesData, SeriesGroup } from "../types/metaonTypes";

export function useCatalog() {
  const { authVersion } = useAuth();
  const [catalog, setCatalog] = useState<BookCatalog>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [usingSample, setUsingSample] = useState(false);

  const reload = useCallback(async (options: { refresh?: boolean } = {}) => {
    setIsLoading(true);
    setError(undefined);
    try {
      const remoteCatalog = await getBookCatalog({ refresh: options.refresh });
      setCatalog(remoteCatalog);
      setUsingSample(false);
    } catch (caught) {
      setCatalog(sampleCatalog);
      setUsingSample(true);
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [authVersion, reload]);

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
