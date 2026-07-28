export type ExternalExperienceKind = "ai-chat" | "metaverse";

const SESSION_ID_KEY = "metaon-session-id";

export type ExternalLaunchRequest = {
  bookId?: string;
  bookIdx?: number;
  kind: ExternalExperienceKind;
  lastActivityId?: string;
  seriesGroup?: number;
  seriesIdx?: number;
};

export type ExternalLaunch = {
  auth?: {
    session_id: string;
    user_id: string;
    user_idx: number;
    username: string;
  };
  expiresAt: string;
  iframeUrl: string;
  isMock: boolean;
  kind: ExternalExperienceKind;
  launchToken: string;
};

export async function createExternalLaunch(payload: ExternalLaunchRequest): Promise<ExternalLaunch> {
  const response = await fetch("/api/external/launch", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      ...externalSessionHeaders(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(String(data.detail || data.message || response.statusText));
  }

  return data as ExternalLaunch;
}

function externalSessionHeaders(): HeadersInit {
  return {
    "X-MetaOn-Session-Id": window.localStorage.getItem(SESSION_ID_KEY) || ""
  };
}
