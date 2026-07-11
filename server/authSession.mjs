export function resolveUpstreamCredentials({
  auth,
  requestSessionId = "",
  legacyRequestSessionId = "",
  defaultSessionId = "",
  defaultCookie = "",
  options = {}
}) {
  const hasSessionOverride = Object.prototype.hasOwnProperty.call(options, "sessionId");
  const hasCookieOverride = Object.prototype.hasOwnProperty.call(options, "cookie");
  const sessionId = hasSessionOverride
    ? stringValue(options.sessionId)
    : stringValue(auth?.sessionId || requestSessionId || legacyRequestSessionId || defaultSessionId);
  const cookie = hasCookieOverride
    ? stringValue(options.cookie)
    : stringValue(auth?.cookie || (sessionId ? `JSESSIONID=${sessionId}` : "") || defaultCookie);

  return { cookie, sessionId };
}

export function isConfirmedAuthenticationFailure(error) {
  const resultCode = numberValue(error?.resultCode);
  const status = numberValue(error?.status);
  return resultCode === 340 || resultCode === 401 || resultCode === 403 || status === 401 || status === 403;
}

function stringValue(value) {
  return value == null ? "" : String(value);
}

function numberValue(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
