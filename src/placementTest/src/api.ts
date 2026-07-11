import type { Answers, GradeResult, RazResult, RazUnit, TestPaper } from "./types";

// 하위 경로 배포 대응: 빌드 base(import.meta.env.BASE_URL, 예 "/leveltest/") 기준으로 API 경로 구성.
// 개발(base "/")에선 "/api", 배포(base "/leveltest/")에선 "/leveltest/api" 가 된다.
const API = `${import.meta.env.BASE_URL}api`.replace(/\/{2,}/g, "/");

export async function fetchTest(): Promise<TestPaper> {
  const res = await fetch(`${API}/test`);
  if (!res.ok) throw new Error("문제를 불러오지 못했어요.");
  return res.json();
}

export async function gradeTest(name: string, answers: Answers): Promise<GradeResult> {
  const res = await fetch(`${API}/grade`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, answers }),
  });
  if (!res.ok) throw new Error("채점에 실패했어요.");
  return res.json();
}

// ---------- Raz 적응형 배치 테스트 ----------
export async function startRazTest(
  name: string,
  grade: string
): Promise<{ sessionId: string; unit: RazUnit }> {
  const res = await fetch(`${API}/raz/test/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, grade }),
  });
  if (!res.ok) throw new Error("테스트를 시작하지 못했어요.");
  return res.json();
}

export async function submitRazUnit(
  sessionId: string,
  answers: Record<string, number>,
  elapsedMs: number
): Promise<{ done: false; unit: RazUnit } | RazResult> {
  const res = await fetch(`${API}/raz/test/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, answers, elapsedMs }),
  });
  if (!res.ok) throw new Error("답안 처리에 실패했어요.");
  return res.json();
}
