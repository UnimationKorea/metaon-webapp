import type { DownloadProgress } from "../types/metaonTypes";

export function ProgressMeter({ progress }: { progress: DownloadProgress }) {
  const percent = Math.round(Math.max(0, Math.min(progress.ratio, 1)) * 100);

  return (
    <div className="progress-meter" aria-live="polite">
      <div className="progress-label">
        <span>{progress.phase}</span>
        <strong>{percent}%</strong>
      </div>
      <div className="progress-track">
        <div style={{ width: `${percent}%` }} />
      </div>
      {progress.message || progress.currentFile ? <small>{progress.message || progress.currentFile}</small> : null}
    </div>
  );
}
