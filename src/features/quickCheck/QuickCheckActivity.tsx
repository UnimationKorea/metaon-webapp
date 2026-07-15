import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode
} from "react";
import {
  createEmptyQuickCheckAnswer,
  isQuickCheckAnswerComplete,
  scoreQuickCheckAnswer,
  scoreQuickCheckAttempt
} from "../../../shared/quickCheckScoring.mjs";
import { getQuickCheckQuiz, submitQuickCheck } from "../../api/uniplanetApi";
import { ActivityPageArrowImage, ActivitySoundImage } from "../../components/ActivityImageControls";
import type { ActivityRendererContext } from "../../types/metaonTypes";
import {
  normalizeQuickCheckLoadResponse,
  normalizeQuickCheckSubmissionResponse
} from "./quickCheckAdapter";
import type {
  QuickCheckAnswer,
  QuickCheckAnswerRecord,
  QuickCheckOption,
  QuickCheckQuestion,
  QuickCheckSubmissionAnswer,
  QuickCheckSubmissionResult
} from "./quickCheckTypes";
import "./quickCheck.css";

type QuickCheckMode = "answering" | "result" | "review";

export function QuickCheckActivity({ context }: { context: ActivityRendererContext }) {
  const [questions, setQuestions] = useState<QuickCheckQuestion[]>([]);
  const [answers, setAnswers] = useState<QuickCheckAnswerRecord>({});
  const [attemptId, setAttemptId] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mode, setMode] = useState<QuickCheckMode>("answering");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [status, setStatus] = useState("");
  const [submission, setSubmission] = useState<QuickCheckSubmissionResult>();
  const [reloadKey, setReloadKey] = useState(0);
  const submitLockRef = useRef(false);
  const loadStartedAtRef = useRef(Date.now());
  const answerMetadataRef = useRef<Record<string, { timeMs: number; answeredAt: string }>>({});
  const dayIdx = context.day?.dayIdx;

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError("");
    setStatus("");
    setQuestions([]);
    setAnswers({});
    setSubmission(undefined);
    setAttemptId("");
    setCurrentIndex(0);
    setMode("answering");
    submitLockRef.current = false;
    answerMetadataRef.current = {};
    loadStartedAtRef.current = Date.now();

    if (!dayIdx) {
      setIsLoading(false);
      setLoadError("Quick Check day information is missing.");
      return undefined;
    }

    getQuickCheckQuiz({
      day_idx: dayIdx,
      book_idx: context.packageMeta?.bookIdx,
      book_data_ver: String(context.packageMeta?.cacheVersion ?? ""),
      lesson_num: context.day?.lesson,
      day_num: context.day?.day,
      act_code: 65,
      act_num: context.activity?.actNum,
      act_idx: context.activity?.actIdx
    })
      .then((raw) => {
        if (!active) return;
        const normalized = normalizeQuickCheckLoadResponse(raw);
        if (normalized.resultCode !== 1) {
          throw new Error(normalized.resultMessage || "Quick Check API returned an error.");
        }
        if (normalized.questions.length === 0) {
          setLoadError("No Quick Check questions are available for this day.");
          return;
        }

        const initialAnswers = Object.fromEntries(
          normalized.questions.map((question) => [question.id, createEmptyQuickCheckAnswer(question)])
        );
        setQuestions(normalized.questions);
        setAnswers(initialAnswers);
        setAttemptId(normalized.attemptId);
      })
      .catch((caught) => {
        if (active) setLoadError(caught instanceof Error ? caught.message : String(caught));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [context.activity?.actIdx, context.activity?.actNum, context.day?.day, context.day?.lesson, context.packageMeta?.bookIdx, context.packageMeta?.cacheVersion, dayIdx, reloadKey]);

  const currentQuestion = questions[currentIndex];
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;
  const localScore = useMemo(() => scoreQuickCheckAttempt(questions, answers), [answers, questions]);

  function updateAnswer(question: QuickCheckQuestion, nextAnswer: QuickCheckAnswer) {
    if (mode !== "answering") return;
    answerMetadataRef.current[question.id] = {
      timeMs: Math.max(0, Date.now() - loadStartedAtRef.current),
      answeredAt: new Date().toISOString()
    };
    setAnswers((current) => ({ ...current, [question.id]: nextAnswer }));
    setStatus("");
  }

  function goToQuestion(nextIndex: number) {
    setCurrentIndex(Math.max(0, Math.min(nextIndex, questions.length - 1)));
  }

  async function submit() {
    if (submitLockRef.current || submission) return;

    const firstIncomplete = questions.findIndex((question) => !isQuickCheckAnswerComplete(question, answers[question.id]));
    if (firstIncomplete >= 0) {
      goToQuestion(firstIncomplete);
      setStatus(`Answer question ${firstIncomplete + 1} before submitting.`);
      return;
    }
    if (!attemptId) {
      setStatus("Quick Check attempt is not ready. Reload the questions and try again.");
      return;
    }
    if (!context.studyLogIdx) {
      setStatus("Study start log is not ready yet.");
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);
    setStatus("");
    try {
      const submittedAnswers: QuickCheckSubmissionAnswer[] = questions.map((question) => {
        const metadata = answerMetadataRef.current[question.id];
        return {
          q_idx: question.qIdx,
          answer: answers[question.id] ?? createEmptyQuickCheckAnswer(question),
          time_ms: metadata?.timeMs ?? 0,
          answered_at: metadata?.answeredAt ?? new Date().toISOString()
        };
      });
      const raw = await submitQuickCheck({
        attempt_id: attemptId,
        log_idx: context.studyLogIdx,
        answers: submittedAnswers,
        context: {
          book_idx: context.packageMeta?.bookIdx,
          book_data_ver: String(context.packageMeta?.cacheVersion ?? ""),
          lesson_num: context.day?.lesson,
          day_num: context.day?.day,
          act_code: 65,
          act_num: context.activity?.actNum
        }
      });
      const normalized = normalizeQuickCheckSubmissionResponse(raw, questions, answers);
      if (normalized.resultCode !== 1) {
        throw new Error(normalized.resultMessage || "Quick Check submission failed.");
      }
      setSubmission(normalized);
      setMode("result");
      setCurrentIndex(0);
    } catch (caught) {
      submitLockRef.current = false;
      setStatus(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <QuickCheckState title="Loading Quick Check" detail="Preparing the questions." />;
  }

  if (loadError || questions.length === 0 || !currentQuestion || !currentAnswer) {
    return (
      <QuickCheckState title="Quick Check unavailable" detail={loadError || "No questions were returned."}>
        <button className="quick-check-v2-primary" type="button" onClick={() => setReloadKey((value) => value + 1)}>
          Retry
        </button>
      </QuickCheckState>
    );
  }

  if (mode === "result" && submission) {
    return (
      <QuickCheckResult
        questions={questions}
        result={submission}
        onReview={(index) => {
          setCurrentIndex(index);
          setMode("review");
        }}
      />
    );
  }

  const isReview = mode === "review";
  const currentCorrect = scoreQuickCheckAnswer(currentQuestion, currentAnswer);

  return (
    <section className="activity-frame unity-activity-frame quick-check-v2-frame">
      <div className="quick-check-v2-shell">
        <header className="quick-check-v2-progress">
          <div className="quick-check-v2-counter" aria-label={`Question ${currentIndex + 1} of ${questions.length}`}>
            <strong>Q{currentIndex + 1}</strong>
            <span>/ {questions.length}</span>
          </div>
          <nav aria-label="Quick Check questions" className="quick-check-v2-dots">
            {questions.map((question, index) => {
              const complete = isQuickCheckAnswerComplete(question, answers[question.id]);
              return (
                <button
                  aria-current={index === currentIndex ? "step" : undefined}
                  aria-label={`Question ${index + 1}${complete ? ", answered" : ""}`}
                  className={`${index === currentIndex ? "is-current" : ""}${complete ? " is-complete" : ""}`}
                  key={question.id}
                  onClick={() => goToQuestion(index)}
                  type="button"
                >
                  {index + 1}
                </button>
              );
            })}
          </nav>
          {isReview ? (
            <button className="quick-check-v2-result-return" type="button" onClick={() => setMode("result")}>
              Results
            </button>
          ) : <span className="quick-check-v2-type">Type {currentQuestion.unityType}</span>}
        </header>

        <main className={`quick-check-v2-question${isReview ? currentCorrect ? " is-correct" : " is-wrong" : ""}`}>
          <div className="quick-check-v2-prompt-row">
            <div>
              {currentQuestion.exampleText ? <p className="quick-check-v2-example">{currentQuestion.exampleText}</p> : null}
              <h2>{currentQuestion.question || `Question ${currentIndex + 1}`}</h2>
              {currentQuestion.questionKo ? <p className="quick-check-v2-ko">{currentQuestion.questionKo}</p> : null}
            </div>
            <QuickCheckSoundButton url={currentQuestion.questionSoundUrl || currentQuestion.exampleSoundUrl} />
          </div>

          <div className="quick-check-v2-content">
            {currentQuestion.exampleImageUrl ? (
              <img className="quick-check-v2-example-image" src={currentQuestion.exampleImageUrl} alt="Question reference" />
            ) : null}

            <QuickCheckQuestionInput
              answer={currentAnswer}
              isReview={isReview}
              onChange={(answer) => updateAnswer(currentQuestion, answer)}
              question={currentQuestion}
            />
          </div>

          {isReview ? (
            <div className={`quick-check-v2-review-state${currentCorrect ? " is-correct" : " is-wrong"}`}>
              <strong>{currentCorrect ? "O Correct" : "X Incorrect"}</strong>
              <span>Correct answer: {correctAnswerLabel(currentQuestion)}</span>
            </div>
          ) : null}
        </main>

        <button
          aria-label="Previous question"
          className="quick-check-v2-edge-nav previous"
          disabled={currentIndex === 0}
          onClick={() => goToQuestion(currentIndex - 1)}
          type="button"
        >
          <ActivityPageArrowImage direction="prev" />
        </button>
        <button
          aria-label="Next question"
          className="quick-check-v2-edge-nav next"
          disabled={currentIndex === questions.length - 1}
          onClick={() => goToQuestion(currentIndex + 1)}
          type="button"
        >
          <ActivityPageArrowImage direction="next" />
        </button>

        <footer className="quick-check-v2-footer">
          <p role="status">{status || (isReview ? `${localScore.correctCount} of ${localScore.total} correct` : `${localScore.items.filter((item) => item.complete).length} of ${questions.length} answered`)}</p>
          {!isReview ? (
            <button
              className="quick-check-v2-primary"
              disabled={isSubmitting}
              onClick={() => void submit()}
              type="button"
            >
              {isSubmitting ? "Submitting..." : "Submit Quick Check"}
            </button>
          ) : null}
        </footer>
      </div>
    </section>
  );
}

function QuickCheckQuestionInput({
  question,
  answer,
  isReview,
  onChange
}: {
  question: QuickCheckQuestion;
  answer: QuickCheckAnswer;
  isReview: boolean;
  onChange: (answer: QuickCheckAnswer) => void;
}) {
  if (question.kind === "sentence-input" && answer.mode === "text") {
    return (
      <div className="quick-check-v2-sentence-input">
        <label htmlFor={`quick-check-answer-${question.id}`}>Type the complete sentence.</label>
        <textarea
          aria-label="Sentence answer"
          disabled={isReview}
          id={`quick-check-answer-${question.id}`}
          onChange={(event) => onChange({ mode: "text", value: event.target.value })}
          placeholder="Enter the sentence exactly"
          rows={3}
          value={answer.value}
        />
        <small>Capitalization and spaces are checked exactly.</small>
      </div>
    );
  }

  if (question.kind === "multi-select" && answer.mode === "composite") {
    return (
      <div className="quick-check-v2-composite-list">
        {question.subItems.map((item, itemIndex) => (
          <section className="quick-check-v2-subquestion" key={item.id}>
            <strong>{item.prompt || `Item ${itemIndex + 1}`}</strong>
            <div className="quick-check-v2-options compact is-one-column">
              {(item.options || []).map((option) => (
                <OptionButton
                  isReview={isReview}
                  key={option.index}
                  onClick={() => onChange(updateCompositeAnswer(answer, itemIndex, option.index))}
                  option={option}
                  selected={answer.selectedIndexes[itemIndex] === option.index}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  if (question.kind === "connect-line" && answer.mode === "composite") {
    return (
      <div className="quick-check-v2-connect" aria-label="Connect line answers">
        {question.subItems.map((item, itemIndex) => (
          <section className="quick-check-v2-connect-row" key={item.id}>
            <div className="quick-check-v2-connect-source">
              {item.imageUrl ? <img src={item.imageUrl} alt="" /> : null}
              <strong>{item.prompt || `Item ${itemIndex + 1}`}</strong>
            </div>
            <span aria-hidden="true" className="quick-check-v2-connect-line" />
            <div className="quick-check-v2-connect-targets">
              {question.options.map((option) => (
                <OptionButton
                  isReview={isReview}
                  key={option.index}
                  onClick={() => onChange(updateCompositeAnswer(answer, itemIndex, option.index))}
                  option={option}
                  selected={answer.selectedIndexes[itemIndex] === option.index}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  if ((question.kind === "drag-alphabet" || question.kind === "drag-sentence") && answer.mode === "composite") {
    return (
      <DragFillQuestion
        answer={answer}
        isReview={isReview}
        onChange={onChange}
        question={question}
      />
    );
  }

  if (question.kind === "drag-image" && answer.mode === "single") {
    const draggable = question.options[0];
    return (
      <div className="quick-check-v2-drag-image">
        <div className="quick-check-v2-drag-source">
          <span>Place this item in the correct position.</span>
          <OptionContent option={draggable} />
        </div>
        <div className="quick-check-v2-drag-slots">
          {question.subItems.map((item, slotIndex) => (
            <button
              aria-pressed={answer.selectedIndex === slotIndex}
              className={answer.selectedIndex === slotIndex ? "is-selected" : ""}
              disabled={isReview}
              key={item.id}
              onClick={() => onChange({ mode: "single", selectedIndex: slotIndex })}
              type="button"
            >
              {item.imageUrl ? <img src={item.imageUrl} alt="" /> : null}
              <span>{item.prompt || `Position ${slotIndex + 1}`}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (answer.mode === "single") {
    return (
      <div className="quick-check-v2-options is-one-column">
        {question.options.map((option) => (
          <OptionButton
            isReview={isReview}
            key={option.index}
            onClick={() => onChange({ mode: "single", selectedIndex: option.index })}
            option={option}
            selected={answer.selectedIndex === option.index}
          />
        ))}
      </div>
    );
  }

  return <p className="quick-check-v2-empty">This question format has no answer data.</p>;
}

function DragFillQuestion({
  question,
  answer,
  isReview,
  onChange
}: {
  question: QuickCheckQuestion;
  answer: Extract<QuickCheckAnswer, { mode: "composite" }>;
  isReview: boolean;
  onChange: (answer: QuickCheckAnswer) => void;
}) {
  const blankOrderByToken = new Map(question.blankPositions.map((tokenIndex, blankIndex) => [tokenIndex, blankIndex]));
  const usedIndexes = new Set(answer.selectedIndexes.filter((index): index is number => index != null));

  function fillFirstOpen(optionIndex: number) {
    const openIndex = answer.selectedIndexes.findIndex((selection) => selection == null);
    if (openIndex >= 0) onChange(updateCompositeAnswer(answer, openIndex, optionIndex));
  }

  function dropInto(event: DragEvent<HTMLButtonElement>, blankIndex: number) {
    event.preventDefault();
    const optionIndex = Number(event.dataTransfer.getData("application/x-quick-check-option"));
    if (Number.isInteger(optionIndex)) onChange(updateCompositeAnswer(answer, blankIndex, optionIndex));
  }

  return (
    <div className={`quick-check-v2-fill${question.kind === "drag-alphabet" ? " is-alphabet" : ""}`}>
      <div className="quick-check-v2-fill-sentence" aria-label="Question blanks">
        {question.tokens.map((token, tokenIndex) => {
          const blankIndex = blankOrderByToken.get(tokenIndex);
          if (blankIndex == null) return <span key={`${tokenIndex}:${token}`}>{token}</span>;
          const selectedIndex = answer.selectedIndexes[blankIndex];
          const selectedOption = question.options.find((option) => option.index === selectedIndex);
          return (
            <button
              aria-label={`Blank ${blankIndex + 1}`}
              className={selectedOption ? "is-filled" : ""}
              disabled={isReview}
              key={`blank:${tokenIndex}`}
              onClick={() => onChange(updateCompositeAnswer(answer, blankIndex, null))}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => dropInto(event, blankIndex)}
              type="button"
            >
              {selectedOption ? <OptionContent option={selectedOption} /> : "_"}
            </button>
          );
        })}
      </div>
      <div className="quick-check-v2-bank" aria-label="Answer choices">
        {question.options.map((option) => (
          <button
            disabled={isReview || usedIndexes.has(option.index)}
            draggable={!isReview && !usedIndexes.has(option.index)}
            key={option.index}
            onClick={() => fillFirstOpen(option.index)}
            onDragStart={(event) => event.dataTransfer.setData("application/x-quick-check-option", String(option.index))}
            type="button"
          >
            <OptionContent option={option} />
          </button>
        ))}
      </div>
    </div>
  );
}

function OptionButton({
  option,
  selected,
  isReview,
  onClick
}: {
  option: QuickCheckOption;
  selected: boolean;
  isReview: boolean;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={selected}
      className={selected ? "is-selected" : ""}
      disabled={isReview}
      onClick={onClick}
      type="button"
    >
      <span className="quick-check-v2-option-index">{String.fromCharCode(65 + option.index)}</span>
      <OptionContent option={option} />
    </button>
  );
}

function OptionContent({ option }: { option?: QuickCheckOption }) {
  if (!option) return <span>Missing item</span>;
  return (
    <>
      {option.imageUrl ? <img src={option.imageUrl} alt={option.label || "Answer option"} /> : null}
      <span>{option.label || (option.audioUrl ? "Audio option" : `Option ${option.index + 1}`)}</span>
    </>
  );
}

function QuickCheckSoundButton({ url }: { url?: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  if (!url) return null;
  return (
    <>
      <button
        aria-label="Play question audio"
        className="quick-check-v2-sound"
        onClick={() => {
          const audio = audioRef.current;
          if (!audio) return;
          audio.currentTime = 0;
          void audio.play();
        }}
        type="button"
      >
        <ActivitySoundImage />
      </button>
      <audio ref={audioRef} preload="auto" src={url} />
    </>
  );
}

function QuickCheckResult({
  questions,
  result,
  onReview
}: {
  questions: QuickCheckQuestion[];
  result: QuickCheckSubmissionResult;
  onReview: (index: number) => void;
}) {
  return (
    <section className="activity-frame unity-activity-frame quick-check-v2-frame">
      <div className="quick-check-v2-shell quick-check-v2-results">
        <header>
          <div>
            <span>Quick Check complete</span>
            <h2>{result.correctCount} / {result.total}</h2>
          </div>
          <p>Question results and points are shown separately.</p>
        </header>
        <div className="quick-check-v2-score-cards">
          <article><span>Correct</span><strong>{result.correctCount} / {result.total}</strong></article>
          <article><span>New points</span><strong>+{result.newPoints}</strong></article>
          <article><span>Existing points</span><strong>{result.existingPoints}</strong></article>
          <article><span>Current points</span><strong>{result.currentPoints}</strong></article>
        </div>
        <ul className="quick-check-v2-result-grid" aria-label="Question results">
          {questions.map((question, index) => {
            const item = result.items[index];
            const correct = Boolean(item?.correct);
            const pointLabel = item?.pointState === "earned-now"
              ? `+${item.point} new`
              : item?.pointState === "earned-before"
                ? "earned before"
                : "no point";
            return (
              <li
                className={correct ? "is-correct" : "is-wrong"}
                key={question.id}
              >
                <button aria-label={`Q${index + 1} ${correct ? "O" : "X"} ${pointLabel}`} onClick={() => onReview(index)} type="button">
                  <span>Q{index + 1}</span>
                  <strong>{correct ? "O" : "X"}</strong>
                  <small>{pointLabel}</small>
                </button>
              </li>
            );
          })}
        </ul>
        <button className="quick-check-v2-primary" type="button" onClick={() => onReview(0)}>
          Review answers
        </button>
      </div>
    </section>
  );
}

function QuickCheckState({ title, detail, children }: { title: string; detail: string; children?: ReactNode }) {
  return (
    <section className="activity-frame unity-activity-frame quick-check-v2-frame">
      <div className="quick-check-v2-state">
        <strong>{title}</strong>
        <p>{detail}</p>
        {children}
      </div>
    </section>
  );
}

function updateCompositeAnswer(
  answer: Extract<QuickCheckAnswer, { mode: "composite" }>,
  itemIndex: number,
  selectedIndex: number | null
): QuickCheckAnswer {
  const selectedIndexes = [...answer.selectedIndexes];
  selectedIndexes[itemIndex] = selectedIndex;
  return { mode: "composite", selectedIndexes };
}

function correctAnswerLabel(question: QuickCheckQuestion): string {
  if (question.correctAnswer.mode === "text") return question.correctAnswer.value;
  if (question.correctAnswer.mode === "single") {
    if (question.kind === "drag-image") {
      const slot = question.subItems[question.correctAnswer.selectedIndex];
      return slot?.prompt || `Position ${question.correctAnswer.selectedIndex + 1}`;
    }
    return optionLabel(question.options, question.correctAnswer.selectedIndex);
  }
  return question.correctAnswer.selectedIndexes
    .map((selectedIndex, itemIndex) => {
      const options = question.kind === "multi-select"
        ? question.subItems[itemIndex]?.options || []
        : question.options;
      return optionLabel(options, selectedIndex);
    })
    .join(" / ");
}

function optionLabel(options: QuickCheckOption[], selectedIndex: number): string {
  const option = options.find((candidate) => candidate.index === selectedIndex);
  return option?.label || `Option ${selectedIndex + 1}`;
}
