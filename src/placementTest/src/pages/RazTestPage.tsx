import { useRef, useState } from "react";
import { submitRazUnit } from "../api";
import { speak, isSpeechSupported } from "../speech";
import type { RazResult, RazUnit } from "../types";

interface Props {
  sessionId: string;
  firstUnit: RazUnit;
  onDone: (r: RazResult) => void;
}

function normalizePassageText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function skillLabel(skill: "reading" | "vocab"): string {
  return skill === "vocab" ? "Vocabulary" : "Reading";
}

export default function RazTestPage({ sessionId, firstUnit, onDone }: Props) {
  const [unit, setUnit] = useState<RazUnit>(firstUnit);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startRef = useRef<number>(Date.now()); // 현재 지문 노출 시각(풀이시간 측정용)

  const allAnswered = unit.items.every((it) => answers[it.id] !== undefined);

  function choose(itemId: string, idx: number) {
    setAnswers((prev) => ({ ...prev, [itemId]: idx }));
  }

  async function next() {
    setSubmitting(true);
    setError(null);
    const elapsedMs = Date.now() - startRef.current;
    try {
      const res = await submitRazUnit(sessionId, answers, elapsedMs);
      if ("done" in res && res.done) {
        onDone(res);
      } else {
        setUnit(res.unit);
        setAnswers({});
        startRef.current = Date.now(); // 다음 지문 타이머 리셋
        window.scrollTo({ top: 0 });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page test-page">
      <div className="test-top">
        <div className="section-tag">
          📖 지문 {unit.step}
          <span className="section-count">읽고 문제를 풀어요</span>
        </div>
      </div>

      {unit.confirm && (
        <div className="section-banner">✅ 마지막 확인 문제예요!</div>
      )}

      <div className="passage-card">
        <div className="passage-text">{normalizePassageText(unit.passage)}</div>
        {isSpeechSupported() && (
          <button className="speak-btn" onClick={() => speak(unit.passage)}>
            🔊 읽어주기
          </button>
        )}
      </div>

      {unit.items.map((it, qi) => (
        <div className={`question raz-q ${it.skill === "vocab" ? "vocab-q" : "reading-q"}`} key={it.id}>
          <div className="raz-q-meta">
            <span className="q-no">{qi + 1}</span>
            <span className={`skill-badge ${it.skill === "vocab" ? "vocab" : "reading"}`}>{skillLabel(it.skill)}</span>
          </div>
          <p className="prompt">
            {it.q}
          </p>
          <div className="choices list">
            {it.choices.map((choice, idx) => (
              <button
                key={idx}
                className={`choice ${answers[it.id] === idx ? "selected" : ""}`}
                onClick={() => choose(it.id, idx)}
              >
                {choice}
              </button>
            ))}
          </div>
        </div>
      ))}

      {error && <p className="error">⚠️ {error}</p>}

      <button className="big-btn primary" onClick={next} disabled={!allAnswered || submitting}>
        {submitting ? "채점 중… ⏳" : "다음 ➡️"}
      </button>
    </div>
  );
}
