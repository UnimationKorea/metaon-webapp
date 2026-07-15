export type NpcQuickCheckLaunchRequest = {
  actIdx: number;
  attemptId: string;
  bookCode?: string;
  bookIdx: number;
  dayIdx: number;
  logIdx: number;
};

export type NpcQuickCheckLaunch = {
  expiresAt: string;
  iframeUrl: string;
  isMock: boolean;
  kind: "npc-quick-check";
  launchToken: string;
  parentOrigin: string;
  protocolVersion: string;
  viewerOrigin: string;
};

export type NpcQuickCheckScenarioResponse = {
  resultCode: number;
  resultMessage: string;
  scenario: unknown | null;
  source: "not-configured" | "not-found" | "upstream" | string;
};

export async function createNpcQuickCheckLaunch(
  payload: NpcQuickCheckLaunchRequest
): Promise<NpcQuickCheckLaunch> {
  const response = await fetch("/api/activities/npc-quick-check/launch", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String(data.detail || data.message || response.statusText));
  }
  return data as NpcQuickCheckLaunch;
}

export async function getNpcQuickCheckScenario(payload: {
  actIdx: number;
  bookIdx: number;
  dayIdx: number;
}): Promise<NpcQuickCheckScenarioResponse> {
  const query = new URLSearchParams({
    actIdx: String(payload.actIdx),
    bookIdx: String(payload.bookIdx),
    dayIdx: String(payload.dayIdx)
  });
  const response = await fetch(`/api/activities/npc-quick-check/scenario?${query.toString()}`, {
    credentials: "same-origin"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String(data.detail || data.message || response.statusText));
  }
  return data as NpcQuickCheckScenarioResponse;
}
