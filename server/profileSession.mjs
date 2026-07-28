export const PROFILE_RESULT = {
  SESSION_EXPIRED: 340,
  PASSWORD_CHANGE_DENIED: 341,
  PROFILE_UNAVAILABLE: 345,
  PROFILE_REQUIRED: 346,
  PROFILE_MANAGEMENT_DENIED: 347,
  LAST_ACTIVE_PROFILE: 348,
  DUPLICATE_PROFILE_NAME: 349,
  PROFILE_BUSY: 351,
  PROFILE_REVOKED: 352,
  PROFILE_CONFIRM_REQUIRED: 353
};

export function normalizeAccount(value) {
  const source = recordValue(value);
  const accountIdx = numberValue(source.account_idx ?? source.accountIdx ?? source.idx);
  const hqIdx = numberValue(source.hq_idx ?? source.hqIdx);
  const acadIdx = numberValue(source.acad_idx ?? source.acadIdx);
  const accountType = stringValue(source.account_type ?? source.accountType ?? source.member_type ?? source.memberType ?? source.type).toUpperCase();
  const isBtb = booleanValue(source.is_btb ?? source.isBtb ?? source.btb, false) ||
    ["BTB", "B2B", "ACADEMY"].includes(accountType) ||
    hqIdx > 0 || acadIdx > 0;
  return {
    accountIdx,
    userId: stringValue(source.user_id ?? source.userId),
    username: stringValue(source.username ?? source.userName) || (accountIdx ? `Account ${accountIdx}` : "MetaOn Account"),
    email: stringValue(source.email),
    role: numberValue(source.role),
    hqIdx,
    acadIdx,
    isBtb,
    canManageProfiles: !isBtb,
    canChangePassword: !isBtb
  };
}

export function normalizeProfile(value) {
  const source = recordValue(value);
  const userIdx = numberValue(source.user_idx ?? source.userIdx ?? source.idx);
  return {
    userIdx,
    username: stringValue(source.username ?? source.userName) || (userIdx ? `Profile ${userIdx}` : "Profile"),
    status: numberValue(source.status),
    isActive: source.is_active == null ? source.status !== 1 : booleanValue(source.is_active, true),
    isCurrent: booleanValue(source.is_current ?? source.isCurrent, false),
    isDeleted: booleanValue(source.is_deleted ?? source.isDeleted, false),
    spoint: numberValue(source.spoint ?? source.userSPoint ?? source.userPoint),
    lpoint: numberValue(source.lpoint ?? source.userLPoint),
    llevel: numberValue(source.llevel ?? source.lLevel)
  };
}

export function normalizeProfiles(value) {
  return arrayValue(value)
    .map(normalizeProfile)
    .filter((profile) => profile.userIdx > 0);
}

export function profileForSession(profiles, fallback) {
  const normalizedFallback = fallback ? normalizeProfile(fallback) : null;
  return profiles.find((profile) => profile.isCurrent) ||
    (normalizedFallback?.userIdx ? profiles.find((profile) => profile.userIdx === normalizedFallback.userIdx) || null : null);
}

export function isProfileSessionResult(resultCode) {
  return [PROFILE_RESULT.PROFILE_REQUIRED, PROFILE_RESULT.PROFILE_REVOKED].includes(numberValue(resultCode));
}

export function recordValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stringValue(value) {
  return value == null ? "" : String(value).trim();
}

function booleanValue(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1") return true;
  if (value === 0 || value === "0") return false;
  return fallback;
}
