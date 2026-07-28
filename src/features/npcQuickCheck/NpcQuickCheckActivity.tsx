import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  createEmptyQuickCheckAnswer,
  isQuickCheckAnswerComplete,
  scoreQuickCheckAnswer,
  scoreQuickCheckAttempt
} from "../../../shared/quickCheckScoring.mjs";
import type { NpcQuickCheckScenario } from "../../../shared/npcQuickCheckScenario.mjs";
import { createNpcQuickCheckLaunch, type NpcQuickCheckLaunch } from "../../api/npcQuickCheck";
import type { ActivityRendererContext } from "../../types/metaonTypes";
import {
  NPC_QUICK_CHECK_PROTOCOL_VERSION,
  contentRefCorrect,
  genericHintForQuestion,
  normalizeViewerAnswer,
  npcQuickCheckClientEventId,
  parseNpcQuickCheckRpcCall,
  sanitizeQuickCheckQuestions
} from "./npcQuickCheckProtocol";
import { loadNpcQuickCheckResource, type NpcQuickCheckResourceBundle } from "./npcQuickCheckResourceAdapter";
import { loadNpcQuickCheck2Resource } from "./npcQuickCheck2ResourceAdapter";
import { MetaOnActivityCode, normalizeActivityCode } from "../../services/activityCodes";
import {
  npcScenarioNode,
  npcScenarioQuestionNode,
  resolveNpcScenarioTransition
} from "./npcQuickCheckScenarioRuntime";
import type {
  QuickCheckAnswer,
  QuickCheckAnswerRecord,
  QuickCheckQuestion,
  QuickCheckSubmissionResult
} from "../quickCheck/quickCheckTypes";
import "./npcQuickCheck.css";

type AnswerMetadata = { answeredAt: string; timeMs: number };
type QuestionFeedback = { complete: true; correct: boolean; nextNodeId?: string; questionId: string };

