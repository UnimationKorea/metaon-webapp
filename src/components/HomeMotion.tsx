import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";

type MotionQuality = "full" | "low" | "reduced";

type HomeMotionRootProps = {
  children: ReactNode;
  themeId: string;
};

type HomeDepthSceneProps = {
  themeId: string;
};

type NavigatorPerformanceHints = Navigator & {
  connection?: { saveData?: boolean };
  deviceMemory?: number;
};

const PARTICLES = [
  { x: 7, y: 20, size: 0.72, delay: -2.1, duration: 8.6, drift: -18 },
  { x: 17, y: 72, size: 0.92, delay: -5.2, duration: 11.2, drift: 14 },
  { x: 28, y: 35, size: 0.55, delay: -1.4, duration: 9.8, drift: 20 },
  { x: 39, y: 82, size: 0.68, delay: -7.3, duration: 12.4, drift: -12 },
  { x: 49, y: 16, size: 0.86, delay: -4.6, duration: 10.8, drift: 16 },
  { x: 57, y: 59, size: 0.5, delay: -6.2, duration: 8.2, drift: -20 },
  { x: 66, y: 27, size: 0.72, delay: -3.7, duration: 11.8, drift: 18 },
  { x: 73, y: 78, size: 0.62, delay: -8.1, duration: 13.1, drift: -16 },
  { x: 81, y: 45, size: 0.94, delay: -5.8, duration: 10.1, drift: 13 },
  { x: 88, y: 14, size: 0.58, delay: -2.9, duration: 9.2, drift: -14 },
  { x: 93, y: 66, size: 0.78, delay: -7.6, duration: 12.1, drift: 11 },
  { x: 35, y: 8, size: 0.46, delay: -4.1, duration: 8.8, drift: 17 }
] as const;

export function HomeMotionRoot({ children, themeId }: HomeMotionRootProps) {
  const rootRef = useRef<HTMLElement>(null);
  const [quality] = useState<MotionQuality>(resolveMotionQuality);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || quality === "reduced") return;

    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    let activeTiltSurface: HTMLElement | null = null;
    let frame: number | undefined;

    const requestFrame = window.requestAnimationFrame?.bind(window) || ((callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 16));
    const cancelFrame = window.cancelAnimationFrame?.bind(window) || window.clearTimeout.bind(window);

    const render = () => {
      current.x += (target.x - current.x) * 0.12;
      current.y += (target.y - current.y) * 0.12;
      root.style.setProperty("--hub-motion-x", current.x.toFixed(4));
      root.style.setProperty("--hub-motion-y", current.y.toFixed(4));
      root.style.setProperty("--hub-motion-bg-x", `${(-current.x * 12).toFixed(2)}px`);
      root.style.setProperty("--hub-motion-bg-y", `${(-current.y * 8).toFixed(2)}px`);
      root.style.setProperty("--hub-motion-card-x", `${(-current.y * 1.1).toFixed(3)}deg`);
      root.style.setProperty("--hub-motion-card-y", `${(current.x * 1.35).toFixed(3)}deg`);
      root.style.setProperty("--hub-motion-card-shift-x", `${(current.x * 3).toFixed(2)}px`);
      root.style.setProperty("--hub-motion-card-shift-y", `${(current.y * 2).toFixed(2)}px`);

      if (Math.abs(target.x - current.x) > 0.001 || Math.abs(target.y - current.y) > 0.001) {
        frame = requestFrame(render);
      } else {
        frame = undefined;
      }
    };

    const schedule = () => {
      if (frame === undefined) frame = requestFrame(render);
    };

    const resetTiltSurface = () => {
      if (!activeTiltSurface) return;
      activeTiltSurface.style.setProperty("--hub-local-tilt-x", "0deg");
      activeTiltSurface.style.setProperty("--hub-local-tilt-y", "0deg");
      activeTiltSurface.style.setProperty("--hub-local-shine-x", "50%");
      activeTiltSurface.style.setProperty("--hub-local-shine-y", "50%");
      activeTiltSurface.style.setProperty("--hub-local-shine-shift", "0%");
      activeTiltSurface.removeAttribute("data-tilt-active");
      activeTiltSurface = null;
    };

    const reset = () => {
      target.x = 0;
      target.y = 0;
      resetTiltSurface();
      schedule();
    };

    const updateTiltSurface = (event: PointerEvent) => {
      const eventTarget = event.target;
      const nextSurface = eventTarget instanceof Element ? eventTarget.closest<HTMLElement>("[data-home-tilt]") : null;

      if (!nextSurface || !root.contains(nextSurface)) {
        resetTiltSurface();
        return;
      }

      if (activeTiltSurface !== nextSurface) {
        resetTiltSurface();
        activeTiltSurface = nextSurface;
      }

      const bounds = nextSurface.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;

      const surfaceKind = nextSurface.dataset.homeTilt;
      const baseDegrees = surfaceKind === "portal" ? 5.2 : surfaceKind === "placement" ? 3.2 : 4.2;
      const intensity = quality === "low" ? 0.46 : 1;
      const localX = clamp(((event.clientX - bounds.left) / bounds.width) * 2 - 1);
      const localY = clamp(((event.clientY - bounds.top) / bounds.height) * 2 - 1);

      nextSurface.style.setProperty("--hub-local-tilt-x", `${(-localY * baseDegrees * intensity).toFixed(3)}deg`);
      nextSurface.style.setProperty("--hub-local-tilt-y", `${(localX * baseDegrees * intensity).toFixed(3)}deg`);
      nextSurface.style.setProperty("--hub-local-shine-x", `${((localX + 1) * 50).toFixed(1)}%`);
      nextSurface.style.setProperty("--hub-local-shine-y", `${((localY + 1) * 50).toFixed(1)}%`);
      nextSurface.style.setProperty("--hub-local-shine-shift", `${(localX * 22).toFixed(1)}%`);
      nextSurface.setAttribute("data-tilt-active", "true");
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const bounds = root.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;

      const intensity = quality === "low" ? 0.48 : 1;
      target.x = clamp(((event.clientX - bounds.left) / bounds.width) * 2 - 1) * intensity;
      target.y = clamp(((event.clientY - bounds.top) / bounds.height) * 2 - 1) * intensity;
      updateTiltSurface(event);
      schedule();
    };

    const handleVisibility = () => {
      if (document.hidden) reset();
    };

    root.addEventListener("pointermove", handlePointerMove, { passive: true });
    root.addEventListener("pointerleave", reset);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      root.removeEventListener("pointermove", handlePointerMove);
      root.removeEventListener("pointerleave", reset);
      document.removeEventListener("visibilitychange", handleVisibility);
      resetTiltSurface();
      if (frame !== undefined) cancelFrame(frame);
    };
  }, [quality]);

  return (
    <section
      ref={rootRef}
      className="hub-home-grid hub-home-motion-root"
      data-home-motion-quality={quality}
      data-home-theme={themeId}
    >
      {children}
    </section>
  );
}

