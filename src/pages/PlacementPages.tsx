import { ArrowLeft, ArrowRight, BarChart3, BookOpen, CheckCircle2, Headphones, PlayCircle, RefreshCcw, Volume2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { startRazTest, submitRazUnit } from "../placementTest/src/api";
import { isSpeechSupported, speak } from "../placementTest/src/speech";
import type { RazRecoBucket, RazResult, RazUnit } from "../placementTest/src/types";
import { useAuth } from "../hooks/useAuth";
import { useCatalog } from "../hooks/useCatalog";
import { useHubState } from "../hooks/useHubState";
import { routeForPlacementRecommendation } from "../services/hubCatalog";

const RAZ_SESSION_STORAGE_KEY = "metaon.placement.razSession";

const gradeOptions = [
  { value: "kinder", label: "유치원" },
  { value: "e1", label: "초1" },
  { value: "e2", label: "초2" },
  { value: "e3", label: "초3" },
  { value: "e4", label: "초4" },
  { value: "e5", label: "초5" },
  { value: "e6", label: "초6" },
  { value: "m1", label: "중1+" }
];

const gradeLabel: Record<string, string> = {
  P: "Raz Pre-K",
  K: "Raz K",
  "1": "Raz G1",
  "2": "Raz G2",
  "3": "Raz G3",
  "4": "Raz G4",
  "5": "Raz G5",
  "6": "Raz G6",
  "7": "Raz G7"
};

type StoredRazSession = {
  sessionId: string;
  unit: RazUnit;
};

export function PlacementIntroPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { placement, resetPlacement, startPlacement, user } = useHubState();
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [soundChecked, setSoundChecked] = useState(false);

  useEffect(() => {
    if (!name && isAuthenticated && user.name && user.name !== "Guest") {
      setName(user.name);
    }
  }, [isAuthenticated, name, user.name]);

  async function beginTest() {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    if (!name.trim() || !grade) return;

    setLoading(true);
    setError("");
    try {
      if (placement.status === "completed") resetPlacement();
      startPlacement();
      const session = await startRazTest(name.trim(), grade);
      writeStoredRazSession(session);
      navigate("/placement/test");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Placement Test를 시작하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="hub-placement-page hub-raz-page figma-placement-page figma-placement-intro-page">
      <Link aria-label="홈으로" className="figma-placement-back" to="/">
        <ArrowLeft size={20} strokeWidth={2.4} />
      </Link>

      <div className="figma-placement-start-card">
        <aside className="figma-placement-intro-copy">
          <img alt="Raz 읽기 레벨테스트" className="figma-placement-thumbnail" src="/metaon-assets/placement/raz-placement-thumbnail.png" />
          <div>
            <p className="figma-placement-eyebrow">RAZ ADAPTIVE PLACEMENT</p>
            <h1>Raz 읽기 레벨테스트</h1>
            <p className="figma-placement-description">
              글을 읽고 문제를 풀면 현재 읽기 레벨과 추천 Book을 제시합니다.<br />
              쉬우면 더 높은 단계로, 어려우면 더 쉬운 단계로 이동합니다.
            </p>
          </div>
          <div className="figma-placement-tags" aria-label="Placement test areas">
            <span>독해</span><span>어휘</span><span>적응형 레벨</span><span>추천 Book</span>
          </div>
        </aside>

        <div className="figma-placement-form">
          <label className="figma-placement-field">
            <span>이름</span>
            <input
              maxLength={20}
              onChange={(event) => setName(event.target.value)}
              placeholder="이름을 입력하세요"
              type="text"
              value={name}
            />
          </label>

          <div className="figma-placement-field">
            <span>학년</span>
            <div className="figma-placement-grade-grid">
              {gradeOptions.map((option) => (
                <button
                  className={grade === option.value ? "is-selected" : ""}
                  key={option.value}
                  onClick={() => setGrade(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <button className={`figma-placement-audio-check${soundChecked ? " is-selected" : ""}`} type="button" onClick={() => setSoundChecked(true)}>
            <Headphones size={20} strokeWidth={2.2} />
            <span>{soundChecked ? "소리 확인이 완료되었습니다." : "테스트 시작 전 소리를 확인해 주세요."}</span>
            <b>{soundChecked ? "완료" : "소리 확인"}</b>
          </button>

          {error ? <p className="hub-warning-copy">{error}</p> : null}
          {!isAuthenticated ? <p className="hub-warning-copy">로그인 후 Placement Test 결과를 저장할 수 있습니다.</p> : null}

          <button className="figma-placement-start-button" disabled={!name.trim() || !grade || loading} onClick={() => void beginTest()} type="button">
            <PlayCircle size={21} strokeWidth={2.4} />
            {loading ? "테스트 준비 중..." : placement.status === "in-progress" ? "새 테스트 시작" : "테스트 시작하기"}
          </button>
        </div>
      </div>
    </section>
  );
}

export function PlacementTestPage() {
  const navigate = useNavigate();
  const { completePlacement, placement, startPlacement } = useHubState();
  const [session, setSession] = useState<StoredRazSession | null>(() => readStoredRazSession());
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (placement.status === "not-started") startPlacement();
  }, [placement.status, startPlacement]);

  const unit = session?.unit;
  const allAnswered = unit ? unit.items.every((item) => answers[item.id] !== undefined) : false;

  function choose(itemId: string, index: number) {
    setAnswers((current) => ({ ...current, [itemId]: index }));
  }

  async function next() {
    if (!session || !unit || !allAnswered) return;

    setSubmitting(true);
    setError("");
    try {
      const elapsedMs = Date.now() - startRef.current;
      const response = await submitRazUnit(session.sessionId, answers, elapsedMs);
      if ("done" in response && response.done) {
        clearStoredRazSession();
        completePlacement(mapRazResultToPlacement(response));
        navigate("/placement/result");
        return;
      }

      const nextSession = {
        sessionId: session.sessionId,
        unit: response.unit
      };
      setSession(nextSession);
      writeStoredRazSession(nextSession);
      setAnswers({});
      startRef.current = Date.now();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "답안 처리에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!session || !unit) {
    return (
      <section className="hub-placement-page hub-raz-page">
        <div className="hub-empty-state">
          <h1>진행 중인 Placement Test가 없습니다.</h1>
          <p>학년과 이름을 입력한 뒤 새 테스트를 시작해 주세요.</p>
          <Link className="hub-primary-action" to="/placement/intro">
            테스트 시작
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="hub-placement-page hub-raz-page figma-placement-page figma-placement-test-page">
      <header className="figma-placement-test-header">
        <Link aria-label="배치고사 안내로" className="figma-placement-back" to="/placement/intro">
          <ArrowLeft size={20} strokeWidth={2.4} />
        </Link>
        <div>
          <p>RAZ ADAPTIVE PLACEMENT</p>
          <strong>{gradeLabelForUnit(unit)} 읽기 테스트</strong>
        </div>
        <span className="figma-placement-step">지문 {unit.step}</span>
      </header>

      {unit.confirm ? <div className="hub-raz-banner">마지막 확인 문제입니다.</div> : null}

      <div className="figma-placement-test-grid">
        <aside className="figma-placement-passage-card">
          <div className="figma-placement-passage-heading">
            <span>READ</span>
            <h1>지문을 읽어 보세요</h1>
          </div>
          <div className="hub-raz-passage-text" aria-label="Placement Test reading passage">
            {normalizePassageText(unit.passage)}
          </div>
          {isSpeechSupported() ? (
            <button className="figma-placement-listen-button" onClick={() => speak(unit.passage)} type="button">
              <Volume2 size={20} strokeWidth={2.3} />
              지문 듣기
            </button>
          ) : null}
          <dl className="figma-placement-question-summary" aria-label="Placement Test question composition">
            <div><dt>Reading</dt><dd>{countUnitItems(unit, "reading")}</dd></div>
            <div><dt>Vocabulary</dt><dd>{countUnitItems(unit, "vocab")}</dd></div>
            <div><dt>Total</dt><dd>{unit.items.length}</dd></div>
          </dl>
        </aside>

        <div className="hub-raz-question-list figma-placement-question-list">
        {unit.items.map((item, itemIndex) => (
          <article className={`hub-raz-question-card is-${item.skill}`} key={item.id}>
            <div className="hub-raz-question-meta">
              <span className="hub-raz-question-number">{itemIndex + 1}</span>
              <span className={`hub-raz-skill-badge is-${item.skill}`}>{skillLabel(item.skill)}</span>
            </div>
            <p>{item.q}</p>
            <div className="hub-raz-choice-list" role="radiogroup" aria-label={`${itemIndex + 1}번 문항 선택지`}>
              {item.choices.map((choice, choiceIndex) => (
                <button
                  aria-checked={answers[item.id] === choiceIndex}
                  className={`hub-raz-choice${answers[item.id] === choiceIndex ? " is-selected" : ""}`}
                  key={choice}
                  onClick={() => choose(item.id, choiceIndex)}
                  role="radio"
                  type="button"
                >
                  <span>{choice}</span>
                  {answers[item.id] === choiceIndex ? <CheckCircle2 size={18} strokeWidth={2.3} /> : null}
                </button>
              ))}
            </div>
          </article>
        ))}
        </div>
      </div>

      {error ? <p className="hub-warning-copy">{error}</p> : null}

      <div className="hub-placement-actions figma-placement-actions">
        <button className="figma-placement-later-button" type="button" onClick={() => navigate("/")}>
          나중에 이어하기
        </button>
        <button className="figma-placement-next-button" disabled={!allAnswered || submitting} onClick={() => void next()} type="button">
          {submitting ? "채점 중..." : unit.confirm ? "결과 보기" : "다음"}
          <ArrowRight size={18} strokeWidth={2.3} />
        </button>
      </div>
    </section>
  );
}

export function PlacementResultPage() {
  const { placement, resetPlacement, startPlacement } = useHubState();
  const { catalog } = useCatalog();
  const navigate = useNavigate();
  const result = placement.razResult;
  const recommendedStudyRoute = useMemo(
    () => routeForPlacementRecommendation(catalog, result?.recommendation.target),
    [catalog, result?.recommendation.target]
  );

  function retake() {
    clearStoredRazSession();
    resetPlacement();
    startPlacement();
    navigate("/placement/intro");
  }

  if (placement.status !== "completed" || !result) {
    return (
      <section className="hub-placement-page hub-raz-page">
        <div className="hub-empty-state">
          <h1>아직 Placement Test 결과가 없습니다.</h1>
          <p>짧은 테스트를 완료하면 현재 레벨과 추천 학습을 확인할 수 있습니다.</p>
          <Link className="hub-primary-action" to="/placement/intro">
            테스트 시작
          </Link>
        </div>
      </section>
    );
  }

  const { placement: razPlacement, recommendation } = result;
  const readingPct = ratioToPercent(result.areas.reading.ratio);
  const vocabPct = ratioToPercent(result.areas.vocab.ratio);
  const totalCorrect = result.areas.reading.correct + result.areas.vocab.correct;
  const totalQuestions = result.areas.reading.total + result.areas.vocab.total;

  return (
    <section className="hub-placement-page hub-raz-page">
      <Link className="hub-back-link" to="/">
        <ArrowLeft size={17} />
        홈으로
      </Link>

      <div className="hub-raz-result-hero">
        <span className="hub-placement-symbol complete">
          <CheckCircle2 size={32} strokeWidth={2.3} />
        </span>
        <div>
          <p className="hub-kicker">{result.name}님의 읽기 레벨</p>
          <h1>
            {gradeLabel[razPlacement.grade] ?? razPlacement.grade} · Level {razPlacement.level}
          </h1>
          <p>예상 Lexile {lexileText(razPlacement.lexileAvg)}</p>
        </div>
        <div className="hub-placement-score-ring">
          <strong>{totalCorrect}</strong>
          <span>/ {totalQuestions}</span>
        </div>
      </div>

      <p className="hub-raz-disclaimer">Raz Grade는 미국 원어민 기준입니다. 한국 학년과는 다를 수 있습니다.</p>

      <div className="hub-raz-result-grid">
        <div className="hub-raz-result-card">
          <h2>
            <BarChart3 size={20} strokeWidth={2.3} />
            영역별 강약점
          </h2>
          <SkillBar label="독해" percent={readingPct} />
          <SkillBar label="어휘" percent={vocabPct} tone="pink" />
        </div>

        <div className="hub-raz-result-card">
          <h2>
            <BookOpen size={20} strokeWidth={2.3} />
            추천 학습 시작점
          </h2>
          <p>
            {gradeLabel[recommendation.target.grade] ?? recommendation.target.grade} · Level {recommendation.target.level}에서
            시작하는 것을 추천합니다.
          </p>
          <Link className="hub-primary-action" to={recommendedStudyRoute}>
            추천학습 가기
          </Link>
        </div>
      </div>

      <div className="hub-raz-path-card">
        <h2>지문별 결과</h2>
        {result.path.map((step, index) => {
          const mine = Math.round(step.ratio * 100);
          const average = step.globalAccuracy != null ? Math.round(step.globalAccuracy * 100) : null;
          return (
            <div className="hub-raz-path-row" key={`${step.grade}-${step.level}-${index}`}>
              <div>
                <strong>
                  지문 {step.seq ?? index + 1} · {gradeLabel[step.grade] ?? step.grade} · Level {step.level}
                  {step.confirm ? " · 확인" : ""}
                </strong>
                <small>
                  나 {mine}%{average != null ? ` · 평균 ${average}%` : ""}
                </small>
              </div>
              <span style={{ width: `${mine}%` }} />
            </div>
          );
        })}
      </div>

      <div className="hub-raz-reco-grid">
        <RecommendationBucket bucket={recommendation.instructional} highlight />
        <RecommendationBucket bucket={recommendation.challenge} />
      </div>

      <button className="hub-secondary-action" type="button" onClick={retake}>
        <RefreshCcw size={17} strokeWidth={2.3} />
        다시 테스트
      </button>
    </section>
  );
}

function RecommendationBucket({ bucket, highlight = false }: { bucket: RazRecoBucket | null; highlight?: boolean }) {
  if (!bucket) return null;
  return (
    <article className={`hub-raz-reco-card${highlight ? " is-main" : ""}`}>
      <div>
        <strong>{bucket.role}</strong>
        <span>
          {gradeLabel[bucket.grade] ?? bucket.grade} · Level {bucket.level}
        </span>
      </div>
      <ul>
        {bucket.books.map((book) => (
          <li key={book.book_code}>
            <span>{book.title}</span>
            <small>{book.lexile || "-"}</small>
          </li>
        ))}
      </ul>
    </article>
  );
}

function SkillBar({ label, percent, tone = "blue" }: { label: string; percent: number; tone?: "blue" | "pink" }) {
  return (
    <div className="hub-raz-skill-bar">
      <div>
        <span>{label}</span>
        <strong>{percent}%</strong>
      </div>
      <i className={tone} style={{ width: `${percent}%` }} />
    </div>
  );
}

function mapRazResultToPlacement(result: RazResult) {
  const totalCorrect = result.areas.reading.correct + result.areas.vocab.correct;
  const totalQuestions = result.areas.reading.total + result.areas.vocab.total;
  const weakSkills = [
    result.areas.reading.ratio != null && result.areas.reading.ratio < 0.7 ? "reading_comp" : "",
    result.areas.vocab.ratio != null && result.areas.vocab.ratio < 0.7 ? "vocab" : ""
  ].filter(Boolean);

  return {
    score: totalCorrect,
    level: `${gradeLabel[result.placement.grade] ?? result.placement.grade} · Level ${result.placement.level}`,
    recommendedBand: `${gradeLabel[result.recommendation.target.grade] ?? result.recommendation.target.grade} · Level ${result.recommendation.target.level}`,
    recommendedSkills: weakSkills.length > 0 ? weakSkills : ["reading_fluency", "main_idea"],
    razResult: {
      ...result
    }
  };
}

function gradeLabelForUnit(unit: RazUnit) {
  if (unit.grade && unit.level) {
    return `${gradeLabel[unit.grade] ?? unit.grade} · Level ${unit.level}`;
  }
  const firstId = unit.items[0]?.id || "";
  const [, grade, level] = firstId.split(":");
  if (!grade || !level) return "Raz";
  return `${gradeLabel[grade] ?? grade} · Level ${level}`;
}

function normalizePassageText(passage: string): string {
  return passage.replace(/\s+/g, " ").trim();
}

function skillLabel(skill: "reading" | "vocab"): string {
  return skill === "vocab" ? "Vocabulary" : "Reading";
}

function countUnitItems(unit: RazUnit, skill: "reading" | "vocab"): number {
  return unit.items.filter((item) => item.skill === skill).length;
}

function lexileText(value: number | null): string {
  if (value == null) return "-";
  return value < 0 ? `BR${Math.abs(value)}L` : `${value}L`;
}

function ratioToPercent(value: number | null): number {
  return Math.round((value ?? 0) * 100);
}

function readStoredRazSession(): StoredRazSession | null {
  try {
    const raw = window.sessionStorage.getItem(RAZ_SESSION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredRazSession) : null;
  } catch {
    return null;
  }
}

function writeStoredRazSession(session: StoredRazSession) {
  try {
    window.sessionStorage.setItem(RAZ_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Session resume is optional; keep the active React state if storage is unavailable.
  }
}

function clearStoredRazSession() {
  try {
    window.sessionStorage.removeItem(RAZ_SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
}
