import { describe, expect, it } from "vitest";
import {
  createNpcQuickCheckLaunch,
  verifyNpcQuickCheckToken
} from "./npcQuickCheckLaunch.mjs";

const auth = {
  userIdx: 42,
  user: { userId: "smlee" }
};

const body = {
  bookIdx: 7228,
  bookCode: "G1LI02",
  dayIdx: 33,
  actIdx: 65,
  logIdx: 900,
  attemptId: "qc_test"
};

describe("NPC Quick Check launch", () => {
  it("creates a scoped token without an LMS session", () => {
    const launch = createNpcQuickCheckLaunch({
      auth,
      body,
      now: Date.UTC(2026, 6, 13),
      parentOrigin: "https://metaon.example/path",
      secret: "test-secret",
      viewerUrl: "https://npc.example/viewer"
    });
    const claims = verifyNpcQuickCheckToken(launch.launchToken, "test-secret", Date.UTC(2026, 6, 13));

    expect(claims).toMatchObject({
      kind: "npc-quick-check",
      userId: "smlee",
      userIdx: 42,
      bookIdx: 7228,
      attemptId: "qc_test",
      parentOrigin: "https://metaon.example"
    });
    expect(claims).not.toHaveProperty("sessionId");
    expect(new URL(launch.iframeUrl).searchParams.get("launch_token")).toBeNull();
    expect(launch.launchToken).toBeTruthy();
  });

  it("rejects expired and tampered tokens", () => {
    const now = Date.UTC(2026, 6, 13);
    const launch = createNpcQuickCheckLaunch({
      auth,
      body,
      now,
      parentOrigin: "https://metaon.example",
      secret: "test-secret",
      viewerUrl: "https://npc.example"
    });

    expect(verifyNpcQuickCheckToken(`${launch.launchToken}x`, "test-secret", now)).toBeNull();
    expect(verifyNpcQuickCheckToken(launch.launchToken, "test-secret", now + 31 * 60 * 1000)).toBeNull();
  });
});
