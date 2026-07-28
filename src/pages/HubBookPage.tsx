import { ArrowLeft, CheckCircle2, Download, Lock, Play } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { ProgressMeter } from "../components/ProgressMeter";
import { useBookPackage } from "../hooks/useBookPackage";
import { useCatalog } from "../hooks/useCatalog";
import { useHubState } from "../hooks/useHubState";
import { MetaOnActivityCode, normalizeActivityCode } from "../services/activityCodes";
import { fallbackCoverFor, percent, routeForActivity } from "../services/hubCatalog";
import { packageKeyFor } from "../services/packageKeys";
import { findBook, findBookByIdx, findSeries, findSeriesByBookIdx } from "../utils/catalogLookup";
import { requestFullscreen } from "../utils/fullscreen";
import type { Activity, LessonDay } from "../types/metaonTypes";

const ACTIVITY_CUBE_LAUNCH_MS = 460;

// Stepping-stone trail geometry. Stones sit on a shallow arc — each row bows away from the camera —
// so order and distance-to-go read spatially. When the viewport cannot fit every stone on one line
// the path wraps into serpentine rows (row 1 left→right, row 2 right→left, …) instead of scrolling
// sideways, so the trail fills the vertical space and the walk never jumps back across the screen.
const TRAIL_SLOT_W = 152;
// Each stone's plaque hangs above it, so rows have to clear it by more than the plaque-to-stone gap
// — otherwise a wrapped row's label reads as belonging to the stone above it instead of its own.
const TRAIL_ROW_H = 244;
const TRAIL_ARC = 46;
const TRAIL_BASE_Y = 214;
const TRAIL_STONE_RX = 62;
const TRAIL_STONE_RY = 27;
const TRAIL_STONE_CY = 150;
const TRAIL_SCENE_PAD = 86;
// Every stone wears its plaque directly above it, so a row change cannot be a straight vertical
// hop — the line would run behind that plaque. Instead the walk turns through a U outside the row,
// which needs a lane of its own on both flanks. Wide enough to clear the 148px plaque.
const TRAIL_TURN_BULGE = 90;
// The waterline ring under each stone (.hub-trail-stone::before): a 136px-wide ellipse centred 26px
// below the stone's own centre. A turn leaves and rejoins the walk at that ring's outer edge, so the
// line reads as stepping off the stone rather than out of the middle of it.
const TRAIL_RING_RX = 68;
const TRAIL_RING_DY = 26;

export interface TrailPoint {
  x: number;
  y: number;
  row: number;
}

export interface TrailLink {
  index: number;
  kind: "straight" | "turn";
  left: number;
  top: number;
  width: number;
  height: number;
  angle: number;
  side: "left" | "right";
}

// A landscape tablet is wide enough to line up a whole day's activities in one row, which strings
// the walk into a thin band across the top and wastes the height below it. Cap the row so the trail
// always wraps once it gets long, whatever the screen can technically fit.
const TRAIL_MAX_COLUMNS = 5;

// How many stones sit on one line: never more than the measured width can hold (so nothing is
// clipped or scrolls) and never more than the cap, then evened out across the rows it needs — nine
// stones read better as 5 + 4 than as 5 + 5 + a stub.
export function computeTrailColumns(availableWidth: number, count: number): number {
  if (count <= 0) return 1;
  const byWidth =
    !Number.isFinite(availableWidth) || availableWidth <= 0
      ? count
      : Math.max(1, Math.floor((availableWidth - TRAIL_TURN_BULGE * 2) / TRAIL_SLOT_W));
  const perRow = Math.min(count, byWidth, TRAIL_MAX_COLUMNS);
  return Math.ceil(count / Math.ceil(count / perRow));
}

// The stones are inset by one turn lane on each flank, so the U-turns have somewhere to go.
export function trailPathWidth(columns: number, count: number): number {
  return Math.max(1, Math.min(columns, Math.max(1, count))) * TRAIL_SLOT_W + TRAIL_TURN_BULGE * 2;
}

export function trailRowCount(count: number, columns: number): number {
  if (count <= 0) return 1;
  return Math.ceil(count / Math.max(1, Math.min(columns, count)));
}

