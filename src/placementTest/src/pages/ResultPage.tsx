import { LEVEL_META, levelLabel, SECTION_META } from "../levels";
import type { GradeResult } from "../types";

interface Props {
  result: GradeResult;
  onRestart: () => void;
}

export default function ResultPage({ result, onRestart }: Props) {
  const overall = LEVEL_META[result.overallLevel];

  return (
    <div className="page result-page">
      <h1 className="result-title">{result.name} 님의 결과</h1>

      <div className="overall-card" style={{ borderColor: overall?.color }}>
        <div className="overall-emoji">{overall?.emoji}</div>
        <div className="overall-level">{levelLabel(result.overallLevel)}</div>
        <div className="overall-score">
          전체 {result.totalCorrect} / {result.totalQuestions} 문제 정답
        </div>
      </div>

      <div className="section-results">
        {result.sections.map((s) => {
          const meta = SECTION_META[s.section];
          const lv = LEVEL_META[s.level];
          return (
            <div className="section-result" key={s.section}>
              <div className="sr-head">
                <span className="sr-name">
                  {meta.emoji} {meta.label}
                </span>
                <span className="sr-level" style={{ color: lv?.color }}>
                  {levelLabel(s.level)}
                </span>
              </div>
              <div className="sr-bar">
                <div
                  className="sr-bar-fill"
                  style={{ width: `${Math.round(s.ratio * 100)}%`, background: lv?.color }}
                />
              </div>
              <div className="sr-score">
                {s.correct} / {s.total} 정답
              </div>
            </div>
          );
        })}
      </div>

      <button className="big-btn primary" onClick={onRestart}>
        다시 하기 🔁
      </button>
    </div>
  );
}
