import { packageKeyFor } from "./packageKeys";
import type { Activity, BookCatalog, BookData, BrandData, LessonDay, SeriesData, SeriesGroup } from "../types/metaonTypes";

export type HubBrand = {
  accent: string;
  bookCount: number;
  brand: BrandData;
  description: string;
  id: string;
  name: string;
};

export type HubBook = {
  book: BookData;
  brand: BrandData;
  group: SeriesGroup;
  id: string;
  key: string;
  series: SeriesData;
};

const accents = ["#20a66b", "#f5bd42", "#2d8cff", "#ff795f", "#14aab8", "#7c5cff", "#20a66b"];
const fallbackCovers = [
  "/metaon-assets/covers/picnic-map.png",
  "/metaon-assets/covers/rainy-shop.png",
  "/metaon-assets/covers/animals.png",
  "/metaon-assets/covers/sky.png"
];

export function getHubBrands(catalog?: BookCatalog): HubBrand[] {
  return (catalog?.brands || [])
    .filter((brand) => brand.groups.some((group) => group.seriesList.some((series) => series.books.length > 0)))
    .map((brand, index) => {
      const bookCount = brand.groups.reduce(
        (sum, group) => sum + group.seriesList.reduce((seriesSum, series) => seriesSum + series.books.length, 0),
        0
      );
      return {
        accent: accents[index % accents.length],
        bookCount,
        brand,
        description: `${brand.groups.length} groups · ${bookCount} books`,
        id: String(brand.brandId || brand.brandName),
        name: brand.brandName || `Brand ${brand.brandId}`
      };
    });
}

export function getHubBooks(catalog?: BookCatalog): HubBook[] {
  return (catalog?.brands || []).flatMap((brand) =>
    brand.groups.flatMap((group) =>
      group.seriesList.flatMap((series) =>
        series.books.map((book) => ({
          book,
          brand,
          group,
          id: String(book.bookIdx || `${book.seriesGroup}:${book.seriesIdx}:${book.bookId}`),
          key: packageKeyFor(book),
          series
        }))
      )
    )
  );
}

export function getBrandGroups(brand?: BrandData): SeriesGroup[] {
  return (brand?.groups || []).filter((group) => group.seriesList.some((series) => series.books.length > 0));
}

export function getSeriesBooks(series?: SeriesData): BookData[] {
  return series?.books || [];
}

export function fallbackCoverFor(index: number): string {
  return fallbackCovers[index % fallbackCovers.length];
}

export function percent(completed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((completed / total) * 100);
}

export function routeForBook(book: Pick<BookData, "bookIdx" | "bookId" | "seriesGroup" | "seriesIdx">): string {
  return book.bookIdx
    ? `/books/${book.bookIdx}`
    : `/books/${book.seriesGroup}/${book.seriesIdx}/${encodeURIComponent(book.bookId)}`;
}

export function routeForPlacementRecommendation(
  catalog: BookCatalog | undefined,
  target: { grade: string; level: string } | undefined
): string {
  if (!catalog || !target) return "/study";

  const brand = findRazKidsBrand(catalog);
  if (!brand) return "/study";

  const group = getBrandGroups(brand).find((candidate) => matchesRazGrade(candidate.groupName, target.grade)) || getBrandGroups(brand)[0];
  const series =
    group?.seriesList.find((candidate) => candidate.books.length > 0 && matchesRazLevel(candidate.seriesName, target.level)) ||
    group?.seriesList.find((candidate) => candidate.books.length > 0);
  const book = getSeriesBooks(series)[0];

  if (!group || !series || !book) return "/study";

  const params = new URLSearchParams({
    brand: String(brand.brandId),
    group: String(group.groupId),
    series: String(series.seriesIdx),
    book: String(book.bookIdx || book.bookId),
    menu: "1"
  });

  return `/study?${params.toString()}`;
}

export function routeForActivity(
  book: Pick<BookData, "bookIdx" | "bookId" | "seriesGroup" | "seriesIdx">,
  day: Pick<LessonDay, "id" | "dayIdx"> | string,
  activity: Pick<Activity, "actIdx" | "actNum"> | number
): string {
  if (book.bookIdx && typeof day !== "string" && typeof activity !== "number" && activity.actIdx) {
    return `/activity/${book.bookIdx}/${day.dayIdx || encodeURIComponent(day.id)}/${activity.actIdx}`;
  }

  const dayId = typeof day === "string" ? day : day.id;
  const actNum = typeof activity === "number" ? activity : activity.actNum;
  return `/activity/${book.seriesGroup}/${book.seriesIdx}/${encodeURIComponent(book.bookId)}/${encodeURIComponent(dayId)}/${actNum}`;
}

function findRazKidsBrand(catalog: BookCatalog): BrandData | undefined {
  const visibleBrands = (catalog.brands || []).filter((brand) => getBrandGroups(brand).length > 0);
  return (
    visibleBrands.find((brand) => /raz[-\s]?kids/i.test(brand.brandName)) ||
    visibleBrands.find((brand) => brand.groups.some((group) => /raz[-\s]?kids/i.test(group.groupName)))
  );
}

function matchesRazGrade(groupName: string, grade: string): boolean {
  const groupKey = normalizePlacementKey(groupName);
  return gradeKeys(grade).some((gradeKey) => groupKey === gradeKey || groupKey.endsWith(gradeKey) || groupKey.includes(gradeKey));
}

function matchesRazLevel(seriesName: string, level: string): boolean {
  const seriesKey = normalizePlacementKey(seriesName);
  const levelKey = normalizePlacementKey(level);
  return Boolean(levelKey) && (seriesKey === levelKey || seriesKey.endsWith(levelKey));
}

function gradeKeys(grade: string): string[] {
  const key = normalizePlacementKey(grade);
  if (key === "p" || key === "pre" || key === "prek") return ["pre", "prek"];
  if (key === "k") return ["k"];
  return [key];
}

function normalizePlacementKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/\(rhk\)/g, "")
    .replace(/raz[-\s]?kids/g, "")
    .replace(/\bgrade\b/g, "")
    .replace(/\blevel\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}
