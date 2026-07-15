import { normalizeNpcQuickCheckScenario } from "../shared/npcQuickCheckScenario.mjs";

export async function loadNpcQuickCheckScenario({
  actIdx,
  apiKey = "",
  apiUrl = "",
  bookIdx,
  dayIdx,
  fetchImpl = fetch,
  timeoutMs = 5000
}) {
  if (!apiUrl) return { scenario: null, source: "not-configured" };

  let endpoint;
  try {
    endpoint = new URL(apiUrl);
  } catch {
    throw scenarioSourceError("METAON_NPC_SCENARIO_API_URL must be a valid URL.", 503);
  }
  endpoint.searchParams.set("book_idx", String(bookIdx));
  endpoint.searchParams.set("day_idx", String(dayIdx));
  endpoint.searchParams.set("act_idx", String(actIdx));

  const headers = { Accept: "application/json" };
  if (apiKey) headers["X-Api-Key"] = apiKey;

  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(Math.max(250, Number(timeoutMs) || 5000))
    });
  } catch (error) {
    throw scenarioSourceError(`NPC scenario API request failed: ${error instanceof Error ? error.message : String(error)}`, 502);
  }

  if (response.status === 404) return { scenario: null, source: "not-found" };
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw scenarioSourceError("NPC scenario API returned invalid JSON.", 502);
  }
  if (!response.ok) {
    throw scenarioSourceError(`NPC scenario API returned HTTP ${response.status}.`, 502);
  }

  try {
    const scenario = normalizeNpcQuickCheckScenario(payload, { bookIdx, dayIdx, actIdx });
    return { scenario, source: scenario ? "upstream" : "not-found" };
  } catch (error) {
    throw scenarioSourceError(error instanceof Error ? error.message : String(error), 502);
  }
}

function scenarioSourceError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}
