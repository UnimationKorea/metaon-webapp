import type { BookCatalog, BookData, SeriesData, SeriesGroup } from "../types/metaonTypes";

export function findSeries(catalog: BookCatalog | undefined, seriesGroup: number, seriesIdx: number): SeriesData | undefined {
  for (const group of catalog?.groups || []) {
    const series = group.seriesList.find((item) => {
      const seriesMatches = (group.groupId === seriesGroup || item.seriesGroup === seriesGroup) && item.seriesIdx === seriesIdx;
      const bookMatches = item.books.some((book) => book.seriesGroup === seriesGroup && book.seriesIdx === seriesIdx);
      return seriesMatches || bookMatches;
    });
    if (series) return series;
  }
  return undefined;
}

export function findBook(
  catalog: BookCatalog | undefined,
  seriesGroup: number,
  seriesIdx: number,
  bookId: string
): BookData | undefined {
  for (const group of catalog?.groups || []) {
    for (const series of group.seriesList) {
      const book = series.books.find(
        (item) => item.seriesGroup === seriesGroup && item.seriesIdx === seriesIdx && item.bookId === bookId
      );
      if (book) return book;
    }
  }
  return findSeries(catalog, seriesGroup, seriesIdx)?.books.find((book) => book.bookId === bookId);
}

export function findBookByIdx(catalog: BookCatalog | undefined, bookIdx: number): BookData | undefined {
  for (const group of catalog?.groups || []) {
    for (const series of group.seriesList) {
      const book = series.books.find((item) => item.bookIdx === bookIdx);
      if (book) return book;
    }
  }
  return undefined;
}

export function findSeriesByBookIdx(catalog: BookCatalog | undefined, bookIdx: number): SeriesData | undefined {
  for (const group of catalog?.groups || []) {
    for (const series of group.seriesList) {
      if (series.books.some((book) => book.bookIdx === bookIdx)) return series;
    }
  }
  return undefined;
}

export function firstSeries(groups: SeriesGroup[]): SeriesData | undefined {
  return groups[0]?.seriesList[0];
}
