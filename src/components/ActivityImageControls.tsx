export const activityControlAssets = {
  back: "/metaon-assets/activity/common-controls/btn-back.png",
  check: "/metaon-assets/activity/common-controls/check.png",
  hint: "/metaon-assets/activity/common-controls/hint.png",
  listening: "/metaon-assets/activity/common-controls/listening.png",
  next: "/metaon-assets/activity/common-controls/btn-page-next.png",
  prev: "/metaon-assets/activity/common-controls/btn-page-prev.png",
  sound: "/metaon-assets/activity/common-controls/sound.png",
  timer: "/metaon-assets/activity/common-controls/time.png",
  timerFrame: "/metaon-assets/activity/common-controls/timer_frame.png",
  watch: "/metaon-assets/activity/common-controls/watch.png"
} as const;

export const videoActivityControlAssets = {
  backBackground: "/metaon-assets/activity/video-controls/back-background.png",
  backArrow: "/metaon-assets/activity/video-controls/back-arrow.svg",
  checkBackground: "/metaon-assets/activity/video-controls/check-background.png",
  checkForeground: "/metaon-assets/activity/video-controls/check-foreground.png",
  mapAccent: "/metaon-assets/activity/video-controls/map-accent.svg",
  mapPin: "/metaon-assets/activity/video-controls/map-pin.svg",
  mapPlanet: "/metaon-assets/activity/video-controls/map-planet.svg",
  moreInfoOff: "/metaon-assets/activity/video-controls/more-info-off.png",
  moreInfoOn: "/metaon-assets/activity/video-controls/more-info-on.png",
  pageChevron: "/metaon-assets/activity/video-controls/page-chevron.svg",
  pageNextBackground: "/metaon-assets/activity/video-controls/page-next-background.png",
  pagePrevBackground: "/metaon-assets/activity/video-controls/page-prev-background.png"
} as const;

export function ActivityPageArrowImage({ direction }: { direction: "prev" | "next" }) {
  return (
    <img
      aria-hidden="true"
      className="activity-page-arrow-image"
      draggable={false}
      src={activityControlAssets[direction]}
      alt=""
    />
  );
}

export function VideoActivityPageArrow({ direction }: { direction: "prev" | "next" }) {
  return (
    <span
      aria-hidden="true"
      className={`video-activity-page-arrow is-${direction}`}
    >
      <img
        aria-hidden="true"
        className="video-activity-page-arrow-background"
        draggable={false}
        src={direction === "prev" ? videoActivityControlAssets.pagePrevBackground : videoActivityControlAssets.pageNextBackground}
        alt=""
      />
      <img aria-hidden="true" className="video-activity-page-arrow-icon" draggable={false} src={videoActivityControlAssets.pageChevron} alt="" />
    </span>
  );
}

export function VideoActivityCheckControl() {
  return (
    <span aria-hidden="true" className="video-activity-check-control">
      <img className="video-activity-check-background" draggable={false} src={videoActivityControlAssets.checkBackground} alt="" />
      <img className="video-activity-check-foreground" draggable={false} src={videoActivityControlAssets.checkForeground} alt="" />
    </span>
  );
}

export function VideoActivityPageIndicator({ current, total }: { current: number; total: number }) {
  const safeTotal = Math.max(total, 1);
  const safeCurrent = Math.min(Math.max(current, 1), safeTotal);

  return (
    <div aria-label={`Page ${safeCurrent} of ${safeTotal}`} className="video-activity-page-indicator" role="status">
      <strong>{safeCurrent}</strong>
      <span>/</span>
      <strong>{safeTotal}</strong>
    </div>
  );
}

export function ActivityListeningImage({ className = "" }: { className?: string }) {
  return (
    <img
      aria-hidden="true"
      className={`activity-listening-image${className ? ` ${className}` : ""}`}
      draggable={false}
      src={activityControlAssets.listening}
      alt=""
    />
  );
}

export function ActivitySoundImage({ className = "" }: { className?: string }) {
  return (
    <img
      aria-hidden="true"
      className={`activity-sound-image${className ? ` ${className}` : ""}`}
      draggable={false}
      src={activityControlAssets.sound}
      alt=""
    />
  );
}

export function ActivityHintImage() {
  return <img aria-hidden="true" className="activity-hint-image" draggable={false} src={activityControlAssets.hint} alt="" />;
}

export function ActivityTimerBadge({
  seconds,
  className = "",
  visualStyle = "legacy"
}: {
  seconds: number;
  className?: string;
  visualStyle?: "legacy" | "framed";
}) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, "0");
  const remainder = String(safeSeconds % 60).padStart(2, "0");
  const isFramed = visualStyle === "framed";

  return (
    <div
      aria-label={`${safeSeconds} seconds remaining`}
      className={`activity-timer-image-badge${isFramed ? " is-framed" : ""}${className ? ` ${className}` : ""}`}
    >
      <img
        aria-hidden="true"
        className="activity-timer-frame"
        draggable={false}
        src={isFramed ? activityControlAssets.timerFrame : activityControlAssets.timer}
        alt=""
      />
      {isFramed ? <img aria-hidden="true" className="activity-timer-watch" draggable={false} src={activityControlAssets.watch} alt="" /> : null}
      <strong>{minutes}:{remainder}</strong>
    </div>
  );
}
