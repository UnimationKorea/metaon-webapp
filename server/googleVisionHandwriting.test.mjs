import { describe, expect, it, vi } from "vitest";
import {
  buildGoogleVisionHandwritingRequest,
  extractGoogleVisionHandwritingCandidates,
  recognizeGoogleVisionHandwriting
} from "./googleVisionHandwriting.mjs";

describe("Google Vision handwriting BFF adapter", () => {
  it("builds the same TEXT_DETECTION request used by Unity Activity 48", () => {
    expect(buildGoogleVisionHandwritingRequest("abc")).toEqual({
      requests: [{ image: { content: "abc" }, features: [{ type: "TEXT_DETECTION" }] }]
    });
  });

  it("collects all textAnnotations and removes newlines like Unity", () => {
    expect(extractGoogleVisionHandwritingCandidates({
      responses: [{ textAnnotations: [{ description: "f\no\nx" }, { description: "Fox" }] }]
    })).toEqual(["fox", "Fox"]);
  });

  it("keeps the Google API key in the BFF request URL and not the response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ responses: [{ textAnnotations: [{ description: "fox" }] }] })
    });
    const candidates = await recognizeGoogleVisionHandwriting({
      imageBase64: "YWJj",
      apiKey: "server-secret",
      fetchImpl
    });

    expect(candidates).toEqual(["fox"]);
    expect(String(fetchImpl.mock.calls[0][0])).toContain("key=server-secret");
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toMatchObject({
      requests: [{ features: [{ type: "TEXT_DETECTION" }] }]
    });
  });
});
