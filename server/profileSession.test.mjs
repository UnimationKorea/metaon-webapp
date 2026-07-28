import { describe, expect, it } from "vitest";
import {
  PROFILE_RESULT,
  isProfileSessionResult,
  normalizeAccount,
  normalizeProfiles,
  profileForSession
} from "./profileSession.mjs";

describe("profile session helpers", () => {
  it("normalizes an account login response and its profiles", () => {
    const account = normalizeAccount({ account_idx: 3, user_id: "family01", username: "Parent" });
    const profiles = normalizeProfiles([
      { user_idx: 25, username: "First", status: 0, is_current: false },
      { user_idx: 26, username: "Second", status: 0, is_current: true }
    ]);

    expect(account).toMatchObject({ accountIdx: 3, userId: "family01", username: "Parent" });
    expect(profileForSession(profiles, null)).toMatchObject({ userIdx: 26, username: "Second", isCurrent: true });
  });

  it("uses the selected profile stored in the signed session when profiles do not mark one current", () => {
    const profiles = normalizeProfiles([{ user_idx: 25, username: "First", status: 0 }]);
    expect(profileForSession(profiles, { user_idx: 25, username: "First" })).toMatchObject({ userIdx: 25 });
  });

  it("identifies academy-linked BTB accounts and preserves inactive profiles for management", () => {
    const account = normalizeAccount({ account_idx: 9, user_id: "academy-child", acad_idx: 12 });
    const profiles = normalizeProfiles([
      { user_idx: 25, username: "Active", status: 0, is_active: true },
      { user_idx: 26, username: "Paused", status: 1, is_active: false }
    ]);

    expect(account).toMatchObject({ isBtb: true, canManageProfiles: false, canChangePassword: false });
    expect(profiles).toEqual(expect.arrayContaining([
      expect.objectContaining({ userIdx: 26, isActive: false })
    ]));
  });

  it("treats profile required and profile revoked as selection flow errors", () => {
    expect(isProfileSessionResult(PROFILE_RESULT.PROFILE_REQUIRED)).toBe(true);
    expect(isProfileSessionResult(PROFILE_RESULT.PROFILE_REVOKED)).toBe(true);
    expect(isProfileSessionResult(PROFILE_RESULT.PROFILE_BUSY)).toBe(false);
  });
});
