import { describe, expect, it } from "vitest";
import { parseCaptionCues } from "./listenEbookCaptions";

describe("parseCaptionCues", () => {
  it("parses SMI sync captions", () => {
    const cues = parseCaptionCues(
      `<SAMI><BODY>
<SYNC Start=0><P Class=ENCC>Hello<br>there
<SYNC Start=1200><P Class=ENCC>Next line
</BODY></SAMI>`,
      "caption.smi",
      { pageIndex: 2, audioIndex: 1 }
    );

    expect(cues).toMatchObject([
      { pageIndex: 2, audioIndex: 1, startMs: 0, endMs: 1200, text: "Hello\nthere" },
      { pageIndex: 2, audioIndex: 1, startMs: 1200, endMs: 4200, text: "Next line" }
    ]);
  });

  it("parses WebVTT captions", () => {
    const cues = parseCaptionCues(
      `WEBVTT

00:00:01.000 --> 00:00:02.500
Over the log.`,
      "caption.vtt"
    );

    expect(cues).toMatchObject([{ startMs: 1000, endMs: 2500, text: "Over the log." }]);
  });

  it("parses JSON caption arrays", () => {
    const cues = parseCaptionCues(
      JSON.stringify([{ pageIndex: 1, audioIndex: 0, startMs: 500, durationMs: 1500, text: "Jump." }]),
      "caption.json"
    );

    expect(cues).toEqual([{ pageIndex: 1, audioIndex: 0, startMs: 500, endMs: 2000, text: "Jump." }]);
  });

  it("preserves word-level timing from JSON caption resources", () => {
    const cues = parseCaptionCues(
      JSON.stringify([{
        startMs: 1000,
        endMs: 2600,
        text: "Over the log.",
        words: [
          { word: "Over", startMs: 1000, endMs: 1480 },
          { word: "the", startMs: 1500, endMs: 1780 },
          { word: "log.", startMs: 1800, endMs: 2400 }
        ]
      }]),
      "caption.json"
    );

    expect(cues[0]?.words).toEqual([
      { text: "Over", startMs: 1000, endMs: 1480 },
      { text: "the", startMs: 1500, endMs: 1780 },
      { text: "log.", startMs: 1800, endMs: 2400 }
    ]);
  });
});
