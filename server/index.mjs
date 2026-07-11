import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { isConfirmedAuthenticationFailure, resolveUpstreamCredentials } from "./authSession.mjs";
import { discoverEbookResources } from "./ebookResourceDiscovery.mjs";
import {
  QUICK_CHECK_CURRENT_CONTRACT,
  QUICK_CHECK_UNITY_CONTRACT,
  buildCurrentQuickCheckRequest,
  buildCurrentQuickCheckSubmission,
  buildLegacyQuickCheckRequest,
  buildLegacyQuickCheckSubmission,
  isSuccessfulQuickCheckResponse,
  normalizeQuickCheckPayload,
  normalizeQuickCheckSubmission,
  normalizeSubmittedQuickCheckAnswers,
  validateQuickCheckSubmission
} from "./quickCheckAdapter.mjs";
import { RAZ_PLACEMENT_SETS, startRazIndexForGrade } from "./razPlacementData.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const PORT = Number(process.env.PORT || 4100);
const HOST = process.env.HOST || "0.0.0.0";
const API_ORIGIN = process.env.METAON_API_ORIGIN || process.env.UNIPLANET_API_ORIGIN || "https://metaon3-0-609870547235.asia-northeast3.run.app";
const CDN_ORIGIN =
  process.env.METAON_CDN_ORIGIN ||
  process.env.UNIPLANET_CDN_ORIGIN ||
  "https://metaon.s3.ap-northeast-2.amazonaws.com";
const BOOKDATA_BASE =
  process.env.METAON_BOOKDATA_BASE ||
  `${CDN_ORIGIN.replace(/\/+$/, "")}/MetaOn3/BookData`;
const APP_IDX = process.env.METAON_APP_IDX || process.env.UNIPLANET_APP_IDX || "2";
const APP_VERSION = process.env.METAON_APP_VERSION || process.env.UNIPLANET_APP_VERSION || "2.2.25";
const PLATFORM = process.env.METAON_PLATFORM || process.env.UNIPLANET_PLATFORM || "Android";
const DEFAULT_USER_IDX = Number(process.env.METAON_USER_IDX || 0);
const DEFAULT_SESSION_ID = process.env.METAON_SESSION_ID || "";
const DEFAULT_COOKIE = process.env.METAON_COOKIE || (DEFAULT_SESSION_ID ? `JSESSIONID=${DEFAULT_SESSION_ID}` : "");
const AUTH_COOKIE_NAME = "metaon_auth";
const AUTH_COOKIE_SECRET =
  process.env.METAON_AUTH_COOKIE_SECRET ||
  (process.env.NODE_ENV === "production" ? randomBytes(32).toString("hex") : "metaon-local-dev-auth-cookie-secret");
const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const AUTH_COOKIE_SECURE =
  process.env.METAON_AUTH_COOKIE_SECURE === "1" ||
  (process.env.NODE_ENV === "production" && process.env.METAON_AUTH_COOKIE_SECURE !== "0");
const DEFAULT_AI_CHAT_URL = "https://metaon-web-224227368849.asia-northeast3.run.app/";
const DEFAULT_METAVERSE_URL = "https://meta.unimation-slack-bot.com/metaplanet-ver1/";
const AI_CHAT_URL = process.env.METAON_AI_CHAT_URL || DEFAULT_AI_CHAT_URL;
const METAVERSE_URL = process.env.METAON_METAVERSE_URL || DEFAULT_METAVERSE_URL;
const EXTERNAL_LAUNCH_SECRET = process.env.METAON_EXTERNAL_LAUNCH_SECRET || AUTH_COOKIE_SECRET;

const catalogCache = new Map();
const CATALOG_TTL_MS = 60_000;
const quickCheckAttempts = new Map();
const QUICK_CHECK_ATTEMPT_TTL_MS = 30 * 60 * 1000;
const razPlacementSessions = new Map();
const RAZ_PLACEMENT_SESSION_TTL_MS = 30 * 60 * 1000;

app.use(express.json({ limit: "16mb" }));

app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    app: "MetaOn",
    apiOrigin: API_ORIGIN,
    cdnOrigin: CDN_ORIGIN,
    bookDataBase: BOOKDATA_BASE,
    appIdx: APP_IDX,
    appVersion: APP_VERSION,
    platform: PLATFORM,
    defaultUserIdx: DEFAULT_USER_IDX,
    hasDefaultSession: Boolean(DEFAULT_SESSION_ID),
    hasDefaultCookie: Boolean(DEFAULT_COOKIE),
    authCookie: {
      name: AUTH_COOKIE_NAME,
      secure: AUTH_COOKIE_SECURE,
      httpOnly: true
    }
  });
});

app.get("/api/auth/me", async (req, res) => {
  const auth = getRequestAuth(req);
  if (!auth) {
    res.json({
      authenticated: false,
      user: null,
      userIdx: DEFAULT_USER_IDX
    });
    return;
  }

  try {
    const upstream = await postUpstream("/content/getMyBrands", {}, req);
    assertMetaOnSuccess(upstream.data, "/content/getMyBrands");

    const verifiedAuth = {
      ...auth,
      sessionId: upstream.sessionId || auth.sessionId,
      cookie: upstream.cookie || auth.cookie
    };
    setAuthCookie(res, verifiedAuth);
    if (verifiedAuth.sessionId) {
      res.setHeader("X-MetaOn-Session-Id", verifiedAuth.sessionId);
    }
    res.json({
      authenticated: true,
      user: verifiedAuth.user,
      userIdx: verifiedAuth.userIdx
    });
  } catch (error) {
    if (isConfirmedAuthenticationFailure(error)) {
      clearAuthCookie(res);
      catalogCache.clear();
      res.json({
        authenticated: false,
        user: null,
        userIdx: DEFAULT_USER_IDX
      });
      return;
    }

    // The signed cookie remains the source of truth during temporary upstream outages.
    res.json({
      authenticated: true,
      user: auth.user,
      userIdx: auth.userIdx,
      verification: "deferred"
    });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const userId = String(req.body?.user_id || req.body?.userId || "").trim();
    const password = String(req.body?.password || "");

    if (!userId || !password) {
      res.status(400).json({
        resultCode: 400,
        resultMessage: "MetaOn ID and password are required."
      });
      return;
    }

    const upstream = await postUpstream(
      "/user/login",
      { user_id: userId, password },
      req,
      { sessionId: "", cookie: "", ignoreRequestAuth: true }
    );
    const resultCode = numberValue(upstream.data?.resultCode);

    if (resultCode !== 1) {
      res.status(401).json({
        resultCode,
        resultMessage: stringValue(upstream.data?.resultMessage) || "MetaOn login failed."
      });
      return;
    }

    const auth = createAuthSession(upstream.data, upstream);
    setAuthCookie(res, auth);
    if (auth.sessionId) {
      res.setHeader("X-MetaOn-Session-Id", auth.sessionId);
    }
    res.json({
      authenticated: true,
      user: auth.user,
      userIdx: auth.userIdx
    });
  } catch (error) {
    sendError(res, error, "Failed to login to MetaOn");
  }
});

app.post("/api/auth/session", async (req, res) => {
  try {
    const userIdx = numberValue(req.body?.userIdx);
    const manualSession = normalizeManualSession(req.body?.sessionId);

    if (!userIdx || (!manualSession.sessionId && !manualSession.cookie)) {
      res.status(400).json({
        resultCode: 400,
        resultMessage: "userIdx and Session-Id/JSESSIONID are required."
      });
      return;
    }

    const upstream = await postUpstream(
      "/content/getMyBrands",
      {},
      req,
      {
        sessionId: manualSession.sessionId,
        cookie: manualSession.cookie,
        ignoreRequestAuth: true
      }
    );
    assertMetaOnSuccess(upstream.data, "/content/getMyBrands");

    const auth = {
      userIdx,
      sessionId: upstream.sessionId || manualSession.sessionId,
      cookie: upstream.cookie || manualSession.cookie,
      user: {
        userIdx,
        userId: "",
        username: `User ${userIdx}`,
        email: "",
        joinstep: 0
      }
    };

    setAuthCookie(res, auth);
    if (auth.sessionId) {
      res.setHeader("X-MetaOn-Session-Id", auth.sessionId);
    }
    res.json({
      authenticated: true,
      user: auth.user,
      userIdx: auth.userIdx
    });
  } catch (error) {
    sendError(res, error, "Failed to verify MetaOn session");
  }
});

app.post("/api/auth/logout", (_req, res) => {
  clearAuthCookie(res);
  catalogCache.clear();
  res.json({
    authenticated: false
  });
});

app.get("/api/books", async (req, res) => {
  try {
    const catalog = await getCatalog(req);
    res.json(catalog);
  } catch (error) {
    sendError(res, error, "Failed to fetch MetaOn book catalog");
  }
});

app.get("/api/books/:bookIdx/resource-manifest", async (req, res) => {
  try {
    const bookIdx = numberValue(req.params.bookIdx);
    if (!bookIdx) {
      res.status(400).json({
        resultCode: 310,
        resultMessage: "bookIdx is required."
      });
      return;
    }
    const upstream = await postUpstream("/content/getBookInfo", { book_idx: bookIdx }, req);
    assertMetaOnSuccess(upstream.data, "/content/getBookInfo");
    const manifest = normalizeBookResourceManifest(upstream.data);
    res.json(await discoverEbookResources(manifest, { bookDataBase: BOOKDATA_BASE }));
  } catch (error) {
    sendError(res, error, "Failed to fetch MetaOn3 book resource manifest");
  }
});

app.get("/api/packages", async (req, res) => {
  res.status(410).json({
    resultCode: 410,
    resultMessage: "ZIP package list is retired. Use /api/books and /api/books/:bookIdx/resource-manifest.",
    packages: []
  });
});

app.get("/api/books/:seriesGroup/:seriesIdx/:bookId/package", async (req, res) => {
  res.status(410).json({
    resultCode: 410,
    resultMessage: "ZIP download is retired. Use /api/books/:bookIdx/resource-manifest and direct S3 resource download."
  });
});

app.get("/api/books/:seriesGroup/:seriesIdx/:bookId/thumbnail", async (req, res) => {
  try {
    const book = await findBook(req);
    const thumbnailUrl = buildBookAssetUrl(book.bUrl, book.bookId, "png");
    const upstream = await fetch(thumbnailUrl);

    if (!upstream.ok || !upstream.body) {
      res.status(upstream.status || 404).json({
        message: "Failed to fetch book thumbnail",
        status: upstream.status,
        thumbnailUrl
      });
      return;
    }

    const contentLength = upstream.headers.get("content-length");
    if (contentLength) {
      res.setHeader("Content-Length", contentLength);
    }
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("X-MetaOn-Book-Id", book.bookId);

    await pipeline(Readable.fromWeb(upstream.body), res);
  } catch (error) {
    if (!res.headersSent) {
      sendError(res, error, "Failed to stream book thumbnail");
    }
  }
});