export function HomeDepthScene({ themeId }: HomeDepthSceneProps) {
  const particleKind = getParticleKind(themeId);

  return (
    <div className="hub-home-depth-scene" aria-hidden="true" data-particle-kind={particleKind}>
      <span className="hub-home-depth-base" />
      <span className="hub-home-depth-shade" />
      <span className="hub-home-depth-particles">
        {PARTICLES.map((particle, index) => {
          const style = {
            "--particle-x": `${particle.x}%`,
            "--particle-y": `${particle.y}%`,
            "--particle-size": particle.size,
            "--particle-delay": `${particle.delay}s`,
            "--particle-duration": `${particle.duration}s`,
            "--particle-drift": `${particle.drift}px`
          } as CSSProperties;

          return (
            <i className={`hub-theme-particle is-${particleKind}`} key={`${themeId}-${index}`} style={style}>
              {particleKind === "bubble" ? (
                <img src={`/metaon-assets/unity-undersea/bubble${index % 2 ? "2" : "1"}.png`} alt="" />
              ) : null}
            </i>
          );
        })}
      </span>
    </div>
  );
}

function resolveMotionQuality(): MotionQuality {
  if (typeof window === "undefined" || typeof navigator === "undefined") return "reduced";
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return "reduced";

  const hints = navigator as NavigatorPerformanceHints;
  const lowMemory = typeof hints.deviceMemory === "number" && hints.deviceMemory <= 4;
  const lowCpu = typeof hints.hardwareConcurrency === "number" && hints.hardwareConcurrency <= 4;
  const compactViewport = window.innerWidth < 720;

  return hints.connection?.saveData || lowMemory || lowCpu || compactViewport ? "low" : "full";
}

function getParticleKind(themeId: string) {
  if (themeId === "undersea") return "bubble";
  if (themeId === "jungle") return "leaf";
  if (themeId === "concert") return "beam";
  if (themeId === "amusement") return "confetti";
  return "spark";
}

function clamp(value: number) {
  return Math.max(-1, Math.min(1, value));
}
