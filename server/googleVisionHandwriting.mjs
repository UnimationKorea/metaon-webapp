const DEFAULT_ENDPOINT = "https://vision.googleapis.com/v1/images:annotate";

export function buildGoogleVisionHandwritingRequest(imageBase64) {
  return {
    requests: [
      {
        image: { content: imageBase64 },
        features: [{ type: "TEXT_DETECTION" }]
      }
    ]
  };
}

export function extractGoogleVisionHandwritingCandidates(payload) {
  const responses = Array.isArray(payload?.responses) ? payload.responses : [];
  return responses.flatMap((response) => {
    const annotations = Array.isArray(response?.textAnnotations) ? response.textAnnotations : [];
    return annotations
      .map((annotation) => typeof annotation?.description === "string" ? annotation.description.replace(/[\r\n]/g, "") : "")
      .filter(Boolean);
  });
}

export function normalizePngBase64(value) {
  const normalized = String(value || "").replace(/^data:image\/png;base64,/i, "").replace(/\s+/g, "");
  if (!normalized || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    const error = new Error("A valid PNG base64 payload is required.");
    error.status = 400;
    throw error;
  }
  return normalized;
}

export async function recognizeGoogleVisionHandwriting({
  imageBase64,
  apiKey,
  endpoint = DEFAULT_ENDPOINT,
  timeoutMs = 12000,
  fetchImpl = fetch
}) {
  if (!apiKey) {
    const error = new Error("Google Vision handwriting recognition is not configured.");
    error.status = 503;
    throw error;
  }

  const content = normalizePngBase64(imageBase64);
  const url = new URL(endpoint);
  url.searchParams.set("key", apiKey);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildGoogleVisionHandwritingRequest(content)),
      signal: controller.signal
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.error) {
      const error = new Error(payload?.error?.message || `Google Vision request failed with ${response.status}.`);
      error.status = response.status >= 400 && response.status < 500 ? 502 : response.status;
      throw error;
    }

    return extractGoogleVisionHandwritingCandidates(payload);
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("Google Vision handwriting recognition timed out.");
      timeoutError.status = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
