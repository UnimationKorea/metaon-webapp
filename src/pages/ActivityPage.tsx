import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { endStudy, startStudy } from "../api/uniplanetApi";
import { activityControlAssets, VideoActivityCheckControl } from "../components/ActivityImageControls";
import { ActivityCompletionCelebration } from "../components/ActivityCompletionCelebration";
import { ActivityTopBar } from "../components/ActivityTopBar";
import { EmptyState } from "../components/EmptyState";
import { useBookPackage } from "../hooks/useBookPackage";
import { useCatalog } from "../hooks/useCatalog";
import { useHubState } from "../hooks/useHubState";
import { getActivityBackgroundUrl } from "../services/activityBackgrounds";
import { MetaOnActivityCode, normalizeActivityCode } from "../services/activityCodes";
import { getActivityRenderer } from "../services/activityRegistry";
import { routeForActivity, routeForBook } from "../services/hubCatalog";
import { createLearnEventRecorder } from "../services/learnEventRecorder";
import { packageKeyFor } from "../services/packageKeys";
import { findBook, findBookByIdx } from "../utils/catalogLookup";
import { exitFullscreen, isDocumentFullscreen, requestFullscreen } from "../utils/fullscreen";
import type { ActivityCompletionResult } from "../types/metaonTypes";

