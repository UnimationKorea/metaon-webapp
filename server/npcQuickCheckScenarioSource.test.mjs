import { describe, expect, it, vi } from "vitest";
import { loadNpcQuickCheckScenario } from "./npcQuickCheckScenarioSource.mjs";

const scope = { bookIdx: 10, dayIdx: 20, actIdx: 65 };
const scenario = {
  scenarioId: "scenario-1",
  version: 1,
  bookIdx: 10,
  dayIdx: 20,
  actIdx: 65,
  startNodeId: "intro",
  nodes: [
    { id: "intro", type: "dialogue", text: "Hello", nextNodeId: "end" },
    { id: "end", type: "ending", text: "Done" }
  ]
};

describe("NPC Quick Check scenario source", () => {
  it("returns a fallback signal when the source is not configured", async () => {
    const fetchImpl = vi.fn();
    await expect(loadNpcQuickCheckScenario({ ...scope, fetchImpl })).resolves.toEqual({
      scenario: null,
      source: "not-configured"
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("uses server-only API auth and scoped query parameters", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ scenario }), { status: 200 }));
    const result = await loadNpcQuickCheckScenario({
      ...scope,
      apiKey: "secret-key",
      apiUrl: "https://scenario.example/api/scenario",
      fetchImpl
    });

    const [url, request] = fetchImpl.mock.calls[0];
    expect(url.searchParams.get("book_idx")).toBe("10");
    expect(url.searchParams.get("day_idx")).toBe("20");
    expect(url.searchParams.get("act_idx")).toBe("65");
    expect(request.headers["X-Api-Key"]).toBe("secret-key");
    expect(result).toMatchObject({ source: "upstream", scenario: { scenarioId: "scenario-1" } });
  });

  it("converts a 404 into the generic Quick Check fallback signal", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 404 }));
    await expect(loadNpcQuickCheckScenario({
      ...scope,
      apiUrl: "https://scenario.example/api/scenario",
      fetchImpl
    })).resolves.toEqual({ scenario: null, source: "not-found" });
  });
});
