import type {
  QuickCheckAnswer,
  QuickCheckContentRef,
  QuickCheckQuestion
} from "../quickCheck/quickCheckTypes";

export const NPC_QUICK_CHECK_PROTOCOL_VERSION = "1.0";

export type NpcQuickCheckPublicQuestion = Omit<QuickCheckQuestion, "correctAnswer">;

export type NpcQuickCheckRpcCall = {
  id: string;
  method: string;
  params: Record<string, unknown>;
  type: "rpc_call";
};

export function sanitizeQuickCheckQuestions(
  questions: QuickCheckQuestion[]
): NpcQuickCheckPublicQuestion[] {
  return questions.map(({ correctAnswer: _correctAnswer, ...question }) => structuredClone(question));
}

export function parseNpcQuickCheckRpcCall(value: unknown): NpcQuickCheckRpcCall | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const message = value as Record<string, unknown>;
  if (message.type !== "rpc_call" || typeof message.id !== "string" || typeof message.method !== "string") return null;
  return {
    type: "rpc_call",
    id: message.id,
    method: message.method,
    params: message.params && typeof message.params === "object" && !Array.isArray(message.params)
      ? message.params as Record<string, unknown>
      : {}
  };
}

export function normalizeViewerAnswer(question: QuickCheckQuestion, value: unknown): QuickCheckAnswer {
  const raw = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

  if (question.correctAnswer.mode === "text") {
    return { mode: "text", value: typeof raw.value === "string" ? raw.value : "" };
  }

  if (question.correctAnswer.mode === "composite") {
    const source = Array.isArray(raw.selectedIndexes) ? raw.selectedIndexes : [];
    return {
      mode: "composite",
      selectedIndexes: question.correctAnswer.selectedIndexes.map((_item, index) => {
        const selected = Number(source[index]);
        return Number.isInteger(selected) && selected >= 0 ? selected : null;
      })
    };
  }

  const selected = Number(raw.selectedIndex);
  return {
    mode: "single",
    selectedIndex: Number.isInteger(selected) && selected >= 0 ? selected : null
  };
}

export function genericHintForQuestion(question: QuickCheckQuestion): string {
  switch (question.kind) {
    case "sentence-input":
      return "대문자, 띄어쓰기와 문장 부호까지 지문과 정확히 맞춰 보세요.";
    case "multi-select":
    case "connect-line":
      return "각 하위 항목을 하나씩 확인한 뒤 모든 항목에 답해 보세요.";
    case "drag-alphabet":
      return "빈칸 앞뒤 글자를 읽고 완성되는 단어의 철자를 떠올려 보세요.";
    case "drag-image":
      return "그림과 설명을 비교하여 가장 잘 맞는 위치를 찾아보세요.";
    case "drag-sentence":
      return "주어와 동사를 먼저 찾고 자연스러운 문장 순서로 배열해 보세요.";
    default:
      return "질문의 핵심 단어와 선택지의 차이를 다시 비교해 보세요.";
  }
}

export function contentRefCorrect(
  question: QuickCheckQuestion,
  answer: QuickCheckAnswer,
  ref: QuickCheckContentRef,
  questionCorrect: boolean
): boolean | undefined {
  if (ref.subItemIndex == null) {
    return question.correctAnswer.mode === "composite" ? undefined : questionCorrect;
  }
  if (question.correctAnswer.mode !== "composite" || answer.mode !== "composite") return undefined;
  return answer.selectedIndexes[ref.subItemIndex] === question.correctAnswer.selectedIndexes[ref.subItemIndex];
}

export function npcQuickCheckClientEventId(attemptId: string, questionId: string, action: string): string {
  return `npcqc:${attemptId}:${questionId}:${action}`;
}
