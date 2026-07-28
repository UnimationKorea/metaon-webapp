import { ArrowRight, BookOpen, GraduationCap, History, LogIn, Map as MapIcon, MessageCircle, PlayCircle, Sparkles } from "lucide-react";
import { type CSSProperties, type MouseEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { HomeDepthScene, HomeMotionRoot } from "../components/HomeMotion";
import { HomeLoadingScreen } from "../components/HomeLoadingScreen";
import { useAuth } from "../hooks/useAuth";
import { useCatalog } from "../hooks/useCatalog";
import { useHubState, type HubProgress, type HubRecentBook } from "../hooks/useHubState";
import { fallbackCoverFor, getHubBooks, getRecentBooks, getRecommendedBooks, percent, routeForBook } from "../services/hubCatalog";
import type { BookData } from "../types/metaonTypes";
import { resolveHomeHeroTheme } from "../services/heroThemes";

// Delay between a book-tile tap and navigation, so the jelly-press squash is felt on touch.
const TILE_PRESS_NAV_MS = 190;

export function HubHomePage() {
  const { catalog, error, isLoading, usingSample } = useCatalog();
  const { isAccountAuthenticated, isAuthenticated } = useAuth();
  const { getBookProgress, placement, progress, recentBooks: recentEntries, user } = useHubState();
  const books = getHubBooks(catalog);
  const selected = books[0];
  const selectedBook = selected?.book;
  const selectedProgress = selected ? getBookProgress(selected.key) : undefined;
  const progressValue = selectedBook ? percent(selectedProgress?.completedActivityIds.length || 0, 4) : 0;

  const placementDone = placement.status === "completed";
  const recommendedBooks = useMemo(
    () => (isAuthenticated && placementDone ? getRecommendedBooks(catalog, placement.razResult?.recommendation?.target, 7) : []),
    [catalog, isAuthenticated, placementDone, placement.razResult]
  );
  const recentBooks = useMemo(
    () => (isAuthenticated ? getRecentBooks(catalog, buildRecentKeys(recentEntries, progress), 8) : []),
    [catalog, isAuthenticated, recentEntries, progress]
  );
  const recentMetaByKey = useMemo(() => buildRecentMeta(recentEntries, progress), [recentEntries, progress]);
  const placementCtaRoute = !isAuthenticated ? "/login" : placement.status === "in-progress" ? "/placement/test" : "/placement/intro";
  const placementLevel = placement.razResult?.recommendation?.target?.level;
  // Star counter: one star per completed activity — real, verifiable local data.
  const totalStars = useMemo(
    () => progress.reduce((sum, item) => sum + item.completedActivityIds.length, 0),
    [progress]
  );

  // One-shot celebration for a book finished within the last 24h. The sessionStorage guard is
  // written inside the effect (not useMemo) so React 18 StrictMode's double-invocation cannot
  // swallow the celebration: the second run early-returns while the first run's state stands.
  const [celebrateKey, setCelebrateKey] = useState<string>();
  useEffect(() => {
    if (!isAuthenticated) return;
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const hit = [...progress]
      .filter((item) => item.completedActivityIds.length >= 4 && new Date(item.updatedAt).getTime() > dayAgo)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0];
    if (!hit) return;
    try {
      const guardKey = `metaon.hub.celebrated.${hit.bookKey}`;
      if (window.sessionStorage.getItem(guardKey)) return;
      window.sessionStorage.setItem(guardKey, "1");
    } catch {
      // Storage may be unavailable (private mode); celebrating again is harmless.
    }
    setCelebrateKey(hit.bookKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [heroTheme] = useState(resolveHomeHeroTheme);
  const heroThemeStyle = {
    "--hub-home-hero-bg": `url("${heroTheme.image}")`,
    "--hub-home-hero-position": heroTheme.position
  } as CSSProperties;

  if (isLoading) {
    return <HomeLoadingScreen backgroundImage={heroTheme.image} backgroundPosition={heroTheme.position} themeId={heroTheme.id} />;
  }

  if (!selectedBook) {
    const nextRoute = isAuthenticated ? "/study" : isAccountAuthenticated ? "/profiles" : "/login";
    const actionLabel = isAuthenticated ? "스터디존 다시 열기" : isAccountAuthenticated ? "프로필 선택" : "로그인";
    const title = isAuthenticated ? "Book catalog을 불러오지 못했습니다" : "프로필을 선택해 학습을 시작하세요";
    const detail = isAuthenticated
      ? error || "선택한 프로필의 Book 정보를 다시 불러와 주세요."
      : "브랜드와 Book은 로그인 후 학습 프로필을 선택한 경우에만 표시됩니다.";
    return (
      <HomeMotionRoot themeId={heroTheme.id}>
        <section className="hub-home-feature-stage hub-home-myzone-stage" data-hero-theme={heroTheme.id} style={heroThemeStyle}>
          <HomeDepthScene themeId={heroTheme.id} />
          <header className="hub-myzone-header">
            <div className="hub-myzone-greeting">
              <span className="hub-myzone-eyebrow"><span>MY ZONE</span></span>
              <h1>{title}</h1>
              <p>{detail}</p>
            </div>
            <Link className="hub-primary-action" to={nextRoute}>
              {isAuthenticated ? <BookOpen size={18} strokeWidth={2.3} /> : <LogIn size={18} strokeWidth={2.3} />}
              {actionLabel}
            </Link>
          </header>
        </section>
      </HomeMotionRoot>
    );
  }

  return (
    <HomeMotionRoot themeId={heroTheme.id}>
      <section className="hub-home-feature-stage hub-home-myzone-stage" aria-label="마이존" data-hero-theme={heroTheme.id} style={heroThemeStyle}>
        <HomeDepthScene themeId={heroTheme.id} />

        <header className="hub-myzone-header">
          <div className="hub-myzone-greeting">
            <span className="hub-myzone-eyebrow">
              <span>MY ZONE</span>
              {isAuthenticated && totalStars > 0 ? (
                <span className="hub-myzone-star-chip" aria-label={`완료한 Activity ${totalStars}개`}>
                  <img src="/unity-app-ui/book/star.png" alt="" draggable={false} />
                  별 {totalStars}개
                </span>
              ) : null}
            </span>
            <h1>{isAuthenticated ? `${user.name}님의 마이존` : "오늘의 마이존"}</h1>
            <p>배치고사 맞춤 추천 Book과 최근 학습을 한 곳에서 이어가세요.</p>
            {usingSample ? (
              <p className="hub-warning-copy">지금은 예시 화면이에요. 다시 로그인하면 내 책과 학습 기록이 표시됩니다.</p>
            ) : null}
          </div>
          <Link className="hub-primary-action" to="/study">
            <BookOpen size={18} strokeWidth={2.3} />
            스터디존으로 이동
          </Link>
        </header>

        <section className="hub-myzone-row-block hub-myzone-row-block--recommended" aria-label="추천 Book">
          <div className="hub-myzone-row-head">
            <span className="hub-myzone-row-title">
              <Sparkles size={18} strokeWidth={2.4} />
              추천 Book
              {recommendedBooks.length > 0 ? <em className="hub-myzone-count">{recommendedBooks.length}권</em> : null}
            </span>
            {placementDone ? (
              <Link className="hub-myzone-row-more" to="/placement/result">
                배치 결과
                <ArrowRight size={15} strokeWidth={2.5} />
              </Link>
            ) : null}
          </div>
          {recommendedBooks.length > 0 ? (
            <div className="hub-myzone-row">
              {recommendedBooks.map((hubBook, index) => (
                <MyZoneBookTile
                  key={hubBook.key}
                  book={hubBook.book}
                  enterIndex={index}
                  fallbackIndex={index}
                  ribbon={index === 0 && placementLevel ? `Lv.${placementLevel} 맞춤` : undefined}
                  meta={<small>{hubBook.series.seriesName}{hubBook.book.lexile ? ` · ${hubBook.book.lexile}` : ""}</small>}
                />
              ))}
            </div>
          ) : (
            <Link className="hub-myzone-cta" to={placementCtaRoute}>
              <span className="hub-myzone-cta-icon">
                {isAuthenticated ? <GraduationCap size={24} strokeWidth={2.3} /> : <LogIn size={24} strokeWidth={2.3} />}
              </span>
              <span className="hub-myzone-cta-copy">
                <strong>{isAuthenticated ? "배치고사로 맞춤 추천 받기" : "로그인하고 맞춤 추천 받기"}</strong>
                <small>
                  {isAuthenticated
                    ? "짧은 진단 후 내 레벨에 맞는 Book 7권을 추천해요."
                    : "로그인하면 배치고사 결과로 추천 Book이 표시됩니다."}
                </small>
              </span>
              <span className="hub-myzone-cta-go">
                {isAuthenticated ? (placement.status === "in-progress" ? "이어서 진단" : "배치고사 시작") : "로그인"}
                <ArrowRight size={17} strokeWidth={2.4} />
              </span>
            </Link>
          )}
        </section>

        <section className="hub-myzone-row-block" aria-label="Recent 학습">
          <div className="hub-myzone-row-head">
            <span className="hub-myzone-row-title">
              <History size={18} strokeWidth={2.4} />
              Recent 학습
            </span>
          </div>
          {recentBooks.length > 0 ? (
            <div className="hub-myzone-row">
              {recentBooks.map((hubBook, index) => {
                const meta = recentMetaByKey.get(hubBook.key);
                const pct = Math.min(100, percent(meta?.completed || 0, 4));
                const studiedToday = meta?.at ? isSameLocalDay(meta.at) : false;
                const tile = (
                  <MyZoneBookTile
                    key={hubBook.key}
                    book={hubBook.book}
                    complete={pct >= 100}
                    enterIndex={index}
                    fallbackIndex={index + 1}
                    meta={
                      <>
                        <span className="hub-myzone-book-meter" aria-hidden="true">
                          <span className={pct >= 100 ? "is-full" : undefined} style={{ width: `${pct}%` }} />
                        </span>
                        <small>
                          {pct >= 100 ? "완료" : `${pct}%`}
                          {meta?.at ? ` · ${relativeTimeKo(meta.at)}` : ""}
                          {studiedToday ? <em className="hub-myzone-today-tag">오늘</em> : null}
                        </small>
                      </>
                    }
                  />
                );
                if (celebrateKey !== hubBook.key) return tile;
                // Freshly finished book: wrap the tile so the one-shot star burst can overflow
                // the tile's own overflow:hidden rounding.
                return (
                  <span className="hub-myzone-tile-cell" key={hubBook.key}>
                    {tile}
                    <span className="hub-myzone-tile-burst" aria-hidden="true">
                      {Array.from({ length: 8 }).map((_, burstIndex) => (
                        <img
                          key={burstIndex}
                          src="/unity-app-ui/book/star.png"
                          alt=""
                          draggable={false}
                          style={{ "--burst-i": burstIndex } as CSSProperties}
                        />
                      ))}
                    </span>
                  </span>
                );
              })}
            </div>
          ) : (
            <Link className="hub-myzone-empty" to={isAuthenticated ? "/study" : "/login"}>
              <span className="hub-myzone-empty-icon">
                <PlayCircle size={24} strokeWidth={2.3} />
              </span>
              <span className="hub-myzone-empty-copy">
                <strong>{isAuthenticated ? "아직 학습한 Book이 없어요" : "로그인 후 최근 학습이 표시됩니다"}</strong>
                <small>
                  {isAuthenticated
                    ? "스터디존에서 첫 Book을 시작해 보세요."
                    : "학습을 시작하면 여기에서 이어서 볼 수 있습니다."}
                </small>
              </span>
              <span className="hub-myzone-cta-go">
                {isAuthenticated ? "스터디존" : "로그인"}
                <ArrowRight size={17} strokeWidth={2.4} />
              </span>
            </Link>
          )}
        </section>
      </section>

      <Link className="hub-home-menu-card study" data-home-tilt="portal" to="/study">
        <span className="hub-menu-art">
          <SafeCoverImage fallbackIndex={1} src={selectedBook.thumbnailUrl} />
          <PortalGate />
        </span>
        <span className="hub-menu-copy">
          <span className="hub-menu-badge">
            <BookOpen size={15} strokeWidth={2.4} />
            {progressValue}% 진행
          </span>
          <strong>스터디존</strong>
          <span>Book과 Activity를 완료하며 오늘의 영어 보물을 모아요.</span>
          <span className="hub-menu-progress" aria-hidden="true">
            <span style={{ width: `${progressValue}%` }}></span>
          </span>
        </span>
        <span className="hub-menu-action">입장하기</span>
      </Link>

      <Link className="hub-home-menu-card ai" data-home-tilt="portal" to="/ai-session">
        <span className="hub-menu-art">
          <img src="/metaon-assets/ai-npc-preview.png" alt="" />
          <PortalGate />
        </span>
        <span className="hub-menu-copy">
          <span className="hub-menu-badge">
            <MessageCircle size={15} strokeWidth={2.4} />
            NPC 미션
          </span>
          <strong>AI Speaking</strong>
          <span>{user.name}의 Book context를 넘겨 캐릭터와 대화해요.</span>
        </span>
        <span className="hub-menu-action">대화 시작</span>
      </Link>

      <Link className="hub-home-menu-card meta" data-home-tilt="portal" to="/metaverse-world">
        <span className="hub-menu-art">
          <img src="/metaon-assets/metaverse-preview.png" alt="" />
          <PortalGate />
        </span>
        <span className="hub-menu-copy">
          <span className="hub-menu-badge">
            <MapIcon size={15} strokeWidth={2.4} />
            월드 탐험
          </span>
          <strong>메타버스</strong>
          <span>아바타와 미션 context를 들고 영어 월드로 연결해요.</span>
        </span>
        <span className="hub-menu-action">월드 열기</span>
      </Link>
    </HomeMotionRoot>
  );
}

function MyZoneBookTile({
  book,
  complete,
  enterIndex,
  fallbackIndex,
  meta,
  ribbon
}: {
  book: BookData;
  complete?: boolean;
  enterIndex: number;
  fallbackIndex: number;
  meta: ReactNode;
  ribbon?: string;
}) {
  const navigate = useNavigate();
  const [pressing, setPressing] = useState(false);
  const navTimerRef = useRef<number>();
  const to = routeForBook(book);

  useEffect(
    () => () => {
      if (navTimerRef.current) window.clearTimeout(navTimerRef.current);
    },
    []
  );

  // On touch, a plain Link navigates before the :active squash is felt. Hold the pressed state
  // briefly, then navigate — mirroring the activity-cube launch pattern. Skipped for keyboard/
  // modified clicks and when the user prefers reduced motion (then the Link navigates normally).
  function handleTilePress(event: MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    if (navTimerRef.current) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    event.preventDefault();
    setPressing(true);
    navTimerRef.current = window.setTimeout(() => navigate(to), TILE_PRESS_NAV_MS);
  }

  // --tile-i drives the staggered entrance / meter-fill / star-pop delays in CSS.
  const tileStyle = { "--tile-i": enterIndex } as CSSProperties;
  return (
    <Link
      className={`hub-myzone-book${pressing ? " is-pressing" : ""}`}
      to={to}
      title={book.bookName}
      style={tileStyle}
      onClick={handleTilePress}
    >
      <span className="hub-myzone-book-cover">
        <SafeCoverImage fallbackIndex={fallbackIndex} src={book.thumbnailUrl} />
        {ribbon ? <span className="hub-myzone-book-ribbon">{ribbon}</span> : null}
        {complete ? (
          <span className="hub-myzone-book-star" aria-hidden="true">
            <img src="/unity-app-ui/book/star.png" alt="" draggable={false} />
          </span>
        ) : null}
      </span>
      <span className="hub-myzone-book-info">
        <strong>{book.bookName}</strong>
        {meta}
      </span>
    </Link>
  );
}

// Recent list ordering: recent-opens (openedAt desc) first, then progress (updatedAt desc) as a
// fallback for learners who studied before open-tracking existed. getRecentBooks de-dupes.
function buildRecentKeys(recentEntries: HubRecentBook[], progress: HubProgress[]): string[] {
  const recentKeys = [...recentEntries].sort((a, b) => (a.openedAt < b.openedAt ? 1 : -1)).map((item) => item.bookKey);
  const progressKeys = [...progress].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).map((item) => item.bookKey);
  return [...recentKeys, ...progressKeys];
}

function buildRecentMeta(recentEntries: HubRecentBook[], progress: HubProgress[]): Map<string, { at: string; completed: number }> {
  const map = new Map<string, { at: string; completed: number }>();
  for (const item of progress) {
    map.set(item.bookKey, { at: item.updatedAt, completed: item.completedActivityIds.length });
  }
  for (const item of recentEntries) {
    const existing = map.get(item.bookKey);
    const at = existing && existing.at > item.openedAt ? existing.at : item.openedAt;
    map.set(item.bookKey, { at, completed: existing?.completed || 0 });
  }
  return map;
}

function isSameLocalDay(iso: string): boolean {
  const then = new Date(iso);
  const now = new Date();
  return (
    then.getFullYear() === now.getFullYear() &&
    then.getMonth() === now.getMonth() &&
    then.getDate() === now.getDate()
  );
}

function relativeTimeKo(iso?: string): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diffMs = Date.now() - then;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diffMs < minute) return "방금";
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}분 전`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}시간 전`;
  const days = Math.floor(diffMs / day);
  if (days === 1) return "어제";
  if (days < 7) return `${days}일 전`;
  if (days < 30) return `${Math.floor(days / 7)}주 전`;
  return `${Math.floor(days / 30)}개월 전`;
}

function SafeCoverImage({ fallbackIndex, src }: { fallbackIndex: number; src?: string }) {
  const fallback = fallbackCoverFor(fallbackIndex);
  const [imageUrl, setImageUrl] = useState(src || fallback);

  useEffect(() => {
    setImageUrl(src || fallback);
  }, [fallback, src]);

  return (
    <img
      src={imageUrl}
      alt=""
      onError={() => {
        if (imageUrl !== fallback) setImageUrl(fallback);
      }}
    />
  );
}

function PortalGate() {
  return (
    <span className="hub-menu-portal-gate" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}
