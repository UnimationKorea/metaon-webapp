import { ChevronLeft, ChevronRight, Maximize2, Menu, Minimize2, PenLine, Star, X } from "lucide-react";
import { useEffect, useState } from "react";
import { activityControlAssets, videoActivityControlAssets } from "./ActivityImageControls";

const ACTIVITY_MENU_AUTO_HIDE_MS = 3000;

export function ActivityTopBar({
  isFullscreen,
  isFirstActivity,
  isLastActivity,
  onBack,
  onPrev,
  onNext,
  onToggleFullscreen,
  variant = "standard"
}: {
  isFullscreen: boolean;
  isFirstActivity: boolean;
  isLastActivity: boolean;
  onBack: () => void;
  onPrev: () => void;
  onNext: () => void;
  onToggleFullscreen: () => void;
  variant?: "standard" | "video";
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

  if (variant === "video") {
    return (
      <>
        <button className="video-activity-back" type="button" onClick={onBack} aria-label="Back to book">
          <img aria-hidden="true" className="video-activity-back-background" draggable={false} src={videoActivityControlAssets.backBackground} alt="" />
          <img aria-hidden="true" className="video-activity-back-arrow" draggable={false} src={videoActivityControlAssets.backArrow} alt="" />
        </button>
        <div className={`video-activity-map${isOpen ? " is-open" : ""}`}>
          <button
            className="video-activity-map-trigger"
            type="button"
            onClick={() => setIsOpen((current) => !current)}
            aria-expanded={isOpen}
            aria-label={isOpen ? "Hide activity map" : "Show activity map"}
            title="Activity map"
          >
            <img aria-hidden="true" className="video-activity-map-planet" draggable={false} src={videoActivityControlAssets.mapPlanet} alt="" />
            <img aria-hidden="true" className="video-activity-map-pin" draggable={false} src={videoActivityControlAssets.mapPin} alt="" />
            <img aria-hidden="true" className="video-activity-map-accent" draggable={false} src={videoActivityControlAssets.mapAccent} alt="" />
          </button>
          <div className="video-activity-map-actions" aria-label="Activity navigation menu">
            <button type="button" onClick={() => runAndClose(onPrev)} aria-label="Previous activity" title="Previous activity" disabled={isFirstActivity}>
              <ChevronLeft size={22} />
            </button>
            <button type="button" onClick={() => runAndClose(onNext)} aria-label="Next activity" title="Next activity" disabled={isLastActivity}>
              <ChevronRight size={22} />
            </button>
            <button
              type="button"
              onClick={() => runAndClose(onToggleFullscreen)}
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? <Minimize2 size={19} /> : <Maximize2 size={19} />}
            </button>
          </div>
        </div>
      </>
    );
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
