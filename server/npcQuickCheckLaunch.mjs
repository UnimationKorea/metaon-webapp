import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const NPC_QUICK_CHECK_PROTOCOL_VERSION = "1.0";
export const NPC_QUICK_CHECK_LAUNCH_TTL_MS = 30 * 60 * 1000;

export function createNpcQuickCheckLaunch({
  auth,
  body,
  now = Date.now(),
  parentOrigin,
  secret,
  viewerUrl
}) {
  if (!secret) throw badRequest("NPC Quick Check launch secret is not configured.", 503);
  if (!viewerUrl) throw badRequest("NPC Quick Check viewer URL is not configured.", 503);

  const userId = text(auth?.user?.userId ?? auth?.user?.user_id);
  const userIdx = positiveNumber(auth?.userIdx);
  const bookIdx = positiveNumber(body?.bookIdx ?? body?.book_idx);
  const dayIdx = positiveNumber(body?.dayIdx ?? body?.day_idx);
  const actIdx = positiveNumber(body?.actIdx ?? body?.act_idx);
  const logIdx = positiveNumber(body?.logIdx ?? body?.log_idx);
  const attemptId = text(body?.attemptId ?? body?.attempt_id);
  if (!userId || !userIdx) throw badRequest("Authenticated user identity is required.", 401);
  if (!bookIdx || !dayIdx || !actIdx || !logIdx || !attemptId) {
    throw badRequest("bookIdx, dayIdx, actIdx, logIdx, and attemptId are required.");
  }

  const normalizedParentOrigin = httpOrigin(parentOrigin);
  const viewer = new URL(viewerUrl);
  if (viewer.protocol !== "http:" && viewer.protocol !== "https:") {
    throw badRequest("NPC Quick Check viewer URL must use HTTP or HTTPS.", 503);
  }

  const expiresAt = new Date(now + NPC_QUICK_CHECK_LAUNCH_TTL_MS).toISOString();
  const claims = {
    version: 1,
    protocolVersion: NPC_QUICK_CHECK_PROTOCOL_VERSION,
    kind: "npc-quick-check",
    jti: randomBytes(16).toString("base64url"),
    userId,
    userIdx,
    bookIdx,
    bookCode: text(body?.bookCode ?? body?.book_code),
    dayIdx,
    actIdx,
    logIdx,
    attemptId,
    parentOrigin: normalizedParentOrigin,
    expiresAt
  };
  const launchToken = signNpcQuickCheckClaims(claims, secret);

  viewer.searchParams.set("mode", "npc-quick-check");
  viewer.searchParams.set("parent_origin", normalizedParentOrigin);
  viewer.searchParams.set("protocol_version", NPC_QUICK_CHECK_PROTOCOL_VERSION);

  return {
    kind: "npc-quick-check",
    protocolVersion: NPC_QUICK_CHECK_PROTOCOL_VERSION,
    iframeUrl: viewer.toString(),
    launchToken,
    expiresAt,
    parentOrigin: normalizedParentOrigin,
    viewerOrigin: viewer.origin,
    isMock: false
  };
}

export function signNpcQuickCheckClaims(claims, secret) {
  const payload = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  return `${payload}.${signature(payload, secret)}`;
}

export function verifyNpcQuickCheckToken(token, secret, now = Date.now()) {
  const [payload, suppliedSignature] = text(token).split(".");
  if (!payload || !suppliedSignature || !secret) return null;
  const expectedSignature = signature(payload, secret);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (claims?.kind !== "npc-quick-check") return null;
    if (Date.parse(claims.expiresAt) <= now) return null;
    return claims;
  } catch {
    return null;
  }
}

function signature(payload, secret) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function httpOrigin(value) {
  try {
    const parsed = new URL(text(value));
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("invalid protocol");
    return parsed.origin;
  } catch {
    throw badRequest("A valid parent origin is required.", 400);
  }
}

function positiveNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function text(value) {
  return value == null ? "" : String(value).trim();
}

function badRequest(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}
