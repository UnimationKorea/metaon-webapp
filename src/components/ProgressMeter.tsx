import type { DownloadProgress } from "../types/metaonTypes";

const PHASE_LABELS: Record<DownloadProgress["phase"], string> = {
  idle: "다운로드 준비 중",
  downloading: "Book 리소스 다운로드 중",
  unzipping: "리소스 준비 중",
  saving: "다운로드한 리소스 저장 중",
  done: "다운로드 완료",
  error: "다운로드를 완료하지 못했습니다"
};

export function ProgressMeter({ label, progress }: { label?: string; progress: DownloadProgress }) {
  const percent = Math.round(Math.max(0, Math.min(progress.ratio, 1)) * 100);
  const visibleLabel = label || PHASE_LABELS[progress.phase];

  return (
    <div
      className={`progress-meter is-${progress.phase}`}
      role="progressbar"
      aria-label={visibleLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={`${percent}%`}
    >
      <div className="progress-label">
        <span>{visibleLabel}</span>
        <strong>{percent}%</strong>
      </div>
      <div className="progress-track">
        <div style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