export function buildTrailPoints(count: number, columns: number = count): TrailPoint[] {
  const perRow = Math.max(1, Math.min(columns, count));
  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / perRow);
    const seat = index % perRow;
    // Serpentine: odd rows run right→left, so the last stone of a row sits directly above the first
    // stone of the next one and the walk turns in place rather than jumping back across the screen.
    const lane = row % 2 === 0 ? seat : perRow - 1 - seat;
    return {
      row,
      x: Math.round(TRAIL_TURN_BULGE + lane * TRAIL_SLOT_W + TRAIL_SLOT_W / 2),
      // Bow by lane rather than by seat, so the two stones either side of a turn sit level.
      y: Math.round(TRAIL_BASE_Y + row * TRAIL_ROW_H - TRAIL_ARC * Math.sin((Math.PI * (lane + 0.5)) / perRow))
    };
  });
}

export function buildTrailLinks(points: TrailPoint[]): TrailLink[] {
  const links: TrailLink[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    if (to.row !== from.row) {
      // Row change: a U that leaves the row on the outside flank and comes back on the next line.
      // Even rows run left→right, so they turn at the right edge; odd rows turn at the left. Both
      // ends sit on the outer edge of a stone's waterline ring, level with its centre.
      const side = from.row % 2 === 0 ? "right" : "left";
      const mouth = side === "right" ? from.x + TRAIL_RING_RX : from.x - TRAIL_RING_RX;
      links.push({
        index,
        kind: "turn",
        side,
        left: side === "right" ? mouth : mouth - TRAIL_TURN_BULGE,
        top: from.y + TRAIL_RING_DY,
        width: TRAIL_TURN_BULGE,
        height: Math.max(0, to.y - from.y),
        angle: 0
      });
      continue;
    }
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.hypot(dx, dy);
    if (distance === 0) continue;
    const angle = Math.atan2(dy, dx);
    // Stop at the stone's silhouette. It is an ellipse, so a steeply angled hop has to start closer
    // to the centre than a flat one does.
    const trim =
      (TRAIL_STONE_RX * TRAIL_STONE_RY) /
      Math.hypot(TRAIL_STONE_RY * Math.cos(angle), TRAIL_STONE_RX * Math.sin(angle));
    links.push({
      index,
      kind: "straight",
      side: dx < 0 ? "left" : "right",
      left: from.x + Math.cos(angle) * trim,
      top: from.y + Math.sin(angle) * trim,
      width: Math.max(0, distance - trim * 2),
      height: 0,
      angle: (angle * 180) / Math.PI
    });
  }
  return links;
}

// NPC Quick Check activities depend on a cached script.json that is only prepared for some books.
// Hide the ones whose resource is missing so the Activity list still renders instead of erroring.
const NPC_ACTIVITY_FOLDERS: Record<string, string> = {
  [MetaOnActivityCode.NpcQuickCheck]: "npcqhk",
  [MetaOnActivityCode.LegacyNpcQuickCheck]: "npcqhk",
  [MetaOnActivityCode.NpcQuickCheck2]: "npcqhk2"
};

export function isActivityResourceReady(activity: Activity, day: LessonDay, npcScriptPaths?: string[]): boolean {
  const folder = NPC_ACTIVITY_FOLDERS[normalizeActivityCode(activity.activityCode)];
  if (!folder) return true; // non-NPC activities are always listed
  if (!npcScriptPaths) return true; // legacy cache without tracking — every resource had downloaded
  const scriptPath = `Lessons/L${day.lesson}/D${day.day}/${folder}/script.json`.toLowerCase();
  return npcScriptPaths.some((path) => path.toLowerCase() === scriptPath);
}