export function NpcQuickCheckActivity({ context }: { context: ActivityRendererContext }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const contextRef = useRef(context);
  const questionsRef = useRef<QuickCheckQuestion[]>([]);
  const answersRef = useRef<QuickCheckAnswerRecord>({});
  const answerMetadataRef = useRef<Record<string, AnswerMetadata>>({});
  const feedbackRef = useRef<Record<string, QuestionFeedback>>({});
  const questionStartedAtRef = useRef<Record<string, number>>({});
  const completionLockRef = useRef(false);
  const completionResultRef = useRef<QuickCheckSubmissionResult>();
  const scenarioRef = useRef<NpcQuickCheckScenario | null>(null);
  const [bundle, setBundle] = useState<NpcQuickCheckResourceBundle>();
  const [launch, setLaunch] = useState<NpcQuickCheckLaunch>();
  const [loadError, setLoadError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const dayIdx = context.day?.dayIdx;
  const actIdx = context.activity?.actIdx;
  const bookIdx = context.packageMeta?.bookIdx;
  const studyLogIdx = context.studyLogIdx;

  contextRef.current = context;

  useEffect(() => {
    let active = true;
    const sourceContext = contextRef.current;
    if (!dayIdx || !actIdx || !bookIdx || !studyLogIdx) {
      setIsLoading(true);
      return () => {
        active = false;
      };
    }
    const scopedActIdx = Number(actIdx);
    const scopedBookIdx = Number(bookIdx);
    const scopedDayIdx = Number(dayIdx);
    const scopedStudyLogIdx = Number(studyLogIdx);

    setIsLoading(true);
    setLoadError("");
    setBundle(undefined);
    setLaunch(undefined);
    completionLockRef.current = false;
    completionResultRef.current = undefined;
    feedbackRef.current = {};
    questionStartedAtRef.current = {};
    scenarioRef.current = null;

    async function prepare() {
      const isNpcQuickCheck2 =
        normalizeActivityCode(sourceContext.activity?.activityCode) === MetaOnActivityCode.NpcQuickCheck2;
      const loadResource = isNpcQuickCheck2 ? loadNpcQuickCheck2Resource : loadNpcQuickCheckResource;
      const nextBundle = await loadResource(sourceContext);
      const initialAnswers = Object.fromEntries(
        nextBundle.questions.map((question) => [question.id, createEmptyQuickCheckAnswer(question)])
      );
      const nextLaunch = await createNpcQuickCheckLaunch({
        actIdx: scopedActIdx,
        attemptId: nextBundle.attemptId,
        bookCode: sourceContext.packageMeta?.bookId,
        bookIdx: scopedBookIdx,
        dayIdx: scopedDayIdx,
        logIdx: scopedStudyLogIdx
      });
      if (!active) return;

      questionsRef.current = nextBundle.questions;
      answersRef.current = initialAnswers;
      scenarioRef.current = nextBundle.scenario;
      setBundle(nextBundle);
      setLaunch(nextLaunch);
    }

    void prepare()
      .catch((caught) => {
        if (active) setLoadError(caught instanceof Error ? caught.message : String(caught));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [
    actIdx,
    bookIdx,
    context.day?.day,
    context.day?.lesson,
    context.packageMeta?.bookId,
    context.packageMeta?.key,
    dayIdx,
    studyLogIdx
  ]);

  useEffect(() => {
    if (!launch || !bundle || !studyLogIdx) return undefined;
    const activeLaunch = launch;
    const activeBundle = bundle;

    async function handleRpc(method: string, params: Record<string, unknown>) {
      const questions = questionsRef.current;
      const scenario = scenarioRef.current;
      if (!scenario) throw new Error("NPCQHK01 scenario is unavailable.");

      if (method === "activity.bootstrap") {
        recordEvent(context, {
          action: "npc_intro",
          item_type: "activity",
          item_idx: context.activity?.actIdx ?? null,
          extra: eventExtra(activeBundle.attemptId, "activity", "npc_intro", {
            protocol_version: NPC_QUICK_CHECK_PROTOCOL_VERSION
          })
        });
        recordScenarioEvent(context, activeBundle.attemptId, scenario, "scenario_start", scenario.startNodeId, {
          scenario_version: scenario.version
        });
        return {
          protocolVersion: NPC_QUICK_CHECK_PROTOCOL_VERSION,
          learningContextToken: activeLaunch.launchToken,
          session: {
            activityCode: context.activity?.activityCode,
            attemptId: activeBundle.attemptId,
            bookCode: context.packageMeta?.bookId,
            bookIdx,
            title: context.activity?.title || "NPC Quick Check"
          },
          scenario,
          questions: sanitizeQuickCheckQuestions(questions),
          audioAssets: activeBundle.audioAssets
        };
      }

      if (method === "activity.scenarioNodeViewed") {
        const node = npcScenarioNode(scenario, String(params.nodeId || ""));
        if (!node) throw new Error("Unknown NPCQHK01 scenario node.");
        recordScenarioEvent(
          context,
          activeBundle.attemptId,
          scenario,
          node.type === "dialogue" ? "dialogue_view" : "scenario_node_view",
          node.id,
          { node_type: node.type, q_idx: node.type === "question" ? node.qIdx : undefined }
        );
        return { ok: true };
      }

      if (method === "activity.scenarioAdvance") {
        const fromNode = npcScenarioNode(scenario, String(params.fromNodeId || ""));
        const requestedTarget = String(params.toNodeId || "");
        if (!fromNode) throw new Error("Unknown NPCQHK01 scenario transition.");
        const linkedQuestion = fromNode.type === "question"
          ? questions.find((item) => item.qIdx === fromNode.qIdx)
          : undefined;
        const transition = resolveNpcScenarioTransition(scenario, fromNode.id, linkedQuestion ? feedbackRef.current[linkedQuestion.id]?.correct : undefined);
        if (!transition.nextNodeId || requestedTarget !== transition.nextNodeId || !npcScenarioNode(scenario, transition.nextNodeId)) {
          throw new Error("Invalid NPCQHK01 scenario transition target.");
        }
        recordScenarioEvent(context, activeBundle.attemptId, scenario, "branch_taken", fromNode.id, {
          outcome: transition.outcome,
          to_node_id: transition.nextNodeId
        });
        return { nextNodeId: transition.nextNodeId };
      }

      const questionId = String(params.questionId || "");
      const question = questions.find((item) => item.id === questionId);
      if (method === "activity.questionViewed") {
        if (!question) throw new Error("Unknown NPCQHK01 question.");
        questionStartedAtRef.current[question.id] = Date.now();
        recordQuestionEvent(context, activeBundle.attemptId, question, "question_view");
        return { ok: true };
      }

      if (method === "activity.requestHint") {
        if (!question) throw new Error("Unknown NPCQHK01 question.");
        recordQuestionEvent(context, activeBundle.attemptId, question, "hint_request", { hints_used: 1 });
        const questionNode = npcScenarioQuestionNode(scenario, question.qIdx);
        const hintNode = npcScenarioNode(scenario, questionNode?.hintNodeId || "");
        const hint = questionNode?.hintText || (hintNode?.type === "dialogue" ? hintNode.text : "") || genericHintForQuestion(question);
        return { hint };
      }

      if (method === "activity.submitAnswer") {
        if (!question) throw new Error("Unknown NPCQHK01 question.");
        const existing = feedbackRef.current[question.id];
        if (existing) return existing;

        const answer = normalizeViewerAnswer(question, params.answer);
        if (!isQuickCheckAnswerComplete(question, answer)) {
          throw new Error("Complete every answer field before submitting.");
        }
        const answeredAt = new Date().toISOString();
        const timeMs = Math.max(0, Date.now() - (questionStartedAtRef.current[question.id] || Date.now()));
        const correct = scoreQuickCheckAnswer(question, answer);
        answersRef.current = { ...answersRef.current, [question.id]: answer };
        answerMetadataRef.current[question.id] = { answeredAt, timeMs };
        const questionNode = npcScenarioQuestionNode(scenario, question.qIdx);
        const feedback: QuestionFeedback = {
          complete: true,
          correct,
          questionId: question.id,
          nextNodeId: questionNode ? (correct ? questionNode.correctNextNodeId : questionNode.incorrectNextNodeId) : undefined
        };
        feedbackRef.current[question.id] = feedback;
        recordQuestionEvent(context, activeBundle.attemptId, question, "answer_submit", {
          time_ms: timeMs,
          extra: { answer_mode: answer.mode }
        });
        recordQuestionEvent(context, activeBundle.attemptId, question, "answer_result", {
          correct: correct ? 1 : 0,
          time_ms: timeMs
        });
        recordContentMasteryEvents(context, activeBundle.attemptId, question, answer, correct, timeMs);
        return feedback;
      }

      if (method === "activity.complete") {
        if (completionResultRef.current) return completionResultRef.current;
        if (completionLockRef.current) throw new Error("NPCQHK01 completion is already in progress.");
        if (Object.keys(feedbackRef.current).length !== questions.length) {
          throw new Error("Answer every question before completing the activity.");
        }
        const endingNode = npcScenarioNode(scenario, String(params.scenarioNodeId || ""));
        if (!endingNode || endingNode.type !== "ending") {
          throw new Error("Reach an NPCQHK01 scenario ending before completing the activity.");
        }

        completionLockRef.current = true;
        const score = scoreQuickCheckAttempt(questions, answersRef.current);
        const result: QuickCheckSubmissionResult = {
          resultCode: 1,
          resultMessage: "NPCQHK01 completed. This resource-based activity does not submit quizaccept.",
          total: score.total,
          correctCount: score.correctCount,
          newPoints: 0,
          currentPoints: 0,
          existingPoints: 0,
          lessonPoints: 0,
          level: 0,
          gradedBy: "client-fallback",
          duplicate: false,
          items: score.items.map((item) => ({
            questionId: item.questionId,
            qIdx: item.qIdx,
            correct: item.correct,
            point: 0,
            pointState: "none" as const
          }))
        };
        completionResultRef.current = result;
        recordEvent(context, {
          action: "activity_submit",
          item_type: "activity",
          item_idx: context.activity?.actIdx ?? null,
          correct: result.correctCount === result.total ? 1 : 0,
          score: result.total > 0 ? Math.round((result.correctCount / result.total) * 100) : 0,
          extra: eventExtra(activeBundle.attemptId, "activity", "activity_submit", {
            correct_count: result.correctCount,
            total: result.total
          })
        });
        recordScenarioEvent(context, activeBundle.attemptId, scenario, "scenario_complete", endingNode.id, {
          correct_count: result.correctCount,
          total: result.total
        });
        await context.onComplete?.({
          correctCount: result.correctCount,
          newPoints: 0,
          score: result.total > 0 ? Math.round((result.correctCount / result.total) * 100) : 0,
          total: result.total
        });
        return result;
      }

      if (method === "activity.exit") {
        await context.onExit?.();
        return { ok: true };
      }

      throw new Error(`Unsupported NPCQHK01 RPC method: ${method}`);
    }

    function handleMessage(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow || event.origin !== activeLaunch.viewerOrigin) return;
      const message = parseNpcQuickCheckRpcCall(event.data);
      if (!message) return;
      void handleRpc(message.method, message.params)
        .then((result) => {
          iframeRef.current?.contentWindow?.postMessage({ type: "rpc_result", id: message.id, result }, activeLaunch.viewerOrigin);
        })
        .catch((caught) => {
          iframeRef.current?.contentWindow?.postMessage({
            type: "rpc_result",
            id: message.id,
            error: caught instanceof Error ? caught.message : String(caught)
          }, activeLaunch.viewerOrigin);
        });
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [bookIdx, bundle, context, launch, studyLogIdx]);

  if (isLoading) {
    return <NpcQuickCheckState title="NPCQHK01 준비 중" detail="캐시된 시나리오와 음성 리소스를 불러오고 있습니다." />;
  }

  if (loadError || !launch || !bundle) {
    return <NpcQuickCheckState title="NPCQHK01을 시작할 수 없습니다" detail={loadError || "Viewer launch information is missing."} />;
  }

  return (
    <section className="activity-frame unity-activity-frame npc-quick-check-frame">
      <iframe
        ref={iframeRef}
        allow="autoplay; microphone; fullscreen"
        allowFullScreen
        className="npc-quick-check-iframe"
        referrerPolicy="no-referrer"
        sandbox="allow-scripts allow-forms allow-same-origin allow-pointer-lock"
        src={launch.iframeUrl}
        title="NPC Quick Check"
      />
    </section>
  );
}

function NpcQuickCheckState({ children, detail, title }: { children?: ReactNode; detail: string; title: string }) {
  return (
    <section className="activity-frame unity-activity-frame npc-quick-check-frame">
      <div className="npc-quick-check-state">
        <span className="npc-quick-check-state-orbit" aria-hidden="true" />
        <strong>{title}</strong>
        <p>{detail}</p>
        {children}
      </div>
    </section>
  );
}

function recordContentMasteryEvents(
  context: ActivityRendererContext,
  attemptId: string,
  question: QuickCheckQuestion,
  answer: QuickCheckAnswer,
  questionCorrect: boolean,
  timeMs: number
) {
  (question.contentRefs || []).forEach((ref) => {
    const correct = contentRefCorrect(question, answer, ref, questionCorrect);
    if (correct == null) return;
    recordEvent(context, {
      action: "answer_result",
      item_type: ref.itemType,
      item_idx: ref.itemIdx,
      correct: correct ? 1 : 0,
      time_ms: timeMs,
      extra: eventExtra(attemptId, question.id, `mastery:${ref.itemType}:${ref.itemIdx}`, {
        q_idx: question.qIdx,
        sub_item_index: ref.subItemIndex
      })
    });
  });
}

function recordQuestionEvent(
  context: ActivityRendererContext,
  attemptId: string,
  question: QuickCheckQuestion,
  action: string,
  detail: { correct?: 0 | 1; extra?: Record<string, unknown>; hints_used?: number; time_ms?: number } = {}
) {
  recordEvent(context, {
    action,
    item_type: "quick_check",
    item_idx: question.qIdx,
    ...detail,
    extra: eventExtra(attemptId, question.id, action, {
      question_kind: question.kind,
      unity_type: question.unityType,
      ...detail.extra
    })
  });
}

function recordScenarioEvent(
  context: ActivityRendererContext,
  attemptId: string,
  scenario: NpcQuickCheckScenario,
  action: string,
  nodeId: string,
  detail: Record<string, unknown> = {}
) {
  recordEvent(context, {
    action,
    item_type: "activity",
    item_idx: context.activity?.actIdx ?? null,
    extra: eventExtra(attemptId, `${scenario.scenarioId}:${nodeId}`, action, {
      scenario_id: scenario.scenarioId,
      scenario_version: scenario.version,
      node_id: nodeId,
      ...detail
    })
  });
}

function sourceTag(attemptId: string): string {
  return attemptId.startsWith("npcqhk2:") ? "npcqhk2_resource" : "npcqhk_resource";
}

function eventExtra(attemptId: string, itemId: string, action: string, detail: Record<string, unknown> = {}) {
  return {
    source: sourceTag(attemptId),
    client_event_id: npcQuickCheckClientEventId(attemptId, itemId, action),
    ...detail
  };
}

function recordEvent(
  context: ActivityRendererContext,
  event: Parameters<NonNullable<ActivityRendererContext["learnEventRecorder"]>["record"]>[0]
) {
  context.learnEventRecorder?.record(event);
}
