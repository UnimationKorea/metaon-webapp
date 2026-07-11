import { ChevronLeft, ChevronRight, Maximize2, Menu, Minimize2, PenLine, Star, X } from "lucide-react";
import { useEffect, useState } from "react";
import { activityControlAssets } from "./ActivityImageControls";

const ACTIVITY_MENU_AUTO_HIDE_MS = 3000;

export function ActivityTopBar({
  isFullscreen,
  isFirstActivity,
  isLastActivity,
  onBack,
  onPrev,
  onNext,
  onToggleFullscreen
}: {
  isFullscreen: boolean;
  isFirstActivity: boolean;
  isLastActivity: boolean;
  onBack: () => void;
  onPrev: () => void;
  onNext: () => void;
  onToggleFullscreen: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return undefined;
    const timer = window.setTimeout(() => setIsOpen(false), ACTIVITY_MENU_AUTO_HIDE_MS);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  function runAndClose(action: () => void) {
    action();
    setIsOpen(false);
  }

  return (
    <>
      <button className="activity-common-back" type="button" onClick={onBack} aria-label="Back to book">
        <img aria-hidden="true" draggable={false} src={activityControlAssets.back} alt="" />
      </button>
      <div className={`activity-topbar${isOpen ? " is-open" : ""}`}>
      <button
        className="activity-nav-tab"
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        aria-label={isOpen ? "Hide activity menu" : "Show activity menu"}
      >
        {isOpen ? <X size={18} /> : <Menu size={18} />}
        <span>메뉴</span>
      </button>
      <div className="activity-topbar-actions" aria-label="Activity navigation menu">
        <button type="button" onClick={() => runAndClose(onPrev)} aria-label="Previous activity" disabled={isFirstActivity}>
          <ChevronLeft size={20} />
        </button>
        <button type="button" onClick={() => runAndClose(onNext)} aria-label="Next activity" disabled={isLastActivity}>
          <ChevronRight size={20} />
        </button>
        <button type="button" aria-label="Drawing board">
          <PenLine size={18} />
        </button>
        <button
          type="button"
          onClick={() => runAndClose(onToggleFullscreen)}
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
        <span className="star-points">
          <Star size={16} /> 0
        </span>
      </div>
      </div>
    </>
  );
}
