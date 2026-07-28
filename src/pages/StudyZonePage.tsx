import { ChevronLeft, ChevronRight, Home, Palette, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { useCatalog } from "../hooks/useCatalog";
import { useHubState, type HubProgress, type HubRecentBook } from "../hooks/useHubState";
import {
  fallbackCoverFor,
  findSeriesForPlacement,
  getBrandGroups,
  getHubBrands,
  getRecentBooks,
  getSeriesBooks,
  percent,
  routeForBook
} from "../services/hubCatalog";
import { packageKeyFor } from "../services/packageKeys";
import type { BookData, BrandData, SeriesData, SeriesGroup } from "../types/metaonTypes";

// 거인의 책장: 레벨 칸(bay)이 옆으로 이어진 하나의 서가 벽. 열면 "내 레벨" 칸이
// 화면 중앙에 정렬되어 있고, 스와이프/미니맵으로 전 카탈로그를 훑는다.

export type ShelfBay = {
  id: string;
  group: SeriesGroup;
  series: SeriesData;
  books: BookData[];
  gradeName: string;
  levelName: string;
};

const GRADE_COLORS = ["#f5c664", "#9ede7a", "#7cc4f2", "#b39df0", "#f2a3bd", "#7fd8cf", "#f0a06c"];

const SHELF_THEME_KEY = "metaon.studyZone.shelfTheme";
const SHELF_THEMES = [
  { id: "wood", label: "원목" },
  { id: "sky", label: "하늘" },
  { id: "forest", label: "숲" },
  { id: "berry", label: "베리" },
  { id: "night", label: "밤" }
] as const;

function readShelfTheme(): string {
  try {
    const stored = window.localStorage.getItem(SHELF_THEME_KEY);
    return SHELF_THEMES.some((theme) => theme.id === stored) ? (stored as string) : "wood";
  } catch {
    return "wood";
  }
}

export function StudyZonePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { catalog, error, isLoading, reload, usingSample } = useCatalog();
  const { getBookProgress, placement, progress, recentBooks: recentEntries, user } = useHubState();
  const [query, setQuery] = useState("");
  const [isSearchOpen, setSearchOpen] = useState(false);
  const [isThemeOpen, setThemeOpen] = useState(false);
  const [shelfTheme, setShelfTheme] = useState(readShelfTheme);
  const wallRef = useRef<HTMLDivElement>(null);
  const scrolledKeyRef = useRef("");
  // The minimap highlight sits on the grade chip whose bay is centered in the wall. Chips are
  // equal-width flex items, so the box position is derived in CSS from the active index (--i) and
  // grade count (--n) — exact, and free of DOM-measurement timing bugs.
  const [activeGradeIndex, setActiveGradeIndex] = useState(0);
  // The level (bay) centered in the wall — drives the "next level" jump chip.
  const [activeBayIndex, setActiveBayIndex] = useState(0);

  const brands = useMemo(() => getHubBrands(catalog), [catalog]);
  const selectedBrand = selectBrand(catalog?.brands, brandParam(searchParams.get("brand")));
  const bays = useMemo(() => buildBays(selectedBrand), [selectedBrand]);
  const gradeBlocks = useMemo(() => buildGradeBlocks(bays), [bays]);
  const gradeBlocksRef = useRef(gradeBlocks);
  gradeBlocksRef.current = gradeBlocks;
  const seriesParam = numberParam(searchParams.get("series"));
  const bookParam = searchParams.get("book");

  const recentKeys = useMemo(() => buildRecentKeys(recentEntries, progress), [recentEntries, progress]);
  const cartBooks = useMemo(() => getRecentBooks(catalog, recentKeys, 3), [catalog, recentKeys]);

  const myBayIndex = useMemo(
    () => resolveMyBayIndex(bays, selectedBrand, seriesParam, placement.razResult?.recommendation?.target, recentKeys),
    [bays, selectedBrand, seriesParam, placement.razResult, recentKeys]
  );

  // The "current" bay is the one occupying the most screen — correct both when a bay is centered
  // (entry) and when it is left-aligned (Prev/Next Level jumps).
  const updateMinimap = useCallback(() => {
    const wall = wallRef.current;
    if (!wall) return;
    const viewLeft = wall.scrollLeft;
    const viewRight = viewLeft + wall.clientWidth;
    let bayIdx = 0;
    let bestVisible = -1;
    for (let i = 0; i < wall.children.length; i += 1) {
      const el = wall.children[i] as HTMLElement;
      const visible = Math.min(el.offsetLeft + el.offsetWidth, viewRight) - Math.max(el.offsetLeft, viewLeft);
      if (visible > bestVisible) {
        bestVisible = visible;
        bayIdx = i;
      }
    }
    setActiveBayIndex(bayIdx);
    const gradeIdx = gradeBlocksRef.current.findIndex((block) => bayIdx >= block.start && bayIdx <= block.end);
    if (gradeIdx >= 0) setActiveGradeIndex(gradeIdx);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(SHELF_THEME_KEY, shelfTheme);
    } catch {
      // Theme choice is a convenience; ignore storage failures (private mode).
    }
  }, [shelfTheme]);

  // The shell's top-bar search sends the learner here as /study?q=... — open the overlay with it.
  const queryParam = searchParams.get("q") || "";
  useEffect(() => {
    if (!queryParam) return;
    setQuery(queryParam);
    setSearchOpen(true);
  }, [queryParam]);

  // 최초 진입/브랜드 전환/딥링크 변경 시 내 칸(bay)을 벽 중앙으로 정렬하고 하이라이트를 내 학년에 둔다.
  useEffect(() => {
    const wall = wallRef.current;
    if (!wall || bays.length === 0) return;
    const myGrade = gradeBlocksRef.current.findIndex((block) => myBayIndex >= block.start && myBayIndex <= block.end);
    setActiveGradeIndex(myGrade >= 0 ? myGrade : 0);
    setActiveBayIndex(myBayIndex);
    const scrollKey = `${selectedBrand?.brandId}:${seriesParam ?? "auto"}:${myBayIndex}`;
    if (scrolledKeyRef.current === scrollKey) return;
    scrolledKeyRef.current = scrollKey;
    const bay = wall.children[myBayIndex] as HTMLElement | undefined;
    if (!bay) return;
    wall.scrollLeft = Math.max(0, bay.offsetLeft - (wall.clientWidth - bay.clientWidth) / 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bays, myBayIndex, selectedBrand?.brandId, seriesParam]);

  if (isLoading) {
    return <EmptyState title="Loading study zone" detail="Fetching MetaOn book catalog." />;
  }

  if (!catalog || brands.length === 0 || !selectedBrand || bays.length === 0) {
    return <EmptyState title="No study content" detail={error || "The current MetaOn catalog has no visible books."} />;
  }

  const searchResults = query.trim()
    ? bays
        .flatMap((bay) => bay.books.map((book) => ({ bay, book })))
        .filter(({ book }) => `${book.bookName} ${book.bookId} ${book.bookIdx}`.toLowerCase().includes(query.trim().toLowerCase()))
        .slice(0, 24)
    : [];

  // Minimap: centre the grade's first level in the wall.
  function jumpToBay(index: number) {
    const wall = wallRef.current;
    const bay = wall?.children[index] as HTMLElement | undefined;
    if (!wall || !bay) return;
    wall.scrollTo({ left: Math.max(0, bay.offsetLeft - (wall.clientWidth - bay.clientWidth) / 2), behavior: "smooth" });
  }

  // Prev/Next Level: align the level's left edge to the wall's left edge, so its first book sits
  // leftmost on screen.
  function jumpToBayLeft(index: number) {
    const wall = wallRef.current;
    const bay = wall?.children[index] as HTMLElement | undefined;
    if (!wall || !bay) return;
    wall.scrollTo({ left: Math.max(0, bay.offsetLeft), behavior: "smooth" });
  }

  const myGradeIndex = gradeBlocks.findIndex((block) => myBayIndex >= block.start && myBayIndex <= block.end);

  const prevBay = activeBayIndex > 0 ? bays[activeBayIndex - 1] : undefined;
  const nextBay = bays[activeBayIndex + 1];

  return (
    <section className="hub-shelf-page" data-shelf-theme={shelfTheme}>
      <header className="hub-shelf-topbar">
        <Link className="hub-shelf-home" to="/" aria-label="홈으로">
          <Home size={20} strokeWidth={2.5} />
        </Link>
        <h1>스터디존</h1>
        <div className="hub-shelf-brand-tabs" role="tablist" aria-label="브랜드">
          {brands.map((item) => (
            <button
              aria-selected={item.brand.brandId === selectedBrand.brandId}
              className={`hub-shelf-brand-tab${item.brand.brandId === selectedBrand.brandId ? " is-active" : ""}`}
              key={item.id}
              role="tab"
              type="button"
              onClick={() => {
                setSearchParams({ brand: String(item.brand.brandId) });
              }}
            >
              <span>{item.name}</span>
              <small>{item.bookCount} Books</small>
            </button>
          ))}
        </div>
        {usingSample ? (
          <p className="hub-warning-copy">
            Sample mode <button type="button" onClick={() => reload({ refresh: true })}>다시 호출</button>
          </p>
        ) : null}
        <div className="hub-shelf-theme">
          <button
            aria-expanded={isThemeOpen}
            aria-label="책장 색 바꾸기"
            className="hub-shelf-theme-button"
            type="button"
            onClick={() => setThemeOpen((open) => !open)}
          >
            <Palette size={20} strokeWidth={2.5} />
          </button>
          {isThemeOpen ? (
            <div className="hub-shelf-theme-menu" role="menu">
              {SHELF_THEMES.map((theme) => (
                <button
                  aria-checked={theme.id === shelfTheme}
                  className={`hub-shelf-theme-option${theme.id === shelfTheme ? " is-active" : ""}`}
                  data-shelf-swatch={theme.id}
                  key={theme.id}
                  role="menuitemradio"
                  type="button"
                  onClick={() => {
                    setShelfTheme(theme.id);
                    setThemeOpen(false);
                  }}
                >
                  <i aria-hidden="true" />
                  {theme.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button
          aria-label="Book 검색"
          className="hub-shelf-search-button"
          type="button"
          onClick={() => setSearchOpen(true)}
        >
          <Search size={20} strokeWidth={2.5} />
        </button>
      </header>

      <div className="hub-shelf-wallwrap">
        <div className="hub-shelf-wall" ref={wallRef} onScroll={updateMinimap} aria-label="레벨 책장 벽">
          {bays.map((bay, bayIndex) => {
            const completedCount = bay.books.filter((book) => bookCompleted(getBookProgress(packageKeyFor(book)))).length;
            const isMine = bayIndex === myBayIndex;
            const rows = splitRows(bay.books);
            return (
              <section className={`hub-shelf-bay${isMine ? " is-mine" : ""}`} key={bay.id} aria-label={`${bay.gradeName} ${bay.levelName}`}>
                <div className="hub-shelf-bay-head">
                  <span className="hub-shelf-sign">{bay.levelName}</span>
                  <span className="hub-shelf-grade">{bay.gradeName}</span>
                  <span className="hub-shelf-stars" title="완독한 Book 수">
                    <img src="/unity-app-ui/book/star.png" alt="" draggable={false} />
                    {completedCount}/{bay.books.length}
                  </span>
                  {bayIndex === activeBayIndex && cartBooks.length > 0 ? (
                    <aside className="hub-shelf-cart" aria-label="이어 읽기">
                      <em>이어 읽기</em>
                      <div>
                        {cartBooks.map((hubBook, cartIndex) => (
                          <button
                            aria-label={`${hubBook.book.bookName} 이어서 열기`}
                            className="hub-shelf-cart-book"
                            key={hubBook.key}
                            type="button"
                            onClick={() => navigate(routeForBook(hubBook.book))}
                          >
                            <SafeCover book={hubBook.book} fallbackIndex={cartIndex} />
                          </button>
                        ))}
                      </div>
                    </aside>
                  ) : null}
                  {isMine ? <span className="hub-shelf-me">{user.avatar} 내 자리</span> : null}
                </div>
                {rows.map((row, rowIndex) => (
                  <div className="hub-shelf-row" key={rowIndex}>
                    {row.map((book, bookIndex) => (
                      <ShelfBookCard
                        book={book}
                        fallbackIndex={bayIndex + rowIndex + bookIndex}
                        isTarget={isBookParamMatch(book, bookParam)}
                        key={book.bookIdx || `${book.seriesGroup}:${book.seriesIdx}:${book.bookId}`}
                        progress={getBookProgress(packageKeyFor(book))}
                      />
                    ))}
                  </div>
                ))}
              </section>
            );
          })}
        </div>

        <div className="hub-shelf-toolstrip">
          {prevBay ? (
            <button
              className="hub-shelf-level-jump"
              type="button"
              onClick={() => jumpToBayLeft(activeBayIndex - 1)}
              title={`${prevBay.gradeName} ${prevBay.levelName}로 이동`}
            >
              <ChevronLeft size={17} strokeWidth={2.8} />
              <span>Prev Level</span>
              <b>{prevBay.levelName}</b>
            </button>
          ) : null}
          {nextBay ? (
            <button
              className="hub-shelf-level-jump"
              type="button"
              onClick={() => jumpToBayLeft(activeBayIndex + 1)}
              title={`${nextBay.gradeName} ${nextBay.levelName}로 이동`}
            >
              <span>Next Level</span>
              <b>{nextBay.levelName}</b>
              <ChevronRight size={17} strokeWidth={2.8} />
            </button>
          ) : null}
        </div>
      </div>

      <nav className="hub-shelf-map" aria-label="학년 미니맵">
        {gradeBlocks.map((block, index) => (
          <button
            className="hub-shelf-map-block"
            key={block.label}
            style={{ "--map-color": GRADE_COLORS[index % GRADE_COLORS.length] } as CSSProperties}
            type="button"
            onClick={() => jumpToBay(block.start)}
          >
            {index === myGradeIndex ? <span className="hub-shelf-map-flag" aria-hidden="true">🚩</span> : null}
            {block.label}
          </button>
        ))}
        <span
          aria-hidden="true"
          className="hub-shelf-map-viewport"
          style={{ "--n": gradeBlocks.length, "--i": activeGradeIndex } as CSSProperties}
        />
      </nav>

      {isSearchOpen ? (
        <div className="hub-shelf-search-overlay" role="dialog" aria-label="Book 검색">
          <div className="hub-shelf-search-panel">
            <div className="hub-shelf-search-head">
              <Search size={20} strokeWidth={2.5} />
              <input
                autoFocus
                placeholder="Book 제목이나 ID를 입력하세요"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <button aria-label="검색 닫기" type="button" onClick={() => { setSearchOpen(false); setQuery(""); }}>
                <X size={20} strokeWidth={2.5} />
              </button>
            </div>
            {query.trim() ? (
              searchResults.length > 0 ? (
                <div className="hub-shelf-search-grid">
                  {searchResults.map(({ bay, book }, index) => (
                    <button
                      className="hub-shelf-search-result"
                      key={book.bookIdx || `${book.seriesGroup}:${book.seriesIdx}:${book.bookId}`}
                      type="button"
                      onClick={() => navigate(routeForBook(book))}
                    >
                      <SafeCover book={book} fallbackIndex={index} />
                      <strong>{book.bookName}</strong>
                      <small>{bay.gradeName} · {bay.levelName}</small>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="hub-shelf-search-empty">"{query}" 검색 결과가 없어요.</p>
              )
            ) : (
              <p className="hub-shelf-search-empty">전체 책장에서 Book을 찾아 드려요.</p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ShelfBookCard({
  book,
  fallbackIndex,
  isTarget,
  progress
}: {
  book: BookData;
  fallbackIndex: number;
  isTarget: boolean;
  progress: HubProgress;
}) {
  const navigate = useNavigate();
  const pct = Math.min(100, percent(progress.completedActivityIds.length, 4));
  const done = pct >= 100;
  return (
    <button
      aria-label={`${book.bookName} 학습 화면 열기`}
      className={`hub-shelf-book${isTarget ? " is-target" : ""}`}
      title={book.bookName}
      type="button"
      onClick={() => navigate(routeForBook(book))}
    >
      <span className="hub-shelf-book-cover">
        <SafeCover book={book} fallbackIndex={fallbackIndex} />
        {done ? (
          <span className="hub-shelf-book-done" aria-hidden="true">
            <img src="/unity-app-ui/book/star.png" alt="" draggable={false} />
          </span>
        ) : pct > 0 ? (
          <span className="hub-shelf-book-ring" aria-hidden="true" style={{ "--pv": `${pct}%` } as CSSProperties}>
            <b>{pct}</b>
          </span>
        ) : null}
      </span>
      <strong>{book.bookName}</strong>
      {book.lexile ? <small>{book.lexile}</small> : <small>{book.bookId}</small>}
    </button>
  );
}

function SafeCover({ book, fallbackIndex }: { book: BookData; fallbackIndex: number }) {
  const fallback = fallbackCoverFor(fallbackIndex);
  const [src, setSrc] = useState(book.thumbnailUrl || fallback);
  useEffect(() => {
    setSrc(book.thumbnailUrl || fallback);
  }, [book.thumbnailUrl, fallback]);
  return (
    <img
      alt=""
      draggable={false}
      loading="lazy"
      src={src}
      onError={() => {
        if (src !== fallback) setSrc(fallback);
      }}
    />
  );
}

export function buildBays(brand?: BrandData): ShelfBay[] {
  return getBrandGroups(brand).flatMap((group) =>
    group.seriesList
      .filter((series) => series.books.length > 0)
      .map((series) => ({
        id: `${group.groupId}:${series.seriesIdx}`,
        group,
        series,
        books: getSeriesBooks(series),
        gradeName: formatGradeName(group.groupName),
        levelName: formatLevelName(series.seriesName)
      }))
  );
}

export function buildGradeBlocks(bays: ShelfBay[]): Array<{ label: string; start: number; end: number }> {
  const blocks: Array<{ label: string; start: number; end: number }> = [];
  bays.forEach((bay, index) => {
    const last = blocks[blocks.length - 1];
    if (last && last.label === bay.gradeName) {
      last.end = index;
    } else {
      blocks.push({ label: bay.gradeName, start: index, end: index });
    }
  });
  return blocks;
}

export function resolveMyBayIndex(
  bays: ShelfBay[],
  brand: BrandData | undefined,
  seriesParam: number | undefined,
  placementTarget: { grade: string; level: string } | undefined,
  recentKeys: string[]
): number {
  if (bays.length === 0) return 0;
  if (seriesParam) {
    const index = bays.findIndex((bay) => bay.series.seriesIdx === seriesParam);
    if (index >= 0) return index;
  }
  const placementSeries = findSeriesForPlacement(brand, placementTarget);
  if (placementSeries) {
    const index = bays.findIndex((bay) => bay.series.seriesIdx === placementSeries.seriesIdx);
    if (index >= 0) return index;
  }
  for (const key of recentKeys) {
    const index = bays.findIndex((bay) => bay.books.some((book) => packageKeyFor(book) === key));
    if (index >= 0) return index;
  }
  return 0;
}

export function splitRows(books: BookData[]): BookData[][] {
  if (books.length <= 6) return [books];
  const half = Math.ceil(books.length / 2);
  return [books.slice(0, half), books.slice(half)];
}

function bookCompleted(progress: HubProgress): boolean {
  return percent(progress.completedActivityIds.length, 4) >= 100;
}

function isBookParamMatch(book: BookData, bookParam: string | null): boolean {
  if (!bookParam) return false;
  return String(book.bookIdx) === bookParam || book.bookId === bookParam;
}

// 최근 열람 우선, 진도 갱신 시각 fallback (HubHomePage와 동일 규칙).
function buildRecentKeys(recentEntries: HubRecentBook[], progress: HubProgress[]): string[] {
  const recentKeys = [...recentEntries].sort((a, b) => (a.openedAt < b.openedAt ? 1 : -1)).map((item) => item.bookKey);
  const progressKeys = [...progress].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).map((item) => item.bookKey);
  return [...recentKeys, ...progressKeys];
}

function formatGradeName(value: string): string {
  return value.replace(/^Raz-Kids\s*/i, "").replace(/\(RHK\)/gi, "").trim() || value;
}

function formatLevelName(value: string): string {
  return value.replace(/^Raz-Kids\s*/i, "").trim() || value;
}

function selectBrand(brands: BrandData[] | undefined, brandId?: number): BrandData | undefined {
  if (!brands?.length) return undefined;
  return (
    brands.find((brand) => brand.brandId === brandId && getBrandGroups(brand).length > 0) ||
    brands.find((brand) => getBrandGroups(brand).length > 0)
  );
}

function brandParam(value: string | null): number | undefined {
  if (value == null || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function numberParam(value: string | null): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
