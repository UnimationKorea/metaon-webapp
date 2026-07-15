import { ArrowLeft, ArrowRight, CheckCircle2, Download, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { ProgressMeter } from "../components/ProgressMeter";
import { useBookPackage } from "../hooks/useBookPackage";
import { useCatalog } from "../hooks/useCatalog";
import { useHubState } from "../hooks/useHubState";
import { fallbackCoverFor, percent, routeForActivity } from "../services/hubCatalog";
import { packageKeyFor } from "../services/packageKeys";
import { findBook, findBookByIdx, findSeries, findSeriesByBookIdx } from "../utils/catalogLookup";
import { requestFullscreen } from "../utils/fullscreen";

const ACTIVITY_CUBE_LAUNCH_MS = 460;

export function HubBookPage() {
  const navigate = useNavigate();
  const params = useParams();
  const bookIdx = Number(params.bookIdx || 0);
  const seriesGroup = Number(params.seriesGroup);
  const seriesIdx = Number(params.seriesIdx);
  const bookId = params.bookId || "";
  const { catalog, isLoading } = useCatalog();
  const { getBookProgress } = useHubState();
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
  const autoDownloadKeyRef = useRef("");
  const launchTimeoutRef = useRef<number>();

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

  if (isLoading) {
    return <EmptyState title="Loading book" detail="Resolving catalog entry." />;
  }

  if (!book) {
    return <EmptyState title="Book not found" detail={bookIdx ? String(bookIdx) : `${seriesGroup}/${seriesIdx}/${bookId}`} />;
  }

  const firstDay = packageState.packageMeta?.lessonDays[0];
  const firstActivity = firstDay?.activities[0];
  const allActivities = packageState.packageMeta?.lessonDays.flatMap((day) => day.activities.map((activity) => ({ activity, day }))) || [];
  const progress = getBookProgress(packageKeyFor(book));
  const progressValue = percent(progress.completedActivityIds.length, allActivities.length);
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
              <div className="hub-activity-flow" aria-label="Activity learning path">
                {allActivities.map(({ activity, day }, index) => {
                  const isComplete = progress.completedActivityIds.includes(activity.id);
                  const activityKey = `${day.id}:${activity.actIdx || activity.actNum}`;
                  const activityRoute = routeForActivity(book, day, activity);
                  return (
                    <div className="hub-activity-flow-step" key={activityKey}>
                      <Link
                        className={`hub-activity-cube${isComplete ? " is-complete" : ""}${launchingActivityKey === activityKey ? " is-launching" : ""}`}
                        to={activityRoute}
                        aria-label={`${activity.title} ${isComplete ? "완료됨" : "미완료"}`}
                        onClick={(event) => handleActivityCubeClick(event, activityRoute, activityKey)}
                      >
                        <span className="hub-activity-cube-status" aria-label={isComplete ? "완료됨" : "미완료"}>
                          <CheckCircle2 size={18} strokeWidth={2.4} />
                          <span>{isComplete ? "완료" : "대기"}</span>
                        </span>
                        <span className="hub-activity-cube-number">{String(index + 1).padStart(2, "0")}</span>
                        <span className="hub-activity-cube-title">{activity.title}</span>
                      </Link>
                      {index < allActivities.length - 1 ? (
                        <span className="hub-activity-flow-arrow" aria-hidden="true">
                          <ArrowRight size={22} strokeWidth={2.8} />
                        </span>
                      ) : null}
                    </div>
                  );
                })}
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