app.get("/api/books/:seriesGroup/:seriesIdx/:bookId/info", async (req, res) => {
  try {
    const book = await findBook(req);
    const infoUrl = buildBookAssetUrl(book.bUrl, book.bookId, "json");
    const upstream = await fetch(infoUrl);
    const text = await upstream.text();

    if (!upstream.ok) {
      res.status(upstream.status || 502).json({
        message: "Failed to fetch book package metadata",
        status: upstream.status,
        infoUrl
      });
      return;
    }

    res.type("application/json").send(text);
  } catch (error) {
    sendError(res, error, "Failed to fetch book package metadata");
  }
});

app.post("/api/study/start", async (req, res) => {
  proxyStudyEndpoint(req, res, "/study/start");
});

app.post("/api/study/end", async (req, res) => {
  proxyStudyEndpoint(req, res, "/study/end");
});

app.post("/api/study/quiz-accept", async (req, res) => {
  const attemptId = stringValue(req.body?.attempt_id ?? req.body?.attemptId);
  if (!attemptId) {
    await proxyQuickCheckLegacySubmission(req, res);
    return;
  }

  try {
    cleanupQuickCheckAttempts();
    const attempt = quickCheckAttempts.get(attemptId);
    if (!attempt || attempt.ownerKey !== getQuickCheckOwnerKey(req)) {
      res.status(404).json({
        resultCode: 404,
        resultMessage: "Quick Check attempt was not found or has expired."
      });
      return;
    }

    if (attempt.submittedResult) {
      res.json(markQuickCheckDuplicate(attempt.submittedResult));
      return;
    }

    if (attempt.submissionPromise) {
      const submitted = await attempt.submissionPromise;
      res.json(markQuickCheckDuplicate(submitted));
      return;
    }

    attempt.submissionPromise = submitQuickCheckAttempt(req, attempt);
    try {
      const submitted = await attempt.submissionPromise;
      attempt.submittedResult = submitted;
      res.json(submitted);
    } finally {
      attempt.submissionPromise = null;
    }
  } catch (error) {
    sendError(res, error, "Failed to submit Quick Check");
  }
});

app.post("/api/study/quick-check", async (req, res) => {
  try {
    cleanupQuickCheckAttempts();
    const normalized = await loadQuickCheckWithFallback(req);
    const attemptId = `qc_${Date.now()}_${randomBytes(12).toString("hex")}`;
    quickCheckAttempts.set(attemptId, {
      attemptId,
      ownerKey: getQuickCheckOwnerKey(req),
      sourceContract: normalized.sourceContract,
      questions: normalized.questions,
      context: req.body || {},
      createdAt: Date.now(),
      submittedResult: null,
      submissionPromise: null
    });

    res.json({
      ...normalized,
      attemptId,
      attempt_id: attemptId
    });
  } catch (error) {
    sendError(res, error, "Failed to load Quick Check");
  }
});

