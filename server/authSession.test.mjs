import { describe, expect, it } from "vitest";
import { isConfirmedAuthenticationFailure, resolveUpstreamCredentials } from "./authSession.mjs";

describe("resolveUpstreamCredentials", () => {
  it("prefers the signed auth session over a stale client header", () => {
    expect(
      resolveUpstreamCredentials({
        auth: { sessionId: "signed-session", cookie: "JSESSIONID=signed-session" },
        requestSessionId: "stale-session"
      })
    ).toEqual({ sessionId: "signed-session", cookie: "JSESSIONID=signed-session" });
  });

  it("uses the request session when no signed auth cookie exists", () => {
    expect(resolveUpstreamCredentials({ requestSessionId: "manual-session" })).toEqual({
      sessionId: "manual-session",
      cookie: "JSESSIONID=manual-session"
    });
  });

  it("honors explicit empty credentials for the login request", () => {
    expect(
      resolveUpstreamCredentials({
        auth: { sessionId: "old-session", cookie: "JSESSIONID=old-session" },
        requestSessionId: "stale-session",
        options: { sessionId: "", cookie: "" }
      })
    ).toEqual({ sessionId: "", cookie: "" });
  });
});

describe("isConfirmedAuthenticationFailure", () => {
  it("recognizes an expired MetaOn session", () => {
    expect(isConfirmedAuthenticationFailure({ resultCode: 340, status: 502 })).toBe(true);
  });

  it("does not treat a transient upstream failure as logout", () => {
    expect(isConfirmedAuthenticationFailure({ status: 502 })).toBe(false);
    expect(isConfirmedAuthenticationFailure(new TypeError("fetch failed"))).toBe(false);
  });
});
