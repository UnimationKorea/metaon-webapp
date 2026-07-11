import type { RazRecoBucket, RazResult } from "../types";

interface Props {
  result: RazResult;
  onRestart: () => void;
}

// Raz Grade(미국 원어민 기준) 라벨. 한국 학년과 혼동을 막기 위해 "Raz" 접두를 붙인다.
const GRADE_LABEL: Record<string, string> = {
  P: "Raz Pre-K", K: "Raz K", "1": "Raz G1", "2": "Raz G2", "3": "Raz G3",
  "4": "Raz G4", "5": "Raz G5", "6": "Raz G6", "7": "Raz G7",
};

function lexileText(n: number | null): string {
  if (n === null) return "-";
  return n < 0 ? `BR${Math.abs(n)}L` : `${n}L`;
}

function Bucket({ bucket, highlight }: { bucket: RazRecoBucket | null; highlight?: boolean }) {
  if (!bucket) return null;
  return (
    <div className={`reco-bucket ${highlight ? "main" : ""}`}>
      <div className="reco-head">
        <span className="reco-role">{bucket.role}</span>
        <span className="reco-level">
          {GRADE_LABEL[bucket.grade] ?? bucket.grade} · Level {bucket.level}
        </span>
      </div>
      <ul className="book-list">
        {bucket.books.map((b) => (
          <li key={b.book_code}>
            <span className="book-title">{b.title}</span>
            <span className="book-lex">{b.lexile || "-"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function RazResultPage({ result, onRestart }: Props) {
  const { placement, recommendation } = result;

  return (
    <div className="page result-page">
      <h1 className="result-title">{result.name} 님의 읽기 레벨</h1>

      <div className="overall-card raz-place">
        <div className="overall-emoji">📗</div>
        <div className="overall-level">
          {GRADE_LABEL[placement.grade] ?? placement.grade} · Level {placement.level}
        </div>
        <div className="overall-score">예상 Lexile {lexileText(placement.lexileAvg)}</div>
        {placement.belowFloor && (
          <div className="place-note">읽기 준비 단계예요. 가장 쉬운 책부터 시작해요!</div>
        )}
        {placement.needsLowerStart && (
          <div className="place-note">정확한 측정이 어려웠어요. 학년을 한 단계 낮춰 다시 해보세요.</div>
        )}
        {placement.reachedCeiling && (
          <div className="place-note">이 범위의 가장 높은 단계예요! 더 높은 단계도 도전할 수 있어요.</div>
        )}
        {placement.truncated && placement.measured && !placement.reachedCeiling && (
          <div className="place-note">실력이 더 높을 수 있어요. 학년을 한 단계 올려 다시 해보면 정확해져요.</div>
        )}
      </div>

      <p className="raz-note">※ Raz Grade는 미국 원어민 기준이에요. 한국 학년과는 다를 수 있어요.</p>

      {result.path && result.path.length > 0 && (
        <div className="areas-card">
          <h2 className="reco-title">📊 지문별 결과 · 전체 평균과 비교</h2>
          {result.path.map((p, i) => {
            const my = Math.round(p.ratio * 100);
            const avg = p.globalAccuracy != null ? Math.round(p.globalAccuracy * 100) : null;
            const mine = p.ms != null ? (p.ms / 1000).toFixed(1) : null;
            const gavg = p.globalAvgMs != null ? (p.globalAvgMs / 1000).toFixed(1) : null;
            return (
              <div className="pj-row" key={i}>
                <div className="pj-head">
                  <span className="pj-level">
                    지문 {p.seq ?? i + 1} · {GRADE_LABEL[p.grade] ?? p.grade} · Level {p.level}
                    {p.confirm ? " ✅확인" : ""}
                  </span>
                  <span className="pj-score">
                    나 <b>{my}%</b>
                    {avg != null && <span className="pj-avg-txt"> · 평균 {avg}%</span>}
                  </span>
                </div>
                <div className="pj-bar">
                  <div className="pj-fill" style={{ width: `${my}%` }} />
                  {avg != null && <div className="pj-avg-mark" style={{ left: `${avg}%` }} />}
                </div>
                {mine && (
                  <div className="pj-time">
                    ⏱ 나 {mine}초
                    {gavg && <> · 평균 {gavg}초</>}
                    {p.globalN ? <span className="pj-n"> ({p.globalN}명 기준)</span> : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {result.areas && (
        <div className="areas-card">
          <h2 className="reco-title">🔎 영역별 강약점</h2>
          {(["reading", "vocab"] as const).map((k) => {
            const a = result.areas[k];
            const pct = a.ratio != null ? Math.round(a.ratio * 100) : 0;
            const label = k === "reading" ? "독해 📖" : "어휘 🔤";
            return (
              <div className="area-row" key={k}>
                <div className="area-head">
                  <span>{label}</span>
                  <span className="area-score">{a.correct}/{a.total} ({pct}%)</span>
                </div>
                <div className="sr-bar">
                  <div className="sr-bar-fill" style={{ width: `${pct}%`, background: k === "reading" ? "#4c8dff" : "#ec407a" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {result.gradeCompare && result.gradeCompare.count > 1 && (
        <div className="grade-compare">
          👥 같은 학년 응시자 {result.gradeCompare.count}명 중
          {result.gradeCompare.higherPct != null && result.gradeCompare.higherPct <= 50 ? (
            <> <b>상위 {result.gradeCompare.higherPct}%</b> 수준이에요!</>
          ) : (
            <> 나보다 높은 레벨이 {result.gradeCompare.higherPct}%예요.</>
          )}
        </div>
      )}

      <h2 className="reco-title">📚 추천 책</h2>
      <Bucket bucket={recommendation.instructional} highlight />
      <Bucket bucket={recommendation.challenge} />

      <button className="big-btn primary" onClick={onRestart}>
        다시 하기 🔁
      </button>
    </div>
  );
}
