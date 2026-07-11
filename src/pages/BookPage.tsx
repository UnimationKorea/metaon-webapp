import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { Download, PlayCircle } from "lucide-react";
import { EmptyState } from "../components/EmptyState";
import { ProgressMeter } from "../components/ProgressMeter";
import { useBookPackage } from "../hooks/useBookPackage";
import { useCatalog } from "../hooks/useCatalog";
import { getActivityIconUrl, unityBookAssets } from "../services/unityAppAssets";
import { findBook, findSeries } from "../utils/catalogLookup";
import { requestFullscreen } from "../utils/fullscreen";

export function BookPage() {
  const params = useParams();
  const seriesGroup = Number(params.seriesGroup);
  const seriesIdx = Number(params.seriesIdx);
  const bookId = params.bookId || "";
  const { catalog, isLoading } = useCatalog();
  const book = useMemo(() => findBook(catalog, seriesGroup, seriesIdx, bookId), [bookId, catalog, seriesGroup, seriesIdx]);
  const series = useMemo(() => findSeries(catalog, seriesGroup, seriesIdx), [catalog, seriesGroup, seriesIdx]);
  const packageState = useBookPackage(book);
  const preferredCoverUrl = book?.thumbnailUrl || unityBookAssets.bookStrip;
  const [coverUrl, setCoverUrl] = useState(preferredCoverUrl);

  useEffect(() => {
    setCoverUrl(preferredCoverUrl);
  }, [preferredCoverUrl]);

  if (isLoading) {
    return <EmptyState title="Loading book" detail="Resolving catalog entry." />;
  }

  if (!book) {
    return <EmptyState title="Book not found" detail={`${seriesGroup}/${seriesIdx}/${bookId}`} />;
  }

  const firstDay = packageState.packageMeta?.lessonDays[0];
  const firstActivity = firstDay?.activities[0];
  const bookDetailStyle = {
    "--unity-book-bg": `url("${unityBookAssets.background}")`
  } as CSSProperties;

  return (
    <div className="book-detail-layout unity-book-detail" style={bookDetailStyle}>
      <section className="book-detail-hero">
        <div className="large-cover">
          <img
            src={coverUrl}
            alt=""
            onError={(event) => {
              if (event.currentTarget.src !== new URL(unityBookAssets.bookStrip, window.location.origin).href) {
                setCoverUrl(unityBookAssets.bookStrip);
              }
            }}
          />
          <span>{book.bookId}</span>
        </div>
        <div>
          <p className="activity-kicker">{series?.seriesName}</p>
          <h1>{book.bookName}</h1>
          <p>
            Package source <code>{book.bUrl || "from catalog"}</code>
          </p>
          <div className="detail-actions">
            <button disabled={packageState.isBusy} type="button" onClick={() => void packageState.download(book)}>
              <Download size={18} />
              {packageState.isDownloaded ? "Refresh package" : "Download package"}
            </button>
            <Link
              className={!packageState.isDownloaded || !firstDay || !firstActivity ? "button disabled" : "button"}
              onClick={() => {
                if (packageState.isDownloaded && firstDay && firstActivity) {
                  void requestFullscreen();
                }
              }}
              to={
                packageState.isDownloaded && firstDay && firstActivity
                  ? `/activity/${book.seriesGroup}/${book.seriesIdx}/${book.bookId}/${firstDay.id}/${firstActivity.actNum}`
                  : "#"
              }
            >
              <PlayCircle size={18} />
              Start activity
            </Link>
          </div>
          {packageState.progress.phase !== "idle" ? <ProgressMeter progress={packageState.progress} /> : null}
          {packageState.error ? <p className="error-text">{packageState.error}</p> : null}
        </div>
      </section>

      <section className="book-status-grid">
        <div className="status-card">
          <img className="status-card-icon" src={unityBookAssets.active} alt="" />
          <strong>{packageState.packageMeta?.totalFiles ?? 0}</strong>
          <span>cached files</span>
        </div>
        <div className="status-card">
          <img className="status-card-icon" src={unityBookAssets.star} alt="" />
          <strong>{packageState.packageMeta?.lessonDays.length ?? 0}</strong>
          <span>lesson days</span>
        </div>
      </section>

      <section className="lesson-list">
        <h2>Available activities</h2>
        {(packageState.packageMeta?.lessonDays || []).map((day) => (
          <div className="lesson-row" key={day.id}>
            <strong>{day.title}</strong>
            <div>
              {day.activities.map((activity) => (
                <Link
                  key={`${day.id}:${activity.actNum}`}
                  to={`/activity/${book.seriesGroup}/${book.seriesIdx}/${book.bookId}/${day.id}/${activity.actNum}`}
                >
                  <img className="unity-act-icon" src={getActivityIconUrl(activity.actType)} alt="" />
                  <span>{activity.title}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
