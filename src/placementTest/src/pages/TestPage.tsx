import { useEffect, useMemo, useState } from "react";
import { fetchTest, gradeTest } from "../api";
import { SECTION_META } from "../levels";
import QuestionView from "../components/QuestionView";
import ProgressBar from "../components/ProgressBar";
import type { Answers, GradeResult, Question, SectionId, TestPaper } from "../types";

interface Props {
  name: string;
  onDone: (r: GradeResult) => void;
}

interface FlatItem {
  section: SectionId;
  index: number; // 영역 내 순번
  total: number; // 영역 총 문항수
  question: Question;
}

export default function TestPage({ name, onDone }: Props) {
  const [paper, setPaper] = useState<TestPaper | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pos, setPos] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTest().then(setPaper).catch((e) => setError(e.message));
  }, []);

  const items: FlatItem[] = useMemo(() => {
    if (!paper) return [];
    const list: FlatItem[] = [];
    for (const sec of paper.sections) {
      sec.questions.forEach((question, index) => {
        list.push({ section: sec.section, index, total: sec.questions.length, question });
      });
    }
    return list;
  }, [paper]);

  if (error) return <div className="page center"><p className="error">⚠️ {error}</p></div>;
  if (!paper || items.length === 0) return <div className="page center"><p>문제를 불러오는 중… ⏳</p></div>;

  const current = items[pos];
  const picked = answers[current.question.id];
  const isLast = pos === items.length - 1;
  const isSectionStart = current.index === 0;

  function choose(choiceIdx: number) {
    setAnswers((prev) => ({ ...prev, [current.question.id]: choiceIdx }));
  }

  async function next() {
    if (isLast) {
      setSubmitting(true);
      try {
        const result = await gradeTest(name, answers);
        onDone(result);
      } catch (e) {
        setError((e as Error).message);
        setSubmitting(false);
      }
      return;
    }
    setPos((p) => p + 1);
  }

  return (
    <div className="page test-page">
      <div className="test-top">
        <div className="section-tag">
          {SECTION_META[current.section].emoji} {SECTION_META[current.section].label}
          <span className="section-count">
            {current.index + 1} / {current.total}
          </span>
        </div>
        <ProgressBar current={pos + 1} total={items.length} />
      </div>

      {isSectionStart && (
        <div className="section-banner">
          {SECTION_META[current.section].emoji} {SECTION_META[current.section].label} 문제예요!
        </div>
      )}

      <QuestionView question={current.question} picked={picked} onChoose={choose} />

      <button
        className="big-btn primary"
        onClick={next}
        disabled={picked === undefined || submitting}
      >
        {submitting ? "채점 중… ⏳" : isLast ? "결과 보기 🎉" : "다음 ➡️"}
      </button>
    </div>
  );
}
