import { describe, expect, it } from "vitest";
import { buildNpcQuickCheckResourceBundle } from "./npcQuickCheckResourceAdapter";

const script = {
  book_title: "What Flies in the Sky?",
  version: 1,
  voice: { name: "Jade" },
  opening: { text: "Start", audio: "audio/opening.mp3" },
  questions: [
    {
      id: "q01",
      ko_hint: "첫 번째 문제",
      original_question: "What flies?",
      tts: "What flies?",
      audio: "audio/q01_intro.mp3",
      choices: [{ t: "A bird", ok: true }, { t: "A rock", ok: false }],
      fb_ok: { text: "Correct", audio: "audio/q01_fb_ok.mp3" },
      fb_no: { text: "Try again", audio: "audio/q01_fb_no.mp3" }
    }
  ],
  closing: { text: "Done", audio: "audio/closing.mp3" }
};

describe("NPCQHK01 resource adapter", () => {
  it("creates an NPC scenario and local single-select questions from cached script data", () => {
    const base = "Lessons/L1/D1/npcqhk";
    const paths = new Map([
      ["audio/opening.mp3", `${base}/audio/opening.mp3`],
      ["audio/q01_intro.mp3", `${base}/audio/q01_intro.mp3`],
      ["audio/q01_fb_ok.mp3", `${base}/audio/q01_fb_ok.mp3`],
      ["audio/q01_fb_no.mp3", `${base}/audio/q01_fb_no.mp3`],
      ["audio/closing.mp3", `${base}/audio/closing.mp3`]
    ]);
    const bundle = buildNpcQuickCheckResourceBundle(script, {
      bookIdx: 6922,
      bookCode: "GPLB64",
      dayIdx: 1190,
      actIdx: 9001,
      lesson: 1,
      day: 1
    }, paths);

    expect(bundle.questions).toHaveLength(1);
    expect(bundle.questions[0]).toMatchObject({
      kind: "single-select",
      indexBase: 0,
      sourceIndexBase: 1,
      questionSoundUrl: `asset:${base}/audio/q01_intro.mp3`,
      correctAnswer: { mode: "single", selectedIndex: 0 }
    });
    expect(bundle.scenario.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "intro", audioUrl: `asset:${base}/audio/opening.mp3` }),
      expect.objectContaining({ id: "question:1", qIdx: bundle.questions[0].qIdx }),
      expect.objectContaining({ id: "ending", audioUrl: `asset:${base}/audio/closing.mp3` })
    ]));
  });
});
