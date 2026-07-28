import { useEffect, useRef, type CSSProperties } from "react";

const STAR_SRC = "/unity-app-ui/book/star.png";
const PARTICLE_COUNT = 16;
const AUTO_DISMISS_MS = 2000;

type ActivityCompletionCelebrationProps = {
  firstStudy: boolean;
  points?: number;
  onDone: () => void;
};

/**
 * Full-screen "star-dust" celebration shown when an Activity is completed.
 *
 * It always appears on completion (both the common Check button and NPC Viewer completion),
 * regardless of whether points were awarded. Points are only granted on the first study by the
 * existing server flow, so `points` is shown only when a positive value is available and it is
 * the first study; otherwise the overlay simply celebrates completion. The overlay auto-dismisses
 * (or dismisses on click) and calls `onDone`, which advances to the next Activity.
 */
export function ActivityCompletionCelebration({ firstStudy, points, onDone }: ActivityCompletionCelebrationProps) {
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  function finish() {
    if (doneRef.current) return;
    doneRef.current = true;
    onDoneRef.current();
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (doneRef.current) return;
      doneRef.current = true;
      onDoneRef.current();
    }, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const hasPoints = typeof points === "number" && points > 0;

  return (
    <div className="activity-celebration" role="alertdialog" aria-label="Activity 완료" onClick={finish}>
      <div className="activity-celebration-particles" aria-hidden="true">
        {Array.from({ length: PARTICLE_COUNT }).map((_, index) => (
          <img
            key={index}
            className="activity-celebration-star"
            src={STAR_SRC}
            alt=""
            draggable={false}
            style={{ "--i": index } as CSSProperties}
          />
        ))}
      </div>
      <div className="activity-celebration-card">
        <img className="activity-celebration-hero" src={STAR_SRC} alt="" aria-hidden="true" draggable={false} />
        {hasPoints ? <strong className="activity-celebration-points">+{points}</strong> : null}
        <p className="activity-celebration-title">{firstStudy ? "포인트 획득!" : "복습 완료!"}</p>
        <span className="activity-celebration-sub">다음 학습으로 이동합니다.</span>
      </div>
    </div>
  );
}
