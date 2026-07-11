import type {
  QuickCheckAnswer,
  QuickCheckQuestion
} from "../src/features/quickCheck/quickCheckTypes";

export type QuickCheckScoreItem = {
  questionId: string;
  qIdx: number;
  complete: boolean;
  correct: boolean;
};

export type QuickCheckAttemptScore = {
  total: number;
  correctCount: number;
  complete: boolean;
  items: QuickCheckScoreItem[];
};

export function createEmptyQuickCheckAnswer(question: QuickCheckQuestion): QuickCheckAnswer;
export function isQuickCheckAnswerComplete(question: QuickCheckQuestion, answer?: QuickCheckAnswer): boolean;
export function scoreQuickCheckAnswer(question: QuickCheckQuestion, answer?: QuickCheckAnswer): boolean;
export function scoreQuickCheckAttempt(
  questions: QuickCheckQuestion[],
  answersByQuestionId: Record<string, QuickCheckAnswer | undefined>
): QuickCheckAttemptScore;