export function HubBookPage() {
  const navigate = useNavigate();
  const params = useParams();
  const bookIdx = Number(params.bookIdx || 0);
  const seriesGroup = Number(params.seriesGroup);
  const seriesIdx = Number(params.seriesIdx);
  const bookId = params.bookId || "";
  const { catalog, isLoading } = useCatalog();
  const { getBookProgress, recordRecentBook, user } = useHubState();
  const book = useMemo(
    () => (bookIdx ? findBookByIdx(catalog, bookIdx) : findBook(catalog, seriesGroup, seriesIdx, bookId)),
    [bookId, bookIdx, catalog, seriesGroup, seriesIdx]
  );
  const series = useMemo(
    () => (bookIdx ? findSeriesByBookIdx(catalog, bookIdx) : findSeries(catalog, seriesGroup, seriesIdx)),
    [bookIdx, catalog, seriesGroup, seriesIdx]
  );
  const packageState = useBookPackage(book);
  const [coverUrl, setCoverUrl] = useState(book?.thumbnailUrl || fallbackCoverFor(0));
  const [launchingActivityKey, setLaunchingActivityKey] = useState("");
  const [trailWidth, setTrailWidth] = useState(0);
  const autoDownloadKeyRef = useRef("");
  const launchTimeoutRef = useRef<number>();
  const trailObserverRef = useRef<ResizeObserver>();

  // The trail mounts only once the package is downloaded, so measure it through a callback ref
  // rather than an effect: this fires on mount and on every resize, and the stones re-wrap to fit.
  const attachTrail = useCallback((node: HTMLDivElement | null) => {
    trailObserverRef.current?.disconnect();
    trailObserverRef.current = undefined;
    if (!node) return;
    setTrailWidth(node.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setTrailWidth(node.clientWidth));
    observer.observe(node);
    trailObserverRef.current = observer;
  }, []);

  useEffect(() => () => trailObserverRef.current?.disconnect(), []);

  useEffect(() => {
    setCoverUrl(book?.thumbnailUrl || fallbackCoverFor(0));
  }, [book?.thumbnailUrl]);

  useEffect(() => {
    return () => {
      if (launchTimeoutRef.current) {
        window.clearTimeout(launchTimeoutRef.current);
      }
    };
  }, []);

  const packageKey = book ? packageKeyFor(book) : "";

  useEffect(() => {
    if (!book || !packageKey) return;
    if (packageState.isCheckingCache || packageState.isDownloaded || packageState.isBusy || packageState.error) return;
    if (autoDownloadKeyRef.current === packageKey) return;

    autoDownloadKeyRef.current = packageKey;
    void packageState.download(book);
  }, [
    book,
    packageKey,
    packageState.download,
    packageState.error,
    packageState.isBusy,
    packageState.isCheckingCache,
    packageState.isDownloaded
  ]);

  useEffect(() => {
    if (packageKey) recordRecentBook(packageKey);
  }, [packageKey, recordRecentBook]);

  if (isLoading) {
    return <EmptyState title="Loading book" detail="Resolving catalog entry." />;
  }

  if (!book) {
    return <EmptyState title="Book not found" detail={bookIdx ? String(bookIdx) : `${seriesGroup}/${seriesIdx}/${bookId}`} />;
  }

  const firstDay = packageState.packageMeta?.lessonDays[0];
  const firstActivity = firstDay?.activities[0];
  const npcScriptPaths = packageState.packageMeta?.npcScriptPaths;
  const allActivities =
    packageState.packageMeta?.lessonDays.flatMap((day) =>
      day.activities
        .filter((activity) => isActivityResourceReady(activity, day, npcScriptPaths))
        .map((activity) => ({ activity, day }))
    ) || [];
  const progress = getBookProgress(packageKeyFor(book));
  const progressValue = percent(progress.completedActivityIds.length, allActivities.length);
  // Activities are done sequentially: the first not-yet-completed cube is the current one, and
  // every cube after it is locked. -1 means all cubes are complete (nothing locked).
  const currentActivityFlowIndex = allActivities.findIndex(
    ({ activity }) => !progress.completedActivityIds.includes(activity.id)
  );
  const trailColumns = computeTrailColumns(trailWidth, allActivities.length);
  const trailPoints = buildTrailPoints(allActivities.length, trailColumns);
  const trailLinks = buildTrailLinks(trailPoints);
  const trailHeight = TRAIL_BASE_Y + (trailRowCount(allActivities.length, trailColumns) - 1) * TRAIL_ROW_H + TRAIL_SCENE_PAD;
  const startRoute = firstDay && firstActivity ? routeForActivity(book, firstDay, firstActivity) : "";
  const isResourceLoading = !packageState.isDownloaded && !packageState.error;
  const visibleResourceProgress = packageState.progress.phase === "idle"
    ? { phase: "downloading" as const, ratio: 0 }
    : packageState.progress;
  const resourceProgressLabel = packageState.isCheckingCache ? "저장된 Book 리소스 확인 중" : undefined;

  async function startActivity() {
    if (!startRoute || !packageState.isDownloaded) return;
    await requestFullscreen();
    navigate(startRoute);
  }

  function handleActivityCubeClick(event: MouseEvent<HTMLAnchorElement>, route: string, activityKey: string) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    event.preventDefault();

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      navigate(route);
      return;
    }

    if (launchTimeoutRef.current) {
      window.clearTimeout(launchTimeoutRef.current);
    }

    setLaunchingActivityKey(activityKey);
    launchTimeoutRef.current = window.setTimeout(() => {
      navigate(route);
    }, ACTIVITY_CUBE_LAUNCH_MS);
  }

  return (
    <section className="hub-book-page">
      <Link className="hub-back-link" to="/study">
        <ArrowLeft size={17} />
        스터디존으로
      </Link>

      <div className="hub-book-hero is-compact">
        <span className="hub-book-cover hero">
          <img
            src={coverUrl}
            alt=""
            onError={() => {
              setCoverUrl(fallbackCoverFor(0));
            }}
          />
          <span className="hub-cover-level">{book.bookId}</span>
          <span className="hub-cover-title">{book.bookName.split(/\s+/)[0] || "Book"}</span>
        </span>

        <div className="hub-book-hero-copy">
          <span className="hub-detail-label">{series?.seriesName || "MetaOn Book"}</span>
          <h1>{book.bookName}</h1>
          <p>{book.bookId} · {book.bookIdx ? `book_idx ${book.bookIdx}` : book.bUrl || "catalog source"}</p>
          <div className="hub-book-hero-inline">
            <div className="hub-progress-summary compact">
              <strong>{progressValue}%</strong>
              <span>{progress.completedActivityIds.length}/{allActivities.length || 0} 완료</span>
            </div>
            {packageState.isDownloaded ? (
              <div className="hub-book-mini-stats" aria-label="Book resource summary">
                <span><strong>{packageState.packageMeta?.totalFiles ?? 0}</strong> files</span>
                <span><strong>{packageState.packageMeta?.lessonDays.length ?? 0}</strong> days</span>
                <span><strong>{allActivities.length}</strong> acts</span>
              </div>
            ) : null}
            <div className="hub-button-row compact">
              <button
                className="hub-primary-action"
                disabled={!packageState.isDownloaded || !startRoute}
                type="button"
                onClick={() => void startActivity()}
              >
                <Play size={18} fill="currentColor" strokeWidth={0} />
                Start
              </button>
            </div>
          </div>
          {packageState.isDownloaded ? <p className="hub-resource-status-copy">리소스 준비가 완료되었습니다.</p> : null}
          {packageState.error ? (
            <p className="hub-error-copy">리소스를 다운로드하지 못했습니다. 페이지를 새로고침해 다시 시도해 주세요.</p>
          ) : null}
        </div>
      </div>

      <section className={`hub-book-activity-panel${isResourceLoading ? " is-resource-loading" : ""}`}>
        {isResourceLoading ? (
          <div className="hub-resource-download-panel">
            <span className="hub-resource-download-symbol" aria-hidden="true">
              <Download size={28} strokeWidth={2.4} />
            </span>
            <ProgressMeter label={resourceProgressLabel} progress={visibleResourceProgress} />
          </div>
        ) : (
          <>
            <div className="hub-section-heading">
              <div>
                <h2>Activity 목록</h2>
              </div>
            </div>
            {packageState.isDownloaded && allActivities.length > 0 ? (
              <div className="hub-trail" aria-label="Activity 학습 길" ref={attachTrail} style={{ "--trail-h": `${trailHeight}px` } as CSSProperties}>
                <span className="hub-trail-floor" aria-hidden="true" />
                <div className="hub-trail-path" style={{ width: `${trailPathWidth(trailColumns, allActivities.length)}px` }}>
                  {trailLinks.map((link) => {
                    const dimmed = currentActivityFlowIndex !== -1 && link.index >= currentActivityFlowIndex;
                    return link.kind === "turn" ? (
                      <span
                        aria-hidden="true"
                        className={`hub-trail-turn is-${link.side}${dimmed ? " is-dimmed" : ""}`}
                        key={`link:${link.index}`}
                        style={{
                          "--i": link.index,
                          left: `${link.left.toFixed(1)}px`,
                          top: `${link.top.toFixed(1)}px`,
                          width: `${link.width.toFixed(1)}px`,
                          height: `${link.height.toFixed(1)}px`
                        } as CSSProperties}
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className={`hub-trail-link${dimmed ? " is-dimmed" : ""}`}
                        key={`link:${link.index}`}
                        style={{
                          "--i": link.index,
                          "--link-angle": `${link.angle.toFixed(2)}deg`,
                          left: `${link.left.toFixed(1)}px`,
                          top: `${link.top.toFixed(1)}px`,
                          width: `${link.width.toFixed(1)}px`
                        } as CSSProperties}
                      />
                    );
                  })}
                  {allActivities.map(({ activity, day }, index) => {
                    const isComplete = progress.completedActivityIds.includes(activity.id);
                    const isCurrent = index === currentActivityFlowIndex;
                    const isLocked = currentActivityFlowIndex !== -1 && index > currentActivityFlowIndex;
                    const activityKey = `${day.id}:${activity.actIdx || activity.actNum}`;
                    const activityRoute = routeForActivity(book, day, activity);
                    const stateClass = isLocked ? " is-locked" : isCurrent ? " is-current" : isComplete ? " is-complete" : "";
                    const statusLabel = isLocked ? "잠김" : isCurrent ? "지금 학습" : isComplete ? "완료" : "대기";
                    const point = trailPoints[index];
                    const slotStyle = {
                      "--i": index,
                      left: `${point.x - TRAIL_SLOT_W / 2}px`,
                      top: `${point.y - TRAIL_STONE_CY}px`
                    } as CSSProperties;
                    const stoneInner = (
                      <>
                        <span className="hub-trail-glow" aria-hidden="true" />
                        <span className="hub-trail-stone" aria-hidden="true">
                          <u />
                          <i />
                        </span>
                        {isComplete ? (
                          <span className="hub-trail-flag" aria-hidden="true">
                            <img src="/unity-app-ui/book/star.png" alt="" draggable={false} />
                          </span>
                        ) : null}
                        {isCurrent ? (
                          <span className="hub-trail-token" aria-hidden="true">
                            {user.avatar}
                          </span>
                        ) : null}
                        {isLocked ? (
                          <span className="hub-trail-lock" aria-hidden="true">
                            <Lock size={17} strokeWidth={2.6} />
                          </span>
                        ) : null}
                        <span className="hub-trail-plaque">
                          <b>{String(index + 1).padStart(2, "0")}</b>
                          <em>{activity.title}</em>
                          <span className="hub-trail-pill">
                            {isCurrent ? <Play size={11} fill="currentColor" strokeWidth={0} /> : null}
                            {isComplete ? <CheckCircle2 size={12} strokeWidth={3} /> : null}
                            {statusLabel}
                          </span>
                        </span>
                      </>
                    );
                    return isLocked ? (
                      <div
                        aria-disabled="true"
                        aria-label={`${activity.title} 잠김 — 이전 학습을 먼저 완료하세요`}
                        className={`hub-trail-slot${stateClass}`}
                        key={activityKey}
                        style={slotStyle}
                      >
                        {stoneInner}
                      </div>
                    ) : (
                      <Link
                        aria-current={isCurrent ? "step" : undefined}
                        aria-label={`${activity.title} ${statusLabel}`}
                        className={`hub-trail-slot${stateClass}${launchingActivityKey === activityKey ? " is-launching" : ""}`}
                        key={activityKey}
                        style={slotStyle}
                        to={activityRoute}
                        onClick={(event) => handleActivityCubeClick(event, activityRoute, activityKey)}
                      >
                        {stoneInner}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="hub-empty-inline">
                {packageState.error ? <Download size={24} strokeWidth={2.4} /> : <Play size={24} fill="currentColor" strokeWidth={0} />}
                <strong>{packageState.error ? "리소스를 준비하지 못했습니다" : "등록된 Activity가 없습니다"}</strong>
                <span>{packageState.error ? "페이지를 새로고침해 다시 시도해 주세요." : "이 Book에는 실행 가능한 Activity가 없습니다."}</span>
              </div>
            )}
          </>
        )}
      </section>
    </section>
  );
}
