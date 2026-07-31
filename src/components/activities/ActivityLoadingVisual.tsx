type ActivityLoadingVisualProps = {
  ariaLabel?: string;
  className?: string;
};

/** Shared transparent loading surface for activity routes and in-activity resources. */
export function ActivityLoadingVisual({ ariaLabel = "Loading activity", className = "" }: ActivityLoadingVisualProps) {
  return (
    <div
      aria-label={ariaLabel}
      aria-live="polite"
      className={`activity-loading-visual${className ? ` ${className}` : ""}`}
      role="status"
    >
      <img
        alt=""
        aria-hidden="true"
        className="activity-loading-visual-orbit"
        draggable="false"
        src="/metaon-assets/activity/loading/loading-star-orbit.png"
      />
      <img
        alt=""
        aria-hidden="true"
        className="activity-loading-visual-book"
        draggable="false"
        src="/metaon-assets/activity/loading/loading-book.png"
      />
    </div>
  );
}