app.post("/api/raz/test/start", (req, res) => {
  try {
    cleanupRazPlacementSessions();
    const name = stringValue(req.body?.name).trim();
    const grade = stringValue(req.body?.grade).trim();

    if (!name || !grade) {
      res.status(400).json({
        resultCode: 400,
        resultMessage: "name and grade are required."
      });
      return;
    }

    const placementSet = RAZ_PLACEMENT_SETS[randomInt(RAZ_PLACEMENT_SETS.length)];
    const units = placementSet.units;
    const startIndex = startRazIndexForGrade(units, grade);
    const sessionId = `raz_${Date.now()}_${randomBytes(8).toString("hex")}`;
    const session = {
      sessionId,
      name,
      requestedGrade: grade,
      placementFormId: placementSet.id,
      currentIndex: startIndex,
      path: [],
      areaTotals: {
        reading: { correct: 0, total: 0 },
        vocab: { correct: 0, total: 0 }
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    razPlacementSessions.set(sessionId, session);

    res.json({
      sessionId,
      unit: publicRazPlacementUnit(units, placementSet.id, startIndex, 1, false)
    });
  } catch (error) {
    sendError(res, error, "Failed to start Raz placement test");
  }
});

app.post("/api/raz/test/answer", (req, res) => {
  try {
    cleanupRazPlacementSessions();
    const sessionId = stringValue(req.body?.sessionId);
    const session = razPlacementSessions.get(sessionId);

    if (!session) {
      res.status(404).json({
        resultCode: 404,
        resultMessage: "Placement test session was not found. Please restart the test."
      });
      return;
    }

    const placementSet = RAZ_PLACEMENT_SET_BY_ID.get(session.placementFormId) || RAZ_PLACEMENT_SETS[0];
    const units = placementSet.units;
    const unit = units[session.currentIndex] || units[0];
    const answers = recordValue(req.body?.answers);
    const elapsedMs = Math.max(0, numberValue(req.body?.elapsedMs));
    const unitResult = gradeRazPlacementUnit(unit, answers);
    const step = session.path.length + 1;

    for (const item of unit.items) {
      const bucket = item.skill === "vocab" ? session.areaTotals.vocab : session.areaTotals.reading;
      bucket.total += 1;
      if (answers[item.id] === item.answerIndex) bucket.correct += 1;
    }

    session.path.push({
      seq: step,
      grade: unit.grade,
      level: unit.level,
      correct: unitResult.correct,
      total: unit.items.length,
      ratio: unitResult.ratio,
      confirm: Boolean(unit.confirm),
      ms: elapsedMs,
      words: wordCount(unit.passage),
      passageKey: unit.id,
      placementFormId: placementSet.id,
      seriesId: unit.seriesId,
      globalAccuracy: unit.globalAccuracy,
      globalAvgMs: unit.globalAvgMs,
      globalN: unit.globalN
    });

    const nextIndex = nextRazPlacementIndex(session.currentIndex, unitResult.ratio, units.length);
    const done = step >= 3 || nextIndex === session.currentIndex || step >= 5;

    if (done) {
      const result = buildRazPlacementResult(
        session,
        units,
        unitResult.ratio >= 0.7 ? Math.max(session.currentIndex, nextIndex) : session.currentIndex
      );
      razPlacementSessions.delete(sessionId);
      res.json(result);
      return;
    }

    session.currentIndex = nextIndex;
    session.updatedAt = Date.now();
    res.json({
      done: false,
      unit: publicRazPlacementUnit(units, placementSet.id, nextIndex, step + 1, step + 1 >= 3)
    });
  } catch (error) {
    sendError(res, error, "Failed to submit Raz placement answer");
  }
});

app.post("/api/learn/events", async (req, res) => {
  proxyStudyEndpoint(req, res, "/learn/events");
});

app.post("/api/learn/recording", async (req, res) => {
  proxyStudyEndpoint(req, res, "/learn/recording");
});

app.post("/api/external/launch", (req, res) => {
  try {
    const kind = stringValue(req.body?.kind);
    if (kind !== "ai-chat" && kind !== "metaverse") {
      res.status(400).json({
        message: "Unsupported external experience kind",
        detail: "kind must be ai-chat or metaverse"
      });
      return;
    }

    const auth = getRequestAuth(req);
    const userIdx = auth?.userIdx || getRequestUserIdx(req);
    const sessionId =
      auth?.sessionId ||
      req.get("x-metaon-session-id") ||
      req.get("x-uniplanet-session-id") ||
      DEFAULT_SESSION_ID ||
      "";
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const tokenPayload = {
      kind,
      userIdx,
      bookIdx: numberValue(req.body?.bookIdx ?? req.body?.book_idx),
      bookId: stringValue(req.body?.bookId),
      seriesGroup: numberValue(req.body?.seriesGroup),
      seriesIdx: numberValue(req.body?.seriesIdx),
      lastActivityId: stringValue(req.body?.lastActivityId),
      expiresAt
    };
    const payload = Buffer.from(JSON.stringify(tokenPayload)).toString("base64url");
    const launchToken = `${payload}.${createHmac("sha256", EXTERNAL_LAUNCH_SECRET).update(payload).digest("base64url")}`;
    const configuredUrl = kind === "ai-chat" ? AI_CHAT_URL : METAVERSE_URL;
    const iframeUrl = buildExternalIframeUrl(configuredUrl, {
      kind,
      launchToken,
      userIdx,
      bookIdx: tokenPayload.bookIdx,
      bookId: tokenPayload.bookId,
      seriesGroup: tokenPayload.seriesGroup,
      seriesIdx: tokenPayload.seriesIdx,
      lastActivityId: tokenPayload.lastActivityId
    });

    res.json({
      kind,
      auth: {
        session_id: sessionId,
        user_idx: userIdx,
        user_id: stringValue(auth?.user?.userId ?? auth?.user?.user_id),
        username: stringValue(auth?.user?.username ?? auth?.user?.userName)
      },
      iframeUrl,
      launchToken,
      expiresAt,
      isMock: !configuredUrl
    });
  } catch (error) {
    sendError(res, error, "Failed to create external launch");
  }
});

app.post("/api/recognition/speech", (_req, res) => {
  res.status(501).json({
    resultCode: 501,
    resultMessage: "Speech recognition proxy is not configured yet.",
    replacement: "Route browser recordings through this BFF once server credentials are provisioned."
  });
});

app.post("/api/recognition/handwriting", (_req, res) => {
  res.status(501).json({
    resultCode: 501,
    resultMessage: "Handwriting recognition proxy is not configured yet.",
    replacement: "Route canvas PNG payloads through this BFF once server credentials are provisioned."
  });
});

const distPath = path.resolve(__dirname, "../dist");
app.use(express.static(distPath));
app.get("*", (_req, res, next) => {
  const indexPath = path.join(distPath, "index.html");
  res.sendFile(indexPath, (error) => {
    if (error) next();
  });
});

app.listen(PORT, HOST, () => {
  console.log(`MetaOn BFF listening at http://${HOST}:${PORT}`);
});

const RAZ_PLACEMENT_SET_BY_ID = new Map(RAZ_PLACEMENT_SETS.map((set) => [set.id, set]));

function cleanupRazPlacementSessions() {
  const now = Date.now();
  for (const [sessionId, session] of razPlacementSessions.entries()) {
    if (now - session.updatedAt > RAZ_PLACEMENT_SESSION_TTL_MS) {
      razPlacementSessions.delete(sessionId);
    }
  }
}

function publicRazPlacementUnit(units, placementFormId, index, step, confirm) {
  const source = units[Math.max(0, Math.min(units.length - 1, index))];
  return {
    step,
    confirm,
    placementFormId,
    grade: source.grade,
    level: source.level,
    seriesId: source.seriesId,
    targetLexile: source.targetLexile,
    passage: source.passage,
    items: source.items.map((item) => ({
      id: item.id,
      skill: item.skill,
      q: item.q,
      choices: item.choices
    }))
  };
}

function gradeRazPlacementUnit(unit, answers) {
  const correct = unit.items.filter((item) => Number(answers[item.id]) === item.answerIndex).length;
  return {
    correct,
    ratio: unit.items.length > 0 ? correct / unit.items.length : 0
  };
}

function nextRazPlacementIndex(currentIndex, ratio, unitCount) {
  if (ratio >= 0.75) return Math.min(currentIndex + 1, unitCount - 1);
  if (ratio <= 0.5) return Math.max(currentIndex - 1, 0);
  return currentIndex;
}

function buildRazPlacementResult(session, units, finalIndex) {
  const targetIndex = Math.max(0, Math.min(units.length - 1, finalIndex));
  const target = units[targetIndex];
  const reading = ratioRecord(session.areaTotals.reading);
  const vocab = ratioRecord(session.areaTotals.vocab);
  const lexileValues = session.path
    .map((entry) => units.find((unit) => unit.grade === entry.grade && unit.level === entry.level)?.lexile)
    .filter((value) => Number.isFinite(value));
  const lexileAvg =
    lexileValues.length > 0 ? Math.round(lexileValues.reduce((sum, value) => sum + value, 0) / lexileValues.length) : target.lexile;

  return {
    done: true,
    sessionId: session.sessionId,
    name: session.name,
    placementFormId: session.placementFormId,
    placement: {
      grade: target.grade,
      level: target.level,
      index: targetIndex,
      measured: true,
      truncated: session.path.length >= 5,
      reachedCeiling: targetIndex === units.length - 1,
      belowFloor: targetIndex === 0,
      needsLowerStart: targetIndex === 0 && reading.ratio != null && reading.ratio < 0.5,
      lexileAvg
    },
    fluency: {
      totalMs: session.path.reduce((sum, entry) => sum + (entry.ms || 0), 0),
      msPerWord: averageMsPerWord(session.path),
      label: fluencyLabel(averageMsPerWord(session.path))
    },
    areas: {
      reading,
      vocab
    },
    gradeCompare: {
      count: Math.max(...session.path.map((entry) => entry.globalN || 0), 0),
      higherPct: gradeComparePercent(targetIndex)
    },
    path: session.path,
    recommendation: {
      target: {
        grade: target.grade,
        level: target.level,
        index: targetIndex
      },
      independent: recommendationBucket("혼자 읽기", Math.max(0, targetIndex - 1), units),
      instructional: recommendationBucket("추천 시작", targetIndex, units),
      challenge: recommendationBucket("도전 읽기", Math.min(units.length - 1, targetIndex + 1), units)
    }
  };
}

function ratioRecord(record) {
  return {
    correct: record.correct,
    total: record.total,
    ratio: record.total > 0 ? record.correct / record.total : null
  };
}

function averageMsPerWord(pathItems) {
  const totalMs = pathItems.reduce((sum, entry) => sum + (entry.ms || 0), 0);
  const words = pathItems.reduce((sum, entry) => sum + (entry.words || 0), 0);
  return words > 0 ? Math.round(totalMs / words) : null;
}

function fluencyLabel(msPerWord) {
  if (msPerWord == null) return null;
  if (msPerWord <= 900) return "빠르고 안정적";
  if (msPerWord <= 1500) return "적정 속도";
  return "천천히 읽기";
}

function wordCount(text) {
  return stringValue(text)
    .split(/\s+/)
    .filter(Boolean).length;
}

function gradeComparePercent(index) {
  return Math.max(8, Math.min(92, 78 - index * 8));
}

function recommendationBucket(role, index, units) {
  const unit = units[index];
  if (!unit) return null;
  const lexile = unit.lexile < 0 ? `BR${Math.abs(unit.lexile)}L` : `${unit.lexile}L`;
  return {
    role,
    grade: unit.grade,
    level: unit.level,
    count: 3,
    books: [
      {
        book_code: `${unit.grade}${unit.level}01`,
        title: sampleBookTitle(unit, 1),
        lexile,
        thumb_url: null
      },
      {
        book_code: `${unit.grade}${unit.level}02`,
        title: sampleBookTitle(unit, 2),
        lexile,
        thumb_url: null
      },
      {
        book_code: `${unit.grade}${unit.level}03`,
        title: sampleBookTitle(unit, 3),
        lexile,
        thumb_url: null
      }
    ]
  };
}

function sampleBookTitle(unit, number) {
  const titleWords = {
    P: ["My Cat", "I Can Run", "Happy Day"],
    K: ["Soup Day", "At Home", "The Red Pot"],
    "1": ["The Frog", "On the Leaf", "A Fast Jump"],
    "2": ["Farm Visit", "Eggs and Goats", "Thank You Farmer"],
    "3": ["Seed Test", "Water and Sprouts", "Class Notes"],
    "4": ["The Tiny Library", "Book Stand", "Neighbors Read"],
    "5": ["Desert Night", "Staying Cool", "Animal Survival"],
    "6": ["Before Refrigerators", "Keeping Food Safe", "Ice House"]
  };
  return titleWords[unit.grade]?.[number - 1] || `${unit.grade} Level ${unit.level} Book ${number}`;
}

async function proxyStudyEndpoint(req, res, endpoint) {
  try {
    const upstream = await postUpstream(endpoint, req.body || {}, req);
    if (upstream.sessionId) {
      res.setHeader("X-MetaOn-Session-Id", upstream.sessionId);
    }
    res.status(upstream.status).json(upstream.data);
  } catch (error) {
    sendError(res, error, `Failed to proxy ${endpoint}`);
  }
}

async function loadQuickCheckWithFallback(req) {
  const current = await postUpstream(
    "/study/getquickcheckquiz",
    buildCurrentQuickCheckRequest(req.body),
    req
  );
  if (isSuccessfulQuickCheckResponse(current, "quizzes")) {
    return normalizeQuickCheckPayload(current.data, QUICK_CHECK_CURRENT_CONTRACT);
  }

  const legacy = await postUpstream(
    "/study/getnewquickcheckquiz",
    buildLegacyQuickCheckRequest(req.body, getRequestUserIdx(req)),
    req
  );
  if (isSuccessfulQuickCheckResponse(legacy, "qlist")) {
    return normalizeQuickCheckPayload(legacy.data, QUICK_CHECK_UNITY_CONTRACT);
  }

  const error = new Error(
    `Quick Check contracts failed: current=${quickCheckFailureText(current)}, unity=${quickCheckFailureText(legacy)}`
  );
  error.status = current.status === 404 && legacy.status === 404 ? 404 : 502;
  throw error;
}

async function submitQuickCheckAttempt(req, attempt) {
  if (!Array.isArray(attempt.questions) || attempt.questions.length === 0) {
    const error = new Error("Quick Check has no questions to submit.");
    error.status = 400;
    throw error;
  }

  const submitted = normalizeSubmittedQuickCheckAnswers(attempt.questions, req.body?.answers);
  const validation = validateQuickCheckSubmission(attempt.questions, submitted.answersByQuestionId);
  if (!validation.complete) {
    const error = new Error(`Every question must be answered before submission: ${validation.incompleteQuestionIds.join(", ")}`);
    error.status = 400;
    throw error;
  }

  const context = {
    ...recordValue(attempt.context),
    ...recordValue(req.body?.context)
  };
  const currentSubmission = buildCurrentQuickCheckSubmission(
    req.body?.log_idx ?? req.body?.logIdx,
    attempt.questions,
    submitted.answersByQuestionId,
    submitted.metadataByQuestionId
  );
  const legacySubmission = buildLegacyQuickCheckSubmission({
    userIdx: getRequestUserIdx(req),
    context,
    questions: attempt.questions,
    answersByQuestionId: submitted.answersByQuestionId,
    metadataByQuestionId: submitted.metadataByQuestionId
  });

  const order = attempt.sourceContract === QUICK_CHECK_UNITY_CONTRACT
    ? [
        ["/study/newquizaccept", legacySubmission],
        ["/study/quizaccept", currentSubmission]
      ]
    : [
        ["/study/quizaccept", currentSubmission],
        ["/study/newquizaccept", legacySubmission]
      ];

  let lastUpstream;
  for (const [endpoint, submission] of order) {
    const upstream = await postUpstream(endpoint, submission.payload, req);
    lastUpstream = upstream;
    if (numberValue(upstream.data?.resultCode) !== 1 || upstream.status < 200 || upstream.status >= 300) {
      continue;
    }
    if (upstream.sessionId) {
      // The route writes this header after this helper returns.
      attempt.sessionId = upstream.sessionId;
    }
    return normalizeQuickCheckSubmission(upstream.data, attempt.questions, submission.score, false);
  }

  const error = new Error(`Quick Check submission contracts failed: ${quickCheckFailureText(lastUpstream)}`);
  error.status = lastUpstream?.status === 404 ? 404 : 502;
  throw error;
}

async function proxyQuickCheckLegacySubmission(req, res) {
  try {
    const current = await postUpstream("/study/quizaccept", req.body || {}, req);
    if (current.status >= 200 && current.status < 300 && numberValue(current.data?.resultCode) === 1) {
      if (current.sessionId) res.setHeader("X-MetaOn-Session-Id", current.sessionId);
      res.json(current.data);
      return;
    }

    const legacy = await postUpstream("/study/newquizaccept", req.body || {}, req);
    if (legacy.sessionId) res.setHeader("X-MetaOn-Session-Id", legacy.sessionId);
    res.status(legacy.status).json(legacy.data);
  } catch (error) {
    sendError(res, error, "Failed to proxy Quick Check submission");
  }
}

function cleanupQuickCheckAttempts() {
  const expiresBefore = Date.now() - QUICK_CHECK_ATTEMPT_TTL_MS;
  for (const [attemptId, attempt] of quickCheckAttempts) {
    if (attempt.createdAt < expiresBefore) quickCheckAttempts.delete(attemptId);
  }
}

function getQuickCheckOwnerKey(req) {
  return getCatalogCacheKey(req);
}

function quickCheckFailureText(upstream) {
  if (!upstream) return "not attempted";
  return `${upstream.status}:${numberValue(upstream.data?.resultCode)}:${stringValue(upstream.data?.resultMessage)}`;
}

function markQuickCheckDuplicate(result) {
  return {
    ...result,
    duplicate: true,
    result: {
      ...recordValue(result?.result),
      duplicate: true
    }
  };
}

async function getCatalog(req) {
  const now = Date.now();
  const cacheKey = getCatalogCacheKey(req);
  const refreshRequested = req.query?.refresh === "1" || /no-cache/i.test(req.get("cache-control") || "");
  const cached = catalogCache.get(cacheKey);
  if (!refreshRequested && cached && now - cached.cachedAt < CATALOG_TTL_MS) {
    return cached.catalog;
  }

  const upstream = await postUpstream("/content/getMyBrands", {}, req);
  assertMetaOnSuccess(upstream.data, "/content/getMyBrands");
  const normalized = normalizeCatalog(upstream.data);
  catalogCache.set(cacheKey, {
    catalog: normalized,
    cachedAt: now
  });
  return normalized;
}

async function findBook(req) {
  const { seriesGroup, seriesIdx, bookId } = req.params;
  if (!/^\d+$/.test(seriesGroup) || !/^\d+$/.test(seriesIdx) || !/^[A-Za-z0-9_.-]+$/.test(bookId)) {
    const error = new Error("Invalid book route parameters");
    error.status = 400;
    throw error;
  }

  const catalog = await getCatalog(req);
  const groupId = Number(seriesGroup);
  const seriesId = Number(seriesIdx);

  for (const group of catalog.groups) {
    for (const series of group.seriesList) {
      const seriesMatches = (group.groupId === groupId || series.seriesGroup === groupId) && series.seriesIdx === seriesId;
      const book = series.books.find((item) => {
        const bookMatches = item.seriesGroup === groupId && item.seriesIdx === seriesId;
        return item.bookId === bookId && (seriesMatches || bookMatches);
      });
      if (book) return book;
    }
  }

  const error = new Error(`Book package route not found for ${seriesGroup}/${seriesIdx}/${bookId}`);
  error.status = 404;
  throw error;
}

function buildBookAssetUrl(basePath, bookId, extension) {
  const cleanBasePath = String(basePath || "").replace(/\\/g, "/");
  if (!cleanBasePath || cleanBasePath.includes("..")) {
    throw new Error("Book CDN path is missing or unsafe");
  }

  const normalizedBase = cleanBasePath.endsWith("/") ? cleanBasePath : `${cleanBasePath}/`;
  if (/^https?:\/\//i.test(normalizedBase)) {
    return `${normalizedBase}${bookId}.${extension}`;
  }

  const assetPath = `${normalizedBase.replace(/^\/+/, "")}${bookId}.${extension}`;
  return `${CDN_ORIGIN.replace(/\/+$/, "")}/${assetPath}`;
}

function buildExternalIframeUrl(baseUrl, params) {
  const search = new URLSearchParams();
  search.set("launchToken", params.launchToken);
  search.set("userIdx", String(params.userIdx || 0));
  search.set("locale", "ko-KR");
  if (params.bookIdx) search.set("bookIdx", String(params.bookIdx));
  if (params.bookId) search.set("bookId", params.bookId);
  if (params.seriesGroup) search.set("seriesGroup", String(params.seriesGroup));
  if (params.seriesIdx) search.set("seriesIdx", String(params.seriesIdx));
  if (params.lastActivityId) search.set("lastActivityId", params.lastActivityId);

  if (!baseUrl) {
    return `mock://${params.kind}?${search.toString()}`;
  }

  const url = new URL(baseUrl);
  search.forEach((value, key) => url.searchParams.set(key, value));
  return url.toString();
}

async function postUpstream(endpoint, body, req, options = {}) {
  const auth = options.ignoreRequestAuth ? null : getRequestAuth(req);
  const { cookie, sessionId } = resolveUpstreamCredentials({
    auth,
    requestSessionId: req.get("x-metaon-session-id"),
    legacyRequestSessionId: req.get("x-uniplanet-session-id"),
    defaultSessionId: DEFAULT_SESSION_ID,
    defaultCookie: DEFAULT_COOKIE,
    options
  });
  const headers = {
    "Content-Type": "application/json",
    "App-Version": APP_VERSION,
    Platform: PLATFORM,
    "App-Idx": APP_IDX,
    "Session-Id": sessionId || ""
  };
  if (cookie) {
    headers.Cookie = cookie;
  }

  const upstream = await fetch(`${API_ORIGIN}${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  const text = await upstream.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = {
      resultCode: upstream.ok ? 1 : upstream.status,
      resultMessage: text
    };
  }

  return {
    status: upstream.ok ? 200 : upstream.status,
    sessionId: upstream.headers.get("session-id") || upstream.headers.get("Session-Id"),
    cookie: cookieHeaderFromSetCookie(upstream.headers.get("set-cookie")),
    data
  };
}

function assertMetaOnSuccess(data, endpoint) {
  const resultCode = numberValue(data?.resultCode);
  if (resultCode === 1) return;

  const error = new Error(`${endpoint} returned resultCode ${resultCode}: ${stringValue(data?.resultMessage)}`);
  error.status = 502;
  error.resultCode = resultCode;
  throw error;
}

function createAuthSession(loginData, upstream) {
  const userIdx = numberValue(loginData?.userIdx ?? loginData?.user_idx);
  if (!userIdx) {
    const error = new Error("MetaOn login response did not include userIdx.");
    error.status = 502;
    throw error;
  }

  const sessionId = upstream.sessionId || "";
  const cookie = upstream.cookie || (sessionId ? `JSESSIONID=${sessionId}` : "");
  if (!cookie && !sessionId) {
    const error = new Error("MetaOn login did not return a reusable cookie or Session-Id.");
    error.status = 502;
    throw error;
  }

  return {
    userIdx,
    sessionId,
    cookie,
    user: {
      userIdx,
      userId: stringValue(loginData?.userId ?? loginData?.user_id),
      username: stringValue(loginData?.username) || stringValue(loginData?.userName) || `User ${userIdx}`,
      email: stringValue(loginData?.email),
      joinstep: numberValue(loginData?.joinstep),
      role: numberValue(loginData?.role),
      hqIdx: numberValue(loginData?.hq_idx),
      acadIdx: numberValue(loginData?.acad_idx)
    }
  };
}

function getRequestUserIdx(req) {
  const auth = getRequestAuth(req);
  if (auth?.userIdx) return auth.userIdx;

  const headerUserIdx = numberValue(req.get("x-metaon-user-idx"));
  if (headerUserIdx) return headerUserIdx;

  return DEFAULT_USER_IDX;
}

function getCatalogCacheKey(req) {
  const auth = getRequestAuth(req);
  const userIdx = getRequestUserIdx(req);
  const sessionKey = auth?.sessionId || auth?.cookie || req.get("x-metaon-session-id") || DEFAULT_SESSION_ID || DEFAULT_COOKIE || "public";
  return `${userIdx}:${hashValue(sessionKey)}`;
}

function getRequestAuth(req) {
  const token = readCookie(req.headers.cookie || "", AUTH_COOKIE_NAME);
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature || !verifySignature(payload, signature)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object") return null;
    return {
      userIdx: numberValue(parsed.userIdx),
      sessionId: stringValue(parsed.sessionId),
      cookie: stringValue(parsed.cookie),
      user: parsed.user && typeof parsed.user === "object" ? parsed.user : null
    };
  } catch {
    return null;
  }
}

function setAuthCookie(res, auth) {
  const payload = Buffer.from(
    JSON.stringify({
      userIdx: auth.userIdx,
      sessionId: auth.sessionId || "",
      cookie: auth.cookie || "",
      user: auth.user
    })
  ).toString("base64url");
  const signature = signValue(payload);
  res.setHeader("Set-Cookie", serializeCookie(AUTH_COOKIE_NAME, `${payload}.${signature}`, {
    httpOnly: true,
    secure: AUTH_COOKIE_SECURE,
    sameSite: "Lax",
    path: "/api",
    maxAge: AUTH_COOKIE_MAX_AGE_SECONDS
  }));
}

function clearAuthCookie(res) {
  res.setHeader("Set-Cookie", serializeCookie(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: AUTH_COOKIE_SECURE,
    sameSite: "Lax",
    path: "/api",
    maxAge: 0
  }));
}

function normalizeManualSession(value) {
  const raw = stringValue(value).trim();
  if (!raw) {
    return { sessionId: "", cookie: "" };
  }

  const withoutCookiePrefix = raw.replace(/^Cookie:\s*/i, "");
  if (withoutCookiePrefix.includes("=")) {
    const cookie = withoutCookiePrefix
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .join("; ");
    const jsession = /(?:^|;\s*)JSESSIONID=([^;]+)/i.exec(cookie)?.[1] || "";
    return {
      sessionId: jsession || raw,
      cookie
    };
  }

  return {
    sessionId: raw,
    cookie: `JSESSIONID=${raw}`
  };
}

function cookieHeaderFromSetCookie(setCookie) {
  if (!setCookie) return "";
  return setCookie
    .split(/,(?=\s*[^;,]+=)/)
    .map((item) => item.split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");
}

function readCookie(cookieHeader, name) {
  const target = `${name}=`;
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(target))
    ?.slice(target.length);
}

function serializeCookie(name, value, options) {
  const parts = [`${name}=${value}`];
  if (options.maxAge != null) parts.push(`Max-Age=${options.maxAge}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

function signValue(value) {
  return createHmac("sha256", AUTH_COOKIE_SECRET).update(value).digest("base64url");
}

function verifySignature(value, signature) {
  const expected = signValue(value);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

function hashValue(value) {
  return createHmac("sha256", AUTH_COOKIE_SECRET).update(stringValue(value)).digest("hex").slice(0, 16);
}

function normalizeCatalog(raw) {
  const rawBrands = firstArray(raw?.brandlist, raw?.brandList, raw?.brands);
  const normalizedBrands =
    rawBrands.length > 0
      ? rawBrands.map(normalizeBrand)
      : firstArray(raw?.brands).map((brand) => normalizeBrandFromNormalized(brand));
  const rawGroups = firstArray(raw?.sgrouplist, raw?.sgroupList, raw?.seriesGroup, raw?.groups);
  const rawPackages = firstArray(raw?.plist, raw?.packageList, raw?.packagelist, raw?.packages);
  const packageGroups = rawPackages.flatMap(normalizePackageGroups);
  const groups = mergeGroups([
    ...rawGroups.map(normalizeGroup),
    ...normalizedBrands.flatMap((brand) => brand.groups),
    ...packageGroups
  ]);
  const brands = attachGroupsToBrands(normalizedBrands, groups);

  return {
    resultCode: numberValue(raw?.resultCode),
    resultMessage: stringValue(raw?.resultMessage),
    fetchedAt: new Date().toISOString(),
    brands: brands.length > 0 ? brands : deriveBrands(groups),
    groups
  };
}

function normalizeBookResourceManifest(raw) {
  const rawBook = recordValue(raw?.book ?? raw);
  const book = normalizeBook(rawBook, numberValue(rawBook.sg_idx), numberValue(rawBook.series_idx), "");
  const resources = new Map();
  const generatedFiles = [];
  const lessonDays = [];

  firstArray(rawBook.lessons).forEach((rawLesson, lessonIndex) => {
    const lesson = recordValue(rawLesson);
    const lessonNumber = numberValue(lesson.num) || lessonIndex + 1;
    const lessonIdx = numberValue(lesson.lesson_idx ?? lesson.lessonIdx);
    const lessonTitle = stringValue(lesson.name) || `Lesson ${lessonNumber}`;

    firstArray(lesson.days).forEach((rawDay, dayIndex) => {
      const day = recordValue(rawDay);
      const dayNumber = numberValue(day.num) || dayIndex + 1;
      const dayIdx = numberValue(day.day_idx ?? day.dayIdx);
      const virtualBase = `Lessons/L${lessonNumber}/D${dayNumber}`;
      const activities = firstArray(day.activities).map((rawActivity, activityIndex) =>
        normalizeBookInfoActivity(rawActivity, dayIdx, activityIndex)
      );

      generatedFiles.push(jsonFile(`${virtualBase}/word/info_word.json`, {
        word: firstArray(day.word).map((rawWord) => {
          const word = recordValue(rawWord);
          return {
            Word_Idx: numberValue(word.word_idx ?? word.wordIdx),
            Eng: stringValue(word.word),
            Mean: firstMeaning(word),
            Sentence: stringValue(word.example),
            WordClass: stringValue(word.word_class ?? word.wordClass)
          };
        })
      }));
      generatedFiles.push(jsonFile(`${virtualBase}/sentence/info_sentence.json`, {
        sentence: firstArray(day.sentence).map((rawSentence) => {
          const sentence = recordValue(rawSentence);
          return {
            Sentence_Idx: numberValue(sentence.sentence_idx ?? sentence.sentenceIdx),
            Eng: stringValue(sentence.sentence),
            Mean: firstMeaning(sentence),
            Slice: stringValue(sentence.slice),
            Blank_Index: sentenceBlankIndex(sentence)
          };
        })
      }));
      generatedFiles.push(jsonFile(`${virtualBase}/listening/01/info_listen_ebook.json`, toListenEbookInfo(day, virtualBase, book)));

      collectBookInfoResources(day, virtualBase, resources);
      lessonDays.push({
        id: dayIdx ? String(dayIdx) : `${lessonNumber}:${dayNumber}`,
        lessonIdx,
        dayIdx,
        lesson: lessonNumber,
        day: dayNumber,
        title: stringValue(day.name) || `${lessonTitle} Day ${dayNumber}`,
        lessonTitle,
        dayTitle: stringValue(day.name),
        basePath: stringValue(day.base_path ?? day.basePath),
        activities
      });
    });
  });

  return {
    key: book.bookIdx ? `book:${book.bookIdx}` : `${book.seriesGroup}:${book.seriesIdx}:${book.bookId}`,
    book,
    progress: {
      actTotal: numberValue(rawBook.progress?.act_total),
      actDone: numberValue(rawBook.progress?.act_done)
    },
    lessonDays,
    resources: Array.from(resources.values()),
    generatedFiles,
    raw
  };
}

const METAON_ACTIVITY_CODE = {
  listenRead: "EBOOK01",
  wordCard: "WDCA01",
  wordQuiz: "WDQU01",
  wordBlank: "WDBL01",
  matchingGame: "WDPL01",
  memoryCard: "WDPL02",
  sentenceBlank: "STBL01",
  unscramble: "STSC01",
  sentenceRecord: "STRC01",
  quickCheck: "QCHK01"
};

const actTypeByActivityCode = new Map([
  [METAON_ACTIVITY_CODE.wordCard, 1017],
  [METAON_ACTIVITY_CODE.wordQuiz, 1004],
  [METAON_ACTIVITY_CODE.wordBlank, 1005],
  [METAON_ACTIVITY_CODE.matchingGame, 8],
  [METAON_ACTIVITY_CODE.memoryCard, 15],
  [METAON_ACTIVITY_CODE.sentenceBlank, 1006],
  [METAON_ACTIVITY_CODE.unscramble, 1007],
  [METAON_ACTIVITY_CODE.sentenceRecord, 1009],
  [METAON_ACTIVITY_CODE.quickCheck, 65]
]);

const activityCodeByActType = new Map([
  [67, METAON_ACTIVITY_CODE.listenRead],
  [66, METAON_ACTIVITY_CODE.listenRead],
  [17, METAON_ACTIVITY_CODE.wordCard],
  [26, METAON_ACTIVITY_CODE.wordCard],
  [117, METAON_ACTIVITY_CODE.wordCard],
  [1017, METAON_ACTIVITY_CODE.wordCard],
  [21, METAON_ACTIVITY_CODE.wordCard],
  [4, METAON_ACTIVITY_CODE.wordQuiz],
  [1004, METAON_ACTIVITY_CODE.wordQuiz],
  [5, METAON_ACTIVITY_CODE.wordBlank],
  [1005, METAON_ACTIVITY_CODE.wordBlank],
  [8, METAON_ACTIVITY_CODE.matchingGame],
  [15, METAON_ACTIVITY_CODE.memoryCard],
  [6, METAON_ACTIVITY_CODE.sentenceBlank],
  [1006, METAON_ACTIVITY_CODE.sentenceBlank],
  [7, METAON_ACTIVITY_CODE.unscramble],
  [1007, METAON_ACTIVITY_CODE.unscramble],
  [9, METAON_ACTIVITY_CODE.sentenceRecord],
  [1009, METAON_ACTIVITY_CODE.sentenceRecord],
  [65, METAON_ACTIVITY_CODE.quickCheck]
]);

const titleByActivityCode = new Map([
  [METAON_ACTIVITY_CODE.listenRead, "Listen & Read"],
  [METAON_ACTIVITY_CODE.wordCard, "Word Card"],
  [METAON_ACTIVITY_CODE.wordQuiz, "Word Quiz"],
  [METAON_ACTIVITY_CODE.wordBlank, "Word Blank"],
  [METAON_ACTIVITY_CODE.matchingGame, "Matching Game"],
  [METAON_ACTIVITY_CODE.memoryCard, "Memory Card"],
  [METAON_ACTIVITY_CODE.sentenceBlank, "Sentence Blank"],
  [METAON_ACTIVITY_CODE.unscramble, "Unscramble"],
  [METAON_ACTIVITY_CODE.sentenceRecord, "Sentence Record"],
  [METAON_ACTIVITY_CODE.quickCheck, "Quick Check"]
]);

function normalizeActivityCodeValue(value) {
  return value == null ? "" : String(value).trim().toUpperCase();
}

function resolveActTypeFromActivityCode(value, { category = "", title = "" } = {}) {
  const code = normalizeActivityCodeValue(value);
  if (!code) return undefined;
  if (code === METAON_ACTIVITY_CODE.listenRead) {
    return isReadingOnlyActivityCode({ category, title }) ? 66 : 67;
  }
  const mapped = actTypeByActivityCode.get(code);
  if (mapped) return mapped;
  const parsed = Number(code);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function canonicalActivityCodeForActType(actType, fallback) {
  const normalizedFallback = normalizeActivityCodeValue(fallback);
  if (normalizedFallback && (actTypeByActivityCode.has(normalizedFallback) || normalizedFallback === METAON_ACTIVITY_CODE.listenRead)) {
    return normalizedFallback;
  }
  return activityCodeByActType.get(actType) || normalizedFallback || String(actType || "");
}

function activityTitleForCode(activityCode, fallbackTitle) {
  return titleByActivityCode.get(normalizeActivityCodeValue(activityCode)) || fallbackTitle;
}

function isReadingOnlyActivityCode({ category = "", title = "" }) {
  const normalizedCategory = normalizeActivityCodeValue(category).toLowerCase();
  const normalizedTitle = normalizeActivityCodeValue(title).toLowerCase();
  return normalizedCategory === "reading" && !normalizedTitle.includes("listen");
}

function normalizeBookInfoActivity(rawActivity, dayIdx, index) {
  const activity = recordValue(rawActivity);
  const actIdx = numberValue(activity.act_idx ?? activity.actIdx);
  const rawActCode = activity.act_code ?? activity.actCode ?? activity.code;
  const actNumber = numberValue(activity.num) || index + 1;
  const category = stringValue(activity.category);
  const rawTitle = stringValue(activity.act_name ?? activity.actName ?? activity.title);
  const normalizedActType = resolveActTypeFromActivityCode(rawActCode, { category, title: rawTitle }) || 46;
  const activityCode = canonicalActivityCodeForActType(normalizedActType, rawActCode);
  const legacyActCode = normalizeActivityCodeValue(rawActCode);
  const fallbackTitle = rawTitle || `Activity ${actNumber}`;
  return {
    id: actIdx ? String(actIdx) : `${normalizedActType}:${index}`,
    actIdx,
    dayIdx,
    activityCode,
    legacyActCode: legacyActCode && legacyActCode !== activityCode ? legacyActCode : undefined,
    actType: normalizedActType,
    actNum: index,
    category,
    title: activityTitleForCode(activityCode, fallbackTitle),
    raw: rawActivity
  };
}

function collectBookInfoResources(day, virtualBase, resources) {
  firstArray(day.word).forEach((rawWord, index) => {
    const word = recordValue(rawWord);
    addBookInfoResource(resources, `${virtualBase}/word/img/word_${twoDigit(index + 1)}.png`, stringValue(word.img), "word");
    addBookInfoResource(resources, `${virtualBase}/word/snd/snd_word_${twoDigit(index + 1)}.mp3`, stringValue(word.snd), "word");
  });
  firstArray(day.sentence).forEach((rawSentence, index) => {
    const sentence = recordValue(rawSentence);
    addBookInfoResource(resources, `${virtualBase}/sentence/snd/snd_sentence_${twoDigit(index + 1)}.mp3`, stringValue(sentence.snd), "sentence");
  });
  firstArray(day.reading).forEach((rawReading, index) => {
    const reading = recordValue(rawReading);
    addBookInfoResource(resources, `${virtualBase}/reading/01/img/img_${twoDigit(index + 1)}.png`, stringValue(reading.img), "reading");
    addBookInfoResource(resources, `${virtualBase}/reading/01/snd/snd_${twoDigit(index + 1)}_01.mp3`, stringValue(reading.snd1), "reading");
    addBookInfoResource(resources, `${virtualBase}/reading/01/snd/snd_${twoDigit(index + 1)}_02.mp3`, stringValue(reading.snd2), "reading");
    collectCaptionBookInfoResources(reading, virtualBase, index + 1, "reading", resources);
  });
  firstArray(day.listening).forEach((rawListening, index) => {
    const listening = recordValue(rawListening);
    addBookInfoResource(resources, `${virtualBase}/listening/01/video/video_${twoDigit(index + 1)}.mp4`, stringValue(listening.mp4), "listening");
    collectCaptionBookInfoResources(listening, virtualBase, index + 1, "listening", resources);
  });
  collectEbookBookInfoResources(day, virtualBase, resources);
}

function collectEbookBookInfoResources(day, virtualBase, resources) {
  const ebook = ebookBookInfoRecord(day);
  if (!ebook) return;

  const ebookBase = `${virtualBase}/ebook`;
  const bookJsonPath = firstBookInfoResourcePath(ebook.book_json, ebook.bookJson, ebook.book, ebook.json, ebook.manifest, ebook.path);
  addBookInfoResource(resources, `${ebookBase}/book.json`, bookJsonPath, "ebook");

  const assets = recordValue(ebook.assets);
  collectEbookBookInfoAssetEntries(resources, ebookBase, "pages", [...firstArray(assets.pages), ...firstArray(ebook.pages)]);
  collectEbookBookInfoAssetEntries(resources, ebookBase, "audio", [...firstArray(assets.audio), ...firstArray(ebook.audio), ...firstArray(ebook.audios)]);
}

function ebookBookInfoRecord(day) {
  const candidates = [day.ebook, day.e_book, day.listen_ebook, day.listenEbook, day.listen_ebook_resource, day.listenEbookResource];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      const firstRecord = candidate.map(recordValue).find((item) => Object.keys(item).length > 0);
      if (firstRecord) return firstRecord;
    }
    const record = recordValue(candidate);
    if (Object.keys(record).length > 0) return record;
  }
  return undefined;
}

function collectEbookBookInfoAssetEntries(resources, ebookBase, kind, entries) {
  entries.forEach((entry, index) => {
    if (typeof entry === "string") {
      addBookInfoResource(resources, ebookBookInfoVirtualPath(ebookBase, kind, entry, index), entry, "ebook");
      return;
    }

    const record = recordValue(entry);
    const paths =
      kind === "pages"
        ? [firstBookInfoResourcePath(record.image, record.imagePath, record.page, record.path)]
        : firstBookInfoResourcePaths(record.audioPaths, record.audio, record.audios, record.path);
    paths.filter(Boolean).forEach((path, pathIndex) => {
      addBookInfoResource(resources, ebookBookInfoVirtualPath(ebookBase, kind, path, index + pathIndex), path, "ebook");
    });
  });
}

function ebookBookInfoVirtualPath(ebookBase, kind, sourcePath, index) {
  const normalized = sourcePath.replace(/\\/g, "/").split("?")[0];
  const marker = "/ebook/";
  const markerIndex = normalized.toLowerCase().lastIndexOf(marker);
  if (markerIndex >= 0) return `${ebookBase}/${normalized.slice(markerIndex + marker.length)}`;

  const fileName = normalized.split("/").filter(Boolean).pop() || `${kind === "pages" ? "page" : "audio"}_${twoDigit(index + 1)}`;
  return `${ebookBase}/assets/${kind}/${fileName}`;
}

function firstBookInfoResourcePath(...values) {
  return firstBookInfoResourcePaths(...values)[0] || "";
}

function firstBookInfoResourcePaths(...values) {
  for (const value of values) {
    if (Array.isArray(value)) {
      const paths = value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim());
      if (paths.length > 0) return paths;
    }
    if (typeof value === "string" && value.trim()) return [value.trim()];
  }
  return [];
}

function toListenEbookInfo(day, virtualBase, book) {
  const readings = firstArray(day.reading).map(recordValue);
  const sentences = firstArray(day.sentence).map(recordValue);
  const listeningRows = firstArray(day.listening).map(recordValue);
  const knownCaptionPages = knownListenCaptionPages(book.bookCode || book.bookId);
  const readingAudioCounts = readings.map((reading) => [stringValue(reading.snd1), stringValue(reading.snd2)].filter(Boolean).length);
  const sentenceItems = sentences.map((sentence, index) => ({
    text: splitCaptionSentences(firstCaptionText(sentence.sentence, sentence.eng, sentence.Eng, sentence.text, sentence.script, sentence.caption))[0] || "",
    audioPath: stringValue(sentence.snd) ? `${virtualBase}/sentence/snd/snd_sentence_${twoDigit(index + 1)}.mp3` : ""
  }));
  const distributedSentenceItems = distributeListenItems(sentenceItems, readings.length, readingAudioCounts);
  const fallbackCaptionPages = buildFallbackListenCaptionPages(
    book,
    sentenceItems.map((item) => item.text),
    readings.length,
    readingAudioCounts,
    knownCaptionPages
  );
  const fallbackVideoPaths = listeningRows
    .map((listening, index) => stringValue(listening.mp4) ? `${virtualBase}/listening/01/video/video_${twoDigit(index + 1)}.mp4` : "")
    .filter(Boolean);

  const pages = readings
    .map((reading, index) => {
      const pageNumber = index + 1;
      const imagePath = stringValue(reading.img) ? `${virtualBase}/reading/01/img/img_${twoDigit(pageNumber)}.png` : "";
      const audioPaths = [
        stringValue(reading.snd1) ? `${virtualBase}/reading/01/snd/snd_${twoDigit(pageNumber)}_01.mp3` : "",
        stringValue(reading.snd2) ? `${virtualBase}/reading/01/snd/snd_${twoDigit(pageNumber)}_02.mp3` : ""
      ].filter(Boolean);
      const captionPaths = captionBookInfoVirtualPaths(reading, virtualBase, pageNumber, "reading");
      const sentencePageItems = (distributedSentenceItems[index] || []).filter((item) => item.text && item.audioPath);
      const inlineTexts = splitCaptionSentences(
        firstCaptionText(reading.caption, reading.subtitle, reading.script, reading.text, reading.sentence, reading.eng, reading.Eng)
      );
      const pageAudioPaths = audioPaths.length > 0 ? audioPaths : sentencePageItems.map((item) => item.audioPath);
      const fallbackTexts = fallbackCaptionPages[index] || [];
      const captionTexts =
        inlineTexts.length > 0
          ? inlineTexts
          : fallbackTexts.length > 0
            ? fallbackTexts
            : audioPaths.length === 0 && sentencePageItems.length > 0
              ? sentencePageItems.map((item) => item.text)
              : [];
      const captions = buildGeneratedListenCues(index, pageAudioPaths.length, captionTexts);

      return {
        pageIndex: index,
        imagePath,
        audioPaths: pageAudioPaths,
        captionPaths,
        captions
      };
    })
    .filter((page) => page.imagePath || page.audioPaths.length > 0 || page.captionPaths.length > 0);

  return {
    version: 1,
    source: "metaon3-reading",
    pages,
    captionPaths: pages.flatMap((page) => page.captionPaths),
    fallbackVideoPaths
  };
}

function knownListenCaptionPages(bookCode) {
  const normalized = stringValue(bookCode).trim().toUpperCase();
  // GPLaa01 reading pages include spread text that is not present in the sentence API.
  if (normalized === "GPLAA01") {
    return [
      ["Over"],
      ["Over the log.", "Over the pot."],
      ["Over the hole.", "Over the bike."],
      ["Over the bat.", "Over the ball."],
      ["Over the doll.", "Over the cat."]
    ];
  }
  return [];
}

function buildFallbackListenCaptionPages(book, sentenceTexts, pageCount, audioCounts, knownCaptionPages) {
  if (knownCaptionPages.some((page) => page.length > 0)) return knownCaptionPages;

  const cleanSentenceTexts = sentenceTexts.map((text) => text.trim()).filter(Boolean);
  const result = Array.from({ length: pageCount }, () => []);
  if (cleanSentenceTexts.length === 0 || pageCount === 0) return result;

  const titleText = listenBookTitle(book);
  const hasTitlePage = Boolean(titleText) && pageCount > 1 && Math.max(audioCounts[0] || 0, 0) <= 1;
  if (hasTitlePage) {
    result[0] = [titleText];
  }

  const startPage = hasTitlePage ? 1 : 0;
  const distributedTexts = distributeListenItems(cleanSentenceTexts, pageCount - startPage, audioCounts.slice(startPage));
  distributedTexts.forEach((texts, index) => {
    result[index + startPage] = texts;
  });

  return result;
}

function listenBookTitle(book) {
  return stringValue(book.title || book.bookName || book.bookCode || book.bookId).trim();
}

function distributeListenItems(items, pageCount, audioCounts) {
  const result = Array.from({ length: pageCount }, () => []);
  if (items.length === 0 || pageCount === 0) return result;

  let cursor = 0;

  for (let pageIndex = 0; pageIndex < pageCount && cursor < items.length; pageIndex += 1) {
    const remainingPages = pageCount - pageIndex - 1;
    const remainingItems = items.length - cursor;
    const capacity = Math.max(audioCounts[pageIndex] || 1, 1);
    const count = Math.min(capacity, Math.max(1, remainingItems - remainingPages));
    for (let index = 0; index < count && cursor < items.length; index += 1) {
      result[pageIndex].push(items[cursor]);
      cursor += 1;
    }
  }

  while (cursor < items.length) {
    result[pageCount - 1].push(items[cursor]);
    cursor += 1;
  }

  return result;
}

function buildGeneratedListenCues(pageIndex, audioCount, captionTexts) {
  const cleanTexts = captionTexts.map((text) => text.trim()).filter(Boolean);
  if (cleanTexts.length === 0 || audioCount === 0) return [];

  if (audioCount === 1 && cleanTexts.length > 1) {
    return cleanTexts.map((text, index) => generatedListenCue(pageIndex, 0, text, index * 60000, (index + 1) * 60000));
  }

  return Array.from({ length: audioCount }, (_, audioIndex) =>
    generatedListenCue(pageIndex, audioIndex, cleanTexts[Math.min(audioIndex, cleanTexts.length - 1)])
  );
}

function splitCaptionSentences(value) {
  const normalized = value.replace(/\[[^\]]*\]/g, "").replace(/\//g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const matches = normalized.match(/[^.!?。！？]+[.!?。！？]+|[^.!?。！？]+$/g) || [normalized];
  return matches.map((item) => item.trim()).filter(Boolean);
}

function generatedListenCue(pageIndex, audioIndex, text, startMs = 0, endMs = 3600000) {
  return {
    pageIndex,
    audioIndex,
    startMs,
    endMs,
    text
  };
}

function collectCaptionBookInfoResources(record, virtualBase, index, source, resources) {
  captionBookInfoSourceEntries(record).forEach(({ key, value }) => {
    if (!isCaptionResourcePath(value)) return;
    addBookInfoResource(resources, captionBookInfoVirtualPath(virtualBase, index, source, key, value), value, "listening-caption");
  });
}

function captionBookInfoVirtualPaths(record, virtualBase, index, source) {
  return captionBookInfoSourceEntries(record)
    .filter(({ value }) => isCaptionResourcePath(value))
    .map(({ key, value }) => captionBookInfoVirtualPath(virtualBase, index, source, key, value));
}

function captionBookInfoVirtualPath(virtualBase, index, source, key, sourcePath) {
  const extension = sourcePath.split("?")[0].split(".").pop()?.toLowerCase() || "txt";
  return `${virtualBase}/listening/01/caption/${source}_${twoDigit(index)}_${key}.${extension}`;
}

function captionBookInfoSourceEntries(record) {
  return [
    "smi",
    "smi_path",
    "smiPath",
    "vtt",
    "vtt_path",
    "vttPath",
    "caption",
    "caption_path",
    "captionPath",
    "subtitle",
    "subtitle_path",
    "subtitlePath"
  ]
    .map((key) => ({ key, value: stringValue(record[key]) }))
    .filter((entry) => entry.value.length > 0);
}

function isCaptionResourcePath(value) {
  const lower = value.toLowerCase().split("?")[0];
  return value.startsWith("/") || /\.(smi|srt|vtt|json|txt)$/.test(lower);
}

function firstCaptionText(...values) {
  for (const value of values) {
    const text = stringValue(value);
    if (text && !isCaptionResourcePath(text)) return text;
  }
  return "";
}

function addBookInfoResource(resources, path, sourcePath, category) {
  if (!sourcePath) return;
  resources.set(path, {
    path,
    sourcePath,
    url: assetUrl(sourcePath),
    mimeType: mimeTypeForPath(sourcePath),
    category
  });
}

function jsonFile(path, value) {
  return {
    path,
    content: JSON.stringify(value),
    mimeType: "application/json"
  };
}

function firstMeaning(value) {
  const meanings = firstArray(value.meanings).map(recordValue);
  const korean = meanings.find((item) => stringValue(item.nation).toUpperCase() === "KR");
  return stringValue((korean || meanings[0] || {}).meaning);
}

function twoDigit(value) {
  return String(value).padStart(2, "0");
}

function mimeTypeForPath(path) {
  const clean = path.toLowerCase().split("?")[0];
  if (clean.endsWith(".png")) return "image/png";
  if (clean.endsWith(".jpg") || clean.endsWith(".jpeg")) return "image/jpeg";
  if (clean.endsWith(".mp3")) return "audio/mpeg";
  if (clean.endsWith(".mp4")) return "video/mp4";
  if (clean.endsWith(".json")) return "application/json";
  if (clean.endsWith(".smi")) return "application/smil+xml";
  if (clean.endsWith(".srt")) return "application/x-subrip";
  if (clean.endsWith(".vtt")) return "text/vtt";
  if (clean.endsWith(".txt")) return "text/plain";
  return "application/octet-stream";
}

function normalizePackageGroups(rawPackage) {
  const packageData = recordValue(rawPackage);
  const packageName = stringValue(packageData.pkgname ?? packageData.pkgName ?? packageData.packageName ?? packageData.name);
  const mainImageUrl = stringValue(packageData.mimgurl ?? packageData.mainImageUrl);
  return firstArray(packageData.sglist, packageData.sgList, packageData.pkgsglist, packageData.pkgsgList, packageData.packageGroups, packageData.groups).map((group) =>
    normalizePackageGroup(group, packageName, mainImageUrl)
  );
}

function normalizePackageGroup(rawGroup, packageName, mainImageUrl) {
  const group = recordValue(rawGroup);
  const groupId = readGroupId(rawGroup);
  const appVersion = stringValue(group.aver ?? group.aVer ?? group.appversion ?? group.appVersion);
  const seriesList = firstArray(group.slist, group.serieslist, group.seriesList).map((series) =>
    normalizePackageSeries(series, groupId, appVersion)
  );

  return {
    groupId,
    groupName: stringValue(group.pkgsgname ?? group.pkgsgName ?? group.sgName ?? group.sgroupName ?? group.groupName),
    groupNumber: numberValue(group.pkgsgnum ?? group.pkgsgNum ?? group.sgNum ?? group.sgroupNum ?? group.groupNum ?? group.groupNumber),
    appVersion,
    brandId: 0,
    brandName: packageName,
    mainImageUrl: stringValue(group.mimgurl ?? group.mainImageUrl ?? mainImageUrl),
    seriesList
  };
}

function normalizePackageSeries(rawSeries, groupId, groupVersion) {
  const series = recordValue(rawSeries);
  const seriesIdx = readSeriesIdx(rawSeries);
  const appVersion = stringValue(series.aver ?? series.aVer ?? series.appversion ?? series.appVersion) || groupVersion;
  const books = collectPackageBooks(rawSeries).map((book) => normalizeBook(book, groupId, seriesIdx || readSeriesIdx(book), appVersion));

  return {
    seriesGroup: groupId,
    seriesIdx,
    seriesName: stringValue(series.pkgsrname ?? series.pkgsrName ?? series.sName ?? series.seriesName),
    seriesNumber: numberValue(series.pkgsrnum ?? series.pkgsrNum ?? series.sNum ?? series.seriesNum ?? series.seriesNumber),
    mainImageUrl: stringValue(series.mimgurl ?? series.mainImageUrl),
    icon1Url: stringValue(series.icon1url ?? series.icon1Url),
    icon2Url: stringValue(series.icon2url ?? series.icon2Url),
    appVersion,
    books
  };
}

function collectPackageBooks(value, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return [];
  seen.add(value);

  const source = recordValue(value);
  const directBooks = firstArray(source.blist, source.booklist, source.bookList, source.books);
  if (directBooks.length > 0 && directBooks.some((book) => readBookId(book))) {
    return directBooks;
  }

  const nested = [];
  for (const item of Object.values(source)) {
    if (Array.isArray(item)) {
      for (const child of item) nested.push(...collectPackageBooks(child, seen));
    } else {
      nested.push(...collectPackageBooks(item, seen));
    }
  }
  return nested;
}

function normalizeBrand(brand) {
  const brandId = readBrandId(brand);
  const brandName = readBrandName(brand, true);
  const mainImageUrl = assetUrl(stringValue(brand?.mimgurl ?? brand?.mainImageUrl ?? brand?.thumb_url ?? brand?.thumbUrl));
  const groups = firstArray(brand?.sglist, brand?.sgList, brand?.sgrouplist, brand?.sgroupList, brand?.series_groups, brand?.seriesGroups, brand?.seriesGroup, brand?.groups).map((group) =>
    normalizeBrandGroup(group, brandId, brandName, mainImageUrl)
  );

  return {
    brandId,
    brandName,
    mainImageUrl,
    groups
  };
}

function normalizeBrandFromNormalized(brand) {
  const brandId = readBrandId(brand);
  const brandName = readBrandName(brand, true);
  const mainImageUrl = assetUrl(stringValue(brand?.mainImageUrl ?? brand?.mimgurl ?? brand?.thumb_url ?? brand?.thumbUrl));
  const groups = firstArray(brand?.groups, brand?.sglist, brand?.sgList, brand?.sgrouplist, brand?.sgroupList, brand?.series_groups, brand?.seriesGroups, brand?.seriesGroup).map((group) =>
    normalizeBrandGroup(group, brandId, brandName, mainImageUrl)
  );

  return {
    brandId,
    brandName,
    mainImageUrl,
    groups
  };
}

function normalizeBrandGroup(rawGroup, brandId, brandName, mainImageUrl) {
  const groupId = readGroupId(rawGroup);
  return normalizeGroup({
    ...(groupId ? { sgIdx: groupId } : {}),
    ...recordValue(rawGroup),
    brandId,
    brandName,
    brandImageUrl: mainImageUrl
  });
}

function normalizeGroup(group) {
  const rawGroup = group;
  group = recordValue(group);
  const groupId = readGroupId(rawGroup);
  const groupVersion = stringValue(group.aVer ?? group.aver ?? group.appversion ?? group.appVersion);
  const seriesList = firstArray(group.slist, group.serieslist, group.seriesList, group.series).map((series) => {
    const seriesIdx = readSeriesIdx(series);
    const appVersion = stringValue(series.aVer ?? series.aver ?? series.appversion ?? series.appVersion) || groupVersion;
    const books = firstArray(series.blist, series.booklist, series.bookList, series.books).map((book) =>
      normalizeBook(book, groupId, seriesIdx, appVersion)
    );

    return {
      seriesGroup: numberValue(series.sgIdx ?? series.sg_idx ?? series.sgroupIdx ?? series.seriesGroup) || groupId,
      seriesIdx,
      seriesName: stringValue(series.sName ?? series.seriesName ?? series.series_name),
      seriesNumber: numberValue(series.sNum ?? series.seriesNum ?? series.seriesNumber ?? series.order),
      mainImageUrl: assetUrl(stringValue(series.mimgurl ?? series.mainImageUrl ?? series.thumb_url ?? series.thumbUrl)),
      icon1Url: stringValue(series.icon1url ?? series.icon1Url),
      icon2Url: stringValue(series.icon2url ?? series.icon2Url),
      appVersion,
      books
    };
  });

  return {
    groupId,
    groupName: stringValue(group.sgName ?? group.sgroupName ?? group.groupName ?? group.sg_name),
    groupNumber: numberValue(group.sgNum ?? group.sgroupNum ?? group.groupNum ?? group.groupNumber ?? group.order),
    appVersion: groupVersion,
    brandId: readBrandId(rawGroup),
    brandName: readBrandName(rawGroup),
    mainImageUrl: assetUrl(stringValue(group.mimgurl ?? group.mainImageUrl ?? group.brandImageUrl ?? group.thumb_url ?? group.thumbUrl)),
    seriesList
  };
}

function normalizeBook(rawBook, groupId, seriesIdx, appVersion) {
  const book = recordValue(rawBook);
  const bookId = readBookId(rawBook);
  const bookVersion = stringValue(book.bookVer ?? book.bver ?? book.bVer ?? book.aVer ?? book.appversion ?? book.appVersion ?? book.version) || appVersion;
  const normalizedGroupId = readGroupId(rawBook) || groupId;
  const normalizedSeriesIdx = readSeriesIdx(rawBook) || seriesIdx;
  const explicitThumbnailUrl = assetUrl(stringValue(book.thumbnailUrl ?? book.coverUrl ?? book.coverURL ?? book.imgUrl ?? book.imageUrl ?? book.thumb_url ?? book.thumbUrl));
  const rawThumbUrl = stringValue(book.thumb_url ?? book.thumbUrl);
  const bookIdx = numberValue(book.bidx ?? book.bIdx ?? book.bookIdx ?? book.book_idx);
  const bookName = stringValue(book.bname ?? book.bName ?? book.bookName ?? book.name ?? book.title ?? bookId);
  const bUrl =
    stringValue(book.burl ?? book.bUrl ?? book.url ?? book.bookUrl ?? book.bookURL) ||
    (normalizedGroupId && normalizedSeriesIdx ? `MetaOn/BookData/${normalizedGroupId}/${normalizedSeriesIdx}/` : "");

  return {
    seriesGroup: normalizedGroupId,
    seriesIdx: normalizedSeriesIdx,
    bookIdx,
    bookId,
    bookCode: bookId,
    bookName,
    title: bookName,
    bookNumber: numberValue(book.pkgbknum ?? book.bNum ?? book.bookNum ?? book.bookNumber ?? book.order),
    lexile: stringValue(book.blexile ?? book.booklexile ?? book.lexile),
    bUrl,
    thumbnailUrl:
      explicitThumbnailUrl ||
      (bookIdx && rawThumbUrl
        ? assetUrl(rawThumbUrl)
        : `/api/books/${normalizedGroupId}/${normalizedSeriesIdx}/${encodeURIComponent(bookId)}/thumbnail?v=${encodeURIComponent(bookVersion)}`),
    themeId: numberValue(book.theme_id ?? book.themaIdx ?? book.themeId),
    appVersion: bookVersion,
    brandIdx: readBrandId(rawBook),
    sgIdx: normalizedGroupId
  };
}

function readSeriesIdx(value) {
  const series = recordValue(value);
  return numberValue(
    series.pkgsridx ??
      series.pkgsrIdx ??
      series.pkgsrid ??
      series.pkgsrId ??
      series.sIdx ??
      series.sidx ??
      series.series_idx ??
      series.seriesIdx ??
      series.seriesidx ??
      series.seriesId ??
      series.seriesid
  );
}

function readBookId(value) {
  const book = recordValue(value);
  return stringValue(book.bId ?? book.bid ?? book.bookId ?? book.bookID ?? book.bookid ?? book.book_id ?? book.book_code);
}

function assetUrl(value) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) return `${BOOKDATA_BASE}${value}`;
  return value;
}

function readBrandId(value) {
  const brand = recordValue(value);
  return numberValue(
    brand.brandId ??
      brand.brandid ??
      brand.brandIdx ??
      brand.brandidx ??
      brand.brand_id ??
      brand.bdIdx ??
      brand.bdidx ??
      brand.bdId ??
      brand.bdid ??
      brand.bd_id ??
      brand.brand_idx
  );
}

function readBrandName(value, includeGenericName = false) {
  const brand = recordValue(value);
  return stringValue(
    brand.brandName ??
      brand.brandname ??
      brand.bdName ??
      brand.bdname ??
      brand.brand_name ??
      brand.brandTitle ??
      brand.brandtitle ??
      (includeGenericName ? brand.name : undefined)
  );
}

function readGroupId(value) {
  if (typeof value === "number" || typeof value === "string") return numberValue(value);
  const group = recordValue(value);
  return numberValue(
      group.sgIdx ??
      group.sgidx ??
      group.sg_idx ??
      group.sgId ??
      group.sgid ??
      group.sg_id ??
      group.pkgsgidx ??
      group.pkgsgIdx ??
      group.pkgsgid ??
      group.pkgsgId ??
      group.sgroupIdx ??
      group.sgroupidx ??
      group.sgroupId ??
      group.sgroupid ??
      group.groupCode ??
      group.groupIdx ??
      group.groupidx ??
      group.groupId ??
      group.groupid ??
      group.seriesGroup ??
      group.seriesgroup ??
      group.id ??
      group.idx ??
      group.value
  );
}

function attachGroupsToBrands(brands, groups) {
  if (brands.length === 0) return [];
  const seenBrandIds = new Set();
  const assignedGroupIds = new Set();
  const attached = brands.map((brand) => {
    seenBrandIds.add(brand.brandId);
    const brandGroupIds = new Set(brand.groups.map((group) => group.groupId).filter(Boolean));
    const brandGroups = mergeGroups([
      ...brand.groups,
      ...groups.filter((group) => (brandGroupIds.has(group.groupId) && canAttachGroupById(brand, group)) || isGroupForBrand(brand, group))
    ]);
    for (const group of brandGroups) assignedGroupIds.add(group.groupId);
    return {
      ...brand,
      groups: brandGroups
    };
  });
  const orphanBrands = deriveBrands(
    groups.filter((group) => !assignedGroupIds.has(group.groupId) && !seenBrandIds.has(group.brandId || 0))
  );
  return [...attached, ...orphanBrands];
}

function isGroupForBrand(brand, group) {
  if (brand.brandId && group.brandId === brand.brandId) return true;

  const brandName = normalizeName(brand.brandName);
  const groupBrandName = normalizeName(group.brandName || "");
  const groupName = normalizeName(group.groupName);

  if (brandName && groupBrandName && (brandName.includes(groupBrandName) || groupBrandName.includes(brandName))) {
    return true;
  }

  return brandAliases(brand.brandName).some((alias) => Boolean(alias) && (groupName.includes(alias) || groupBrandName.includes(alias)));
}

function brandAliases(brandName) {
  const normalized = normalizeName(brandName);
  const aliases = new Set([normalized]);

  if (normalized.includes("razkids")) {
    aliases.add("razkids");
    aliases.add("razkid");
  }
  if (normalized.includes("하이마이스쿨") || normalized.includes("highmyschool")) {
    aliases.add("하이마이스쿨");
    aliases.add("highmyschool");
    aliases.add("himyschool");
  }
  if (normalized.includes("playnlearn")) {
    aliases.add("playnlearn");
  }
  if (normalized.includes("firstreaders") || normalized.includes("firstreader")) {
    aliases.add("firstreaders");
    aliases.add("firstreader");
  }

  return Array.from(aliases).filter((alias) => alias.length >= 3);
}

function normalizeName(value) {
  return stringValue(value).toLowerCase().replace(/[^a-z0-9가-힣]/g, "");
}

function mergeGroups(groups) {
  const merged = [];
  for (const group of groups) {
    if (!group.groupId) continue;
    const existingIndex = merged.findIndex((existing) => existing.groupId === group.groupId && canMergeGroups(existing, group));
    if (existingIndex >= 0) {
      merged[existingIndex] = mergeGroup(merged[existingIndex], group);
    } else {
      merged.push(group);
    }
  }
  return merged;
}

function canMergeGroups(left, right) {
  const leftScope = brandScope(left);
  const rightScope = brandScope(right);
  return !leftScope || !rightScope || leftScope === rightScope;
}

function canAttachGroupById(brand, group) {
  return !brandScope(group) || isGroupForBrand(brand, group);
}

function brandScope(value) {
  const normalizedBrandName = normalizeName(value.brandName || "");
  if (normalizedBrandName) return canonicalBrandScope(normalizedBrandName);
  return value.brandId ? `id:${value.brandId}` : "";
}

function canonicalBrandScope(normalizedBrandName) {
  if (normalizedBrandName.includes("razkids") || normalizedBrandName.includes("razkid")) return "razkids";
  if (normalizedBrandName.includes("하이마이스쿨") || normalizedBrandName.includes("highmyschool") || normalizedBrandName.includes("himyschool")) {
    return "highmyschool";
  }
  if (normalizedBrandName.includes("playnlearn")) return "playnlearn";
  if (normalizedBrandName.includes("firstreaders") || normalizedBrandName.includes("firstreader")) return "firstreaders";
  return normalizedBrandName;
}

function mergeGroup(existing, incoming) {
  return {
    ...existing,
    ...incoming,
    groupName: incoming.groupName || existing.groupName,
    groupNumber: incoming.groupNumber || existing.groupNumber,
    appVersion: incoming.appVersion || existing.appVersion,
    brandId: incoming.brandId || existing.brandId,
    brandName: incoming.brandName || existing.brandName,
    mainImageUrl: incoming.mainImageUrl || existing.mainImageUrl,
    seriesList: mergeSeriesLists(existing.seriesList, incoming.seriesList)
  };
}

function mergeSeriesLists(existing, incoming) {
  const byKey = new Map();
  for (const series of [...existing, ...incoming]) {
    const key = series.seriesIdx ? String(series.seriesIdx) : `${series.seriesGroup}:${series.seriesName}:${series.seriesNumber}`;
    const current = byKey.get(key);
    byKey.set(key, current ? mergeSeries(current, series) : series);
  }
  return Array.from(byKey.values()).sort((left, right) => left.seriesNumber - right.seriesNumber || left.seriesIdx - right.seriesIdx);
}

function mergeSeries(existing, incoming) {
  return {
    ...existing,
    ...incoming,
    seriesName: incoming.seriesName || existing.seriesName,
    seriesNumber: incoming.seriesNumber || existing.seriesNumber,
    mainImageUrl: incoming.mainImageUrl || existing.mainImageUrl,
    icon1Url: incoming.icon1Url || existing.icon1Url,
    icon2Url: incoming.icon2Url || existing.icon2Url,
    appVersion: incoming.appVersion || existing.appVersion,
    books: mergeBooks(existing.books, incoming.books)
  };
}

function mergeBooks(existing, incoming) {
  const byKey = new Map();
  for (const book of [...existing, ...incoming]) {
    const key = book.bookId || String(book.bookIdx);
    if (!key) continue;
    const current = byKey.get(key);
    byKey.set(key, current ? mergeBook(current, book) : book);
  }
  return Array.from(byKey.values()).sort((left, right) => left.bookNumber - right.bookNumber || left.bookIdx - right.bookIdx);
}

function mergeBook(existing, incoming) {
  return {
    ...existing,
    ...incoming,
    bookId: incoming.bookId || existing.bookId,
    bookName: incoming.bookName || existing.bookName,
    bUrl: incoming.bUrl || existing.bUrl,
    thumbnailUrl: incoming.thumbnailUrl || existing.thumbnailUrl,
    appVersion: incoming.appVersion || existing.appVersion
  };
}

function deriveBrands(groups) {
  const byId = new Map();
  for (const group of groups) {
    const brandId = group.brandId || 0;
    const brandName = group.brandName || "Catalog";
    const existing =
      byId.get(brandId) ||
      {
        brandId,
        brandName,
        mainImageUrl: group.mainImageUrl || "",
        groups: []
      };
    existing.groups.push(group);
    byId.set(brandId, existing);
  }
  return Array.from(byId.values());
}

function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}

function firstArray(...values) {
  return arrayValue(values.find((value) => Array.isArray(value) && value.length > 0) ?? values.find((value) => Array.isArray(value)));
}

function recordValue(value) {
  return value && typeof value === "object" ? value : {};
}

function stringValue(value) {
  return value == null ? "" : String(value);
}

function numberValue(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sentenceBlankIndex(sentence) {
  const value = sentence.blank_index ?? sentence.blank_idx ?? sentence.blankIndex ?? sentence.Blank_Index;
  if (value == null || value === "") return -1;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : -1;
}

function sendError(res, error, message) {
  const status = Number(error.status || 502);
  res.status(status).json({
    message,
    detail: error instanceof Error ? error.message : String(error)
  });
}
