type ActivityLoadingVisualProps = {
  className?: string;
};

/** Shared image-only loading surface for activity routes and in-activity resources. */
export function ActivityLoadingVisual({ className = "" }: ActivityLoadingVisualProps) {
  return (
    <div
      aria-label="Loading activity"
      aria-live="polite"
      className={`activity-loading-visual${className ? ` ${className}` : ""}`}
      role="status"
    >
      <span aria-hidden="true" className="activity-loading-visual-art" />
      <span aria-hidden="true" className="activity-loading-visual-sparkles">
        <i />
        <i />
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}
