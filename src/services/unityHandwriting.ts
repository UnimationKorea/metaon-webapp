export type HandwritingRecognitionResponse = {
  resultCode?: number;
  resultMessage?: string;
  candidates?: unknown;
};

export type UnityHandwritingEvaluation = {
  correct: boolean;
  bestCandidate: string;
  bestScore: number;
  scores: Array<{ candidate: string; score: number }>;
};

/**
 * Mirrors RecogUtil.CheckScoreByWord from Unity Activity 48.
 * Candidate characters beyond the expected word are intentionally ignored.
 */
export function checkUnityWordScore(expectedWord: string, candidateWord: string): number {
  const expected = expectedWord.toLowerCase();
  const candidate = candidateWord.toLowerCase().trim();
  if (!expected.length) return 0;

  let equalCount = 0;
  for (let index = 0; index < expected.length; index += 1) {
    const expectedCharacter = expected[index];
    if (expectedCharacter < "a" || expectedCharacter > "z") {
      equalCount += 1;
      continue;
    }
    if (candidate[index] === expectedCharacter) equalCount += 1;
  }

  return Math.trunc((equalCount / expected.length) * 100);
}

export function normalizeHandwritingCandidates(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return [];
  const candidates = (payload as HandwritingRecognitionResponse).candidates;
  if (!Array.isArray(candidates)) return [];

  return candidates
    .filter((candidate): candidate is string => typeof candidate === "string")
    .map((candidate) => candidate.replace(/[\r\n]/g, ""))
    .filter((candidate) => candidate.length > 0);
}

export function evaluateUnityHandwriting(
  expectedWord: string,
  candidates: string[],
  threshold = 70
): UnityHandwritingEvaluation {
  const scores = candidates.map((candidate) => ({
    candidate,
    score: checkUnityWordScore(expectedWord, candidate)
  }));
  const passing = scores.find((result) => result.score >= threshold);
  const best = scores.reduce<{ candidate: string; score: number }>(
    (current, result) => (result.score > current.score ? result : current),
    { candidate: "", score: 0 }
  );

  return {
    correct: Boolean(passing),
    bestCandidate: passing?.candidate || best.candidate,
    bestScore: passing?.score ?? best.score,
    scores
  };
}
