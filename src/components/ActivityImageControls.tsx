export const activityControlAssets = {
  back: "/metaon-assets/activity/common-controls/btn-back.png",
  check: "/metaon-assets/activity/common-controls/check.png",
  hint: "/metaon-assets/activity/common-controls/hint.png",
  listening: "/metaon-assets/activity/common-controls/listening.png",
  next: "/metaon-assets/activity/common-controls/btn-page-next.png",
  prev: "/metaon-assets/activity/common-controls/btn-page-prev.png",
  sound: "/metaon-assets/activity/common-controls/sound.png",
  timer: "/metaon-assets/activity/common-controls/time.png"
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
  className = ""
}: {
  seconds: number;
  className?: string;
}) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, "0");
  const remainder = String(safeSeconds % 60).padStart(2, "0");

  return (
    <div
      aria-label={`${safeSeconds} seconds remaining`}
      className={`activity-timer-image-badge${className ? ` ${className}` : ""}`}
    >
      <img aria-hidden="true" draggable={false} src={activityControlAssets.timer} alt="" />
      <strong>{minutes}:{remainder}</strong>
    </div>
  );
}
