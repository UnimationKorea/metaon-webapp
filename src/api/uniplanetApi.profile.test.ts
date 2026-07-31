import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getMetaOnManagedProfiles,
  loginMetaOn,
  releaseStoredMetaOnProfileOnStartup,
  selectMetaOnProfile,
  setMetaOnProfileActive
} from "./uniplanetApi";

describe("MetaOn profile selection API", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("preserves a 353 confirmation result and sends force as an explicit selection option", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      resultCode: 353,
      resultMessage: "Confirmation required.",
      holder_idle_sec: 125
    }, 409));
    vi.stubGlobal("fetch", fetchMock);

    const result = await selectMetaOnProfile(25);

    expect(result).toMatchObject({ resultCode: 353, holderIdleSec: 125 });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(options.body))).toEqual({ user_idx: 25, force: 0 });
    expect(options.headers).not.toHaveProperty("X-MetaOn-User-Idx");
  });

  it("normalizes the selected profile returned after a forced confirmation", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      resultCode: 1,
      accountAuthenticated: true,
      profileSelected: true,
      account: { accountIdx: 7, userId: "family01", username: "Parent" },
      profile: { userIdx: 25, username: "First", status: 0, isActive: true, isCurrent: true },
      profiles: [{ userIdx: 25, username: "First", status: 0, isActive: true, isCurrent: true }]
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await selectMetaOnProfile(25, true);

    expect(result.resultCode).toBe(1);
    expect(result.profile).toMatchObject({ userIdx: 25, username: "First", isCurrent: true });
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(options.body))).toEqual({ user_idx: 25, force: 1 });
  });

  it("does not send a previously stored Session-Id when starting a fresh account login", async () => {
    localStorage.setItem("metaon-session-id", "old-session");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      resultCode: 1,
      accountAuthenticated: true,
      account: { accountIdx: 7, userId: "family01", username: "Parent" },
      profiles: []
    }, 200, { "X-MetaOn-Session-Id": "new-session" }));
    vi.stubGlobal("fetch", fetchMock);

    await loginMetaOn("family01", "password");

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(options.headers).not.toHaveProperty("X-MetaOn-Session-Id");
    expect(localStorage.getItem("metaon-session-id")).toBe("new-session");
  });

  it("releases the saved Session-Id once on startup and always removes it locally", async () => {
    localStorage.setItem("metaon-session-id", "profile-session-to-release");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ resultCode: 1 }));
    vi.stubGlobal("fetch", fetchMock);

    await releaseStoredMetaOnProfileOnStartup();

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/auth/startup-release");
    expect(options.headers).toMatchObject({ "X-MetaOn-Session-Id": "profile-session-to-release" });
    expect(localStorage.getItem("metaon-session-id")).toBeNull();
  });

  it("does not block a fresh startup with a release request when no Session-Id is stored", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await releaseStoredMetaOnProfileOnStartup();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("discards a saved Session-Id even when the startup release request fails", async () => {
    localStorage.setItem("metaon-session-id", "expired-session");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await releaseStoredMetaOnProfileOnStartup();

    expect(localStorage.getItem("metaon-session-id")).toBeNull();
  });

  it("parses inactive profiles from the management API and sends active as a boolean", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        resultCode: 1,
        accountAuthenticated: true,
        account: { accountIdx: 7, userId: "family01", username: "Parent", isBtb: false },
        profiles: [{ userIdx: 25, username: "Active", status: 0, isActive: true }],
        managedProfiles: [
          { userIdx: 25, username: "Active", status: 0, isActive: true },
          { userIdx: 26, username: "Paused", status: 1, isActive: false }
        ]
      }))
      .mockResolvedValueOnce(jsonResponse({
        resultCode: 1,
        accountAuthenticated: true,
        account: { accountIdx: 7, userId: "family01", username: "Parent", isBtb: false },
        profiles: [{ userIdx: 25, username: "Active", status: 0, isActive: true }],
        managedProfiles: [{ userIdx: 25, username: "Active", status: 0, isActive: true }]
      }));
    vi.stubGlobal("fetch", fetchMock);

    const managed = await getMetaOnManagedProfiles();
    await setMetaOnProfileActive(26, true);

    expect(managed.managedProfiles).toEqual(expect.arrayContaining([
      expect.objectContaining({ userIdx: 26, isActive: false })
    ]));
    const [, options] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(JSON.parse(String(options.body))).toEqual({ user_idx: 26, active: true });
  });
});

function jsonResponse(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers }
  });
}