export function ActivityPage() {
  const navigate = useNavigate();
  const activityRootRef = useRef<HTMLDivElement>(null);
  const learnEventRecorderRef = useRef(createLearnEventRecorder());
  const completionLockRef = useRef(false);
  const [isFullscreen, setIsFullscreen] = useState(isDocumentFullscreen);
  const [studyLogIdx, setStudyLogIdx] = useState<number>();
  const [studyError, setStudyError] = useState<string>();
  const [celebration, setCelebration] = useState<{ firstStudy: boolean; points?: number } | null>(null);
  const params = useParams();
  const bookIdx = Number(params.bookIdx || 0);
  const routeDayIdx = Number(params.dayIdx || 0);
  const routeActIdx = Number(params.actIdx || 0);
  const seriesGroup = Number(params.seriesGroup);
  const seriesIdx = Number(params.seriesIdx);
  const bookId = params.bookId || "";
  const dayId = params.dayId || "1:1";
  const actNum = Number(params.actNum || 0);
  const { catalog, isLoading } = useCatalog();
  const { completeActivity, createNotification, getBookProgress, recordRecentBook } = useHubState();
  const book = useMemo(
    () => (bookIdx ? findBookByIdx(catalog, bookIdx) : findBook(catalog, seriesGroup, seriesIdx, bookId)),
    [bookId, bookIdx, catalog, seriesGroup, seriesIdx]
  );
  const packageState = useBookPackage(book);
  const day =
    packageState.packageMeta?.lessonDays.find((item) => (routeDayIdx ? item.dayIdx === routeDayIdx : item.id === dayId)) ||
    packageState.packageMeta?.lessonDays[0];
  const activity =
    day?.activities.find((item) => (routeActIdx ? item.actIdx === routeActIdx : item.actNum === actNum)) ||
    day?.activities[actNum] ||
    day?.activities[0];
  const renderer = getActivityRenderer(activity?.actType, activity?.activityCode);
  const progress = book ? getBookProgress(packageKeyFor(book)) : undefined;
  const isComplete = Boolean(activity && progress?.completedActivityIds.includes(activity.id));
  const currentActivityIndex = day && activity ? Math.max(0, day.activities.findIndex((item) => item.id === activity.id)) : 0;
  const isFirstActivity = currentActivityIndex <= 0;
  const isLastActivity = Boolean(day && currentActivityIndex >= day.activities.length - 1);
  const normalizedActivityCode = normalizeActivityCode(activity?.activityCode);
  const isNpcQuickCheck =
    normalizedActivityCode === MetaOnActivityCode.NpcQuickCheck ||
    normalizedActivityCode === MetaOnActivityCode.LegacyNpcQuickCheck ||
    normalizedActivityCode === MetaOnActivityCode.NpcQuickCheck2;
  const isVideoActivity =
    normalizedActivityCode === MetaOnActivityCode.VideoWordCard ||
    normalizedActivityCode === MetaOnActivityCode.VideoWordQuiz ||
    normalizedActivityCode === MetaOnActivityCode.VideoWordBlank;
  const activityLayoutStyle = {
    "--unity-activity-bg": `url("${getActivityBackgroundUrl(activity?.actType)}")`
  } as CSSProperties;

  useEffect(() => {
    function syncFullscreenState() {
      setIsFullscreen(isDocumentFullscreen());
    }

    document.addEventListener("fullscreenchange", syncFullscreenState);
    syncFullscreenState();
    return () => document.removeEventListener("fullscreenchange", syncFullscreenState);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStudyLogIdx(undefined);
    setStudyError(undefined);
    setCelebration(null);
    completionLockRef.current = false;
    learnEventRecorderRef.current.reset();
    if (!activity?.actIdx) return undefined;

    startStudy({ act_idx: activity.actIdx })
      .then((result) => {
        if (cancelled) return;
        const payload = result && typeof result === "object" ? (result as Record<string, unknown>) : {};
        const nextLogIdx = Number(payload.log_idx || 0);
        if (Number.isFinite(nextLogIdx) && nextLogIdx > 0) {
          setStudyLogIdx(nextLogIdx);
        }
      })
      .catch((caught) => {
        if (!cancelled) setStudyError(caught instanceof Error ? caught.message : String(caught));
      });

    return () => {
      cancelled = true;
    };
  }, [activity?.actIdx]);

  useEffect(() => {
    if (book) recordRecentBook(packageKeyFor(book));
  }, [book, recordRecentBook]);

  if (isLoading) {
    return <EmptyState title="Loading activity" detail="Resolving book and package metadata." />;
  }

  if (!book) {
    return <EmptyState title="Book not found" detail={`${seriesGroup}/${seriesIdx}/${bookId}`} />;
  }

  if (!packageState.packageMeta || !day || !activity) {
    return (
      <EmptyState title="Resources not cached" detail="Download the book resources before launching activities." />
    );
  }

  function goToActivity(nextIndex: number) {
    if (!book || !day) return;
    const clamped = Math.max(0, Math.min(nextIndex, day.activities.length - 1));
    navigate(routeForActivity(book, day, day.activities[clamped]));
  }

  async function toggleFullscreen() {
    if (isDocumentFullscreen()) {
      await exitFullscreen();
      return;
    }

    await requestFullscreen(activityRootRef.current || undefined);
  }

  async function returnToBook() {
    if (!book) return;

    try {
      if (isDocumentFullscreen()) {
        await exitFullscreen();
      }
    } finally {
      navigate(routeForBook(book), { replace: true });
    }
  }

  async function finishActivity(result?: ActivityCompletionResult) {
    if (!book || !activity) return;
    // Points are only awarded on the first study by the existing server flow. The star-dust
    // celebration is shown on every completion regardless; the points number appears only when a
    // positive value is available and it is the first study.
    const firstStudy = !isComplete;
    let awardedPoints = firstStudy ? positivePoints(result?.newPoints) : undefined;

    if (firstStudy && !completionLockRef.current) {
      completionLockRef.current = true;
      if (isNpcQuickCheck) {
        learnEventRecorderRef.current.record({
          action: "activity_complete",
          item_type: "activity",
          item_idx: activity.actIdx ?? null,
          score: result?.score,
          extra: {
            source: "npc_quick_check",
            correct_count: result?.correctCount,
            new_points: result?.newPoints,
            total: result?.total
          }
        });
      }
      if (studyLogIdx) {
        try {
          const endResult = await endStudy({ log_idx: studyLogIdx });
          const endPoints = positivePoints(pointsFromStudyEnd(endResult));
          if (endPoints != null) awardedPoints = endPoints;
        } catch (caught) {
          setStudyError(caught instanceof Error ? caught.message : String(caught));
        }
        try {
          await learnEventRecorderRef.current.flush(studyLogIdx);
        } catch (caught) {
          setStudyError(caught instanceof Error ? `LearnEvent 저장 실패: ${caught.message}` : `LearnEvent 저장 실패: ${String(caught)}`);
        }
      }
      completeActivity(packageKeyFor(book), activity.id);
      createNotification({
        title: "Activity 완료",
        body: `${book.bookName} / ${activity.title} 진행 상태가 저장되었습니다.`,
        tone: "success"
      });
    }

    setCelebration({ firstStudy, points: awardedPoints });
  }

  function handleCelebrationDone() {
    setCelebration(null);
    if (isLastActivity) {
      void returnToBook();
    } else {
      goToActivity(currentActivityIndex + 1);
    }
  }

  return (
    <div className="activity-layout unity-activity-layout" ref={activityRootRef} style={activityLayoutStyle}>
      <ActivityTopBar
        isFullscreen={isFullscreen}
        isFirstActivity={isFirstActivity}
        isLastActivity={isLastActivity}
        onBack={() => void returnToBook()}
        onPrev={() => goToActivity(currentActivityIndex - 1)}
        onNext={() => goToActivity(currentActivityIndex + 1)}
        onToggleFullscreen={toggleFullscreen}
        variant={isVideoActivity ? "video" : "standard"}
      />
      {renderer.render({
        packageMeta: packageState.packageMeta,
        day,
        activity,
        learnEventRecorder: learnEventRecorderRef.current,
        studyLogIdx,
        onComplete: finishActivity,
        onExit: returnToBook
      })}
      {studyError ? <p className="activity-study-error">{studyError}</p> : null}
      {!isNpcQuickCheck ? (
        <button
          aria-label={isComplete ? "Activity completion saved" : "Complete activity"}
          aria-pressed={isComplete}
          className={`hub-activity-complete-button${isVideoActivity ? " video-activity-check" : ""}${isComplete ? " is-complete" : ""}`}
          title="완료"
          type="button"
          onClick={() => void finishActivity()}
        >
          {isVideoActivity ? (
            <VideoActivityCheckControl />
          ) : (
            <img aria-hidden="true" draggable={false} src={activityControlAssets.check} alt="" />
          )}
        </button>
      ) : null}
      {celebration ? (
        <ActivityCompletionCelebration
          firstStudy={celebration.firstStudy}
          points={celebration.points}
          onDone={handleCelebrationDone}
        />
      ) : null}
    </div>
  );
}

function positivePoints(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function pointsFromStudyEnd(value: unknown): unknown {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  return (
    record.new_point ??
    record.newPoint ??
    record.add_point ??
    record.addPoint ??
    record.get_point ??
    record.reward_point ??
    record.new_points ??
    record.point
  );
}
