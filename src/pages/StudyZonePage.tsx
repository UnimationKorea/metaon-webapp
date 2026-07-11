import { ChevronRight, Map, MessageCircle, Play } from "lucide-react";
import { useMemo, useState, type CSSProperties } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { useBookPackage } from "../hooks/useBookPackage";
import { useCatalog } from "../hooks/useCatalog";
import { useHubState } from "../hooks/useHubState";
import {
  fallbackCoverFor,
  getBrandGroups,
  getHubBrands,
  getSeriesBooks,
  percent,
  routeForActivity,
  routeForBook
} from "../services/hubCatalog";
import { packageKeyFor } from "../services/packageKeys";
import { requestFullscreen } from "../utils/fullscreen";
import type { BookData, BrandData, SeriesData, SeriesGroup } from "../types/metaonTypes";

export function StudyZonePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { catalog, error, isLoading, reload, totals, usingSample } = useCatalog();
  const { getBookProgress, user } = useHubState();
  const [query, setQuery] = useState("");
  const brands = useMemo(() => getHubBrands(catalog), [catalog]);
  const selectedBrand = selectBrand(catalog?.brands, brandParam(searchParams.get("brand")));
  const brandGroups = getBrandGroups(selectedBrand);
  const selectedGroup = selectGroup(brandGroups, numberParam(searchParams.get("group")));
  const selectedSeries = selectSeries(selectedGroup?.seriesList, numberParam(searchParams.get("series")));
  const books = getSeriesBooks(selectedSeries);
  const selectedBook = selectBook(books, searchParams.get("book"));
  const packageState = useBookPackage(selectedBook);
  const progress = selectedBook ? getBookProgress(packageKeyFor(selectedBook)) : undefined;
  const activityCount = packageState.packageMeta?.lessonDays.reduce((sum, day) => sum + day.activities.length, 0) || 0;
  const progressValue = percent(progress?.completedActivityIds.length || 0, activityCount || Math.max(books.length, 1));
  const levelCompletedActivities = books.reduce(
    (sum, book) => sum + (getBookProgress(packageKeyFor(book))?.completedActivityIds.length || 0),
    0
  );
  const levelEstimatedActivities = Math.max(books.length * 4, levelCompletedActivities);
  const levelProgressValue = percent(levelCompletedActivities, levelEstimatedActivities);
  const firstDay = packageState.packageMeta?.lessonDays[0];
  const firstActivity = firstDay?.activities[0];
  const visibleBooks = query.trim()
    ? books.filter((book) => `${book.bookName} ${book.bookId} ${book.bookIdx}`.toLowerCase().includes(query.trim().toLowerCase()))
    : books;

  if (isLoading) {
    return <EmptyState title="Loading study zone" detail="Fetching MetaOn book catalog." />;
  }

  if (!catalog || brands.length === 0 || !selectedBrand || !selectedGroup || !selectedSeries || !selectedBook) {
    return <EmptyState title="No study content" detail={error || "The current MetaOn catalog has no visible books."} />;
  }

  const nextActivityRoute =
    selectedBook && packageState.isDownloaded && firstDay && firstActivity
      ? routeForActivity(selectedBook, firstDay, firstActivity)
      : "";

  function updateSelection(next: { brand?: BrandData; group?: SeriesGroup; series?: SeriesData; book?: BookData }) {
    const brand = next.brand || selectedBrand;
    const group = next.group || (next.brand ? getBrandGroups(brand)[0] : selectedGroup);
    const series = next.series || (next.brand || next.group ? selectSeries(group?.seriesList) : selectedSeries);
    const book = next.book || (next.brand || next.group || next.series ? selectBook(getSeriesBooks(series), null) : selectedBook);
    if (!brand || !group || !series || !book) return;
    setSearchParams({
      brand: String(brand.brandId),
      group: String(group.groupId),
      series: String(series.seriesIdx),
      book: String(book.bookIdx || book.bookId)
    });
  }

  async function startNextActivity() {
    if (!nextActivityRoute) return;
    await requestFullscreen();
    navigate(nextActivityRoute);
  }

  return (
    <section className="hub-study-page">
      <div className="hub-mission-banner">
        <div className="hub-mission-copy">
          <h1>{user.name}, 오늘도 Raz-Kids를 이어가요</h1>
          <p>{selectedGroup.groupName} / {selectedSeries.seriesName}에서 Book과 Activity를 완료해요.</p>
          {usingSample ? (
            <p className="hub-warning-copy">
              Sample mode: {error} <button type="button" onClick={() => reload({ refresh: true })}>다시 호출</button>
            </p>
          ) : null}
        </div>
      </div>

      <section className="hub-study-layout">
        <div className="hub-study-main">
          <div className="hub-section-heading">
            <div>
              <h1>스터디존</h1>
              <p>
                {selectedBrand.brandName} / {selectedGroup.groupName} / {selectedSeries.seriesName}
              </p>
            </div>
            <button
              className="hub-primary-action"
              disabled={!nextActivityRoute}
              type="button"
              onClick={() => void startNextActivity()}
            >
              <Play size={18} fill="currentColor" strokeWidth={0} />
              이어서 학습
            </button>
          </div>

          <div className="hub-brand-tabs" role="tablist" aria-label="브랜드">
            {brands.map((item) => (
              <button
                aria-selected={item.brand.brandId === selectedBrand.brandId}
                className={`hub-brand-tab${item.brand.brandId === selectedBrand.brandId ? " is-active" : ""}`}
                key={item.id}
                role="tab"
                style={{ "--tab-accent": item.accent } as CSSProperties}
                type="button"
                onClick={() => updateSelection({ brand: item.brand })}
              >
                <span>{item.name}</span>
                <small>{item.bookCount} Books</small>
              </button>
            ))}
          </div>

          <label className="hub-inline-search">
            <span>Book 검색</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Book title or ID" />
          </label>

          <div className="hub-book-grid" aria-label="Book 목록">
            {visibleBooks.map((book, index) => (
              <Link
                aria-label={`${book.bookName} 학습 화면 열기`}
                className="hub-book-card"
                key={`${book.bookIdx || `${book.seriesGroup}:${book.seriesIdx}:${book.bookId}`}`}
                to={routeForBook(book)}
              >
                <HubBookCover book={book} index={index} />
                <span className="hub-book-card-body">
                  <strong>{book.bookName}</strong>
                  <span>{book.bookId}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>

        <aside className="hub-study-side">
          <div className="hub-mission-panel">
            <span className="hub-panel-label">오늘의 진도</span>
            <div className="hub-progress-ring" style={{ "--ring-value": `${levelProgressValue}%` } as CSSProperties}>
              <strong>{levelProgressValue}%</strong>
              <small>Level</small>
            </div>
            <p>{selectedSeries.seriesName}의 Activity 완료 기준 진도입니다.</p>
          </div>

          <Link className="hub-launcher-card rich ai" to="/ai-session">
            <span className="hub-launcher-top">
              <span className="hub-launcher-icon">
                <MessageCircle size={22} strokeWidth={2.3} />
              </span>
              <span>
                <strong>AI Speaking</strong>
                <small>Book context 전달</small>
              </span>
              <ChevronRight size={18} strokeWidth={2.2} />
            </span>
            <span className="hub-preview-frame hub-ai-preview">
              <img src="/metaon-assets/ai-npc-preview.png" alt="" />
              <span className="hub-speech-bubble">오늘 배운 단어로 문장을 만들어 볼까?</span>
            </span>
          </Link>

          <Link className="hub-launcher-card rich meta" to="/metaverse-world">
            <span className="hub-launcher-top">
              <span className="hub-launcher-icon">
                <Map size={22} strokeWidth={2.3} />
              </span>
              <span>
                <strong>메타버스</strong>
                <small>아바타와 미션 context</small>
              </span>
              <ChevronRight size={18} strokeWidth={2.2} />
            </span>
            <span className="hub-preview-frame hub-world-preview">
              <img src="/metaon-assets/metaverse-preview.png" alt="" />
              <span className="hub-world-player">{user.avatar}</span>
            </span>
          </Link>
        </aside>
      </section>
    </section>
  );
}

function HubBookCover({ book, index, large = false }: { book: BookData; index: number; large?: boolean }) {
  const [coverUrl, setCoverUrl] = useState(book.thumbnailUrl || fallbackCoverFor(index));
  return (
    <span className={`hub-book-cover${large ? " large" : ""}`}>
      <img
        src={coverUrl}
        alt=""
        onError={() => {
          setCoverUrl(fallbackCoverFor(index));
        }}
      />
      <span className="hub-cover-level">{book.bookId}</span>
      <span className="hub-cover-title">{book.bookName.split(/\s+/)[0] || "Book"}</span>
    </span>
  );
}

function selectBrand(brands: BrandData[] | undefined, brandId?: number): BrandData | undefined {
  if (!brands?.length) return undefined;
  return brands.find((brand) => brand.brandId === brandId && getBrandGroups(brand).length > 0) || brands.find((brand) => getBrandGroups(brand).length > 0);
}

function selectGroup(groups: SeriesGroup[], groupId?: number): SeriesGroup | undefined {
  return groups.find((group) => group.groupId === groupId) || groups[0];
}

function selectSeries(seriesList: SeriesData[] | undefined, seriesIdx?: number): SeriesData | undefined {
  if (!seriesList?.length) return undefined;
  return seriesList.find((series) => series.seriesIdx === seriesIdx && series.books.length > 0) || seriesList.find((series) => series.books.length > 0);
}

function selectBook(books: BookData[], bookId: string | null): BookData | undefined {
  return books.find((book) => String(book.bookIdx) === bookId || book.bookId === bookId) || books[0];
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
