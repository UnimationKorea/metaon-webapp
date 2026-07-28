import { describe, expect, it } from "vitest";
import { normalizeNpcQuickCheckScenario } from "../../../shared/npcQuickCheckScenario.mjs";
import { buildNpcQuickCheck2ResourceBundle, selectItems } from "./npcQuickCheck2ResourceAdapter";

const script = {
  book_title: "Peace and Quiet",
  activity: "npc-vocab",
  version: 2,
  voice: { name: "Leda" },
  opening: { text: "시작", audio: "audio/opening.webm" },
  items: [
    {
      item_idx: 3027,
      type: "word",
      en: "bats",
      ko: "치다",
      weak: {
        kind: "meaning-check",
        question: "여기서 bats는 무슨 뜻일까?",
        tts: "이번 단어, bats.",
        audio: "audio/w_bats_wk.webm",
        choices: [{ label: "a", t: "손으로 탁 쳐 올리다", ok: true }, { label: "b", t: "조용히 바라보다", ok: false }],
        fb_ok: { text: "맞아", audio: "audio/w_bats_wk_ok.webm" },
        fb_no: { text: "다시", audio: "audio/w_bats_wk_no.webm" }
      },
      relearn: {
        kind: "context-fill",
        question: "The player ___ the ball.",
        tts: "이번 단어, bats. 새 문장.",
        audio: "audio/w_bats_rl.webm",
        choices: [{ label: "a", t: "bats", ok: true }, { label: "b", t: "pats", ok: false }],
        fb_ok: { text: "정확해", audio: "audio/w_bats_rl_ok.webm" },
        fb_no: { text: "힌트", audio: "audio/w_bats_rl_no.webm" }
      }
    },
    {
      item_idx: 2839,
      type: "sentence",
      en: "Quiet bats it into the air.",
      ko: "Quiet가 그것을 쳐서 공중에 띄워요.",
      weak: {
        kind: "blank-fill",
        question: "Quiet ___ it into the air.",
        tts: "이번 문장.",
        audio: "audio/s01_wk.webm",
        choices: [{ label: "a", t: "bats", ok: true }, { label: "b", t: "sleeps", ok: false }],
        fb_ok: { text: "맞아", audio: "audio/s01_wk_ok.webm" },
        fb_no: { text: "다시", audio: "audio/s01_wk_no.webm" }
      },
      relearn: {
        kind: "word-order",
        question: "올바른 문장은?",
        tts: "순서 맞추기.",
        audio: "audio/s01_rl.webm",
        choices: [{ label: "a", t: "Quiet bats it into the air.", ok: true }, { label: "b", t: "Quiet it bats.", ok: false }],
        fb_ok: { text: "정확해", audio: "audio/s01_rl_ok.webm" },
        fb_no: { text: "힌트", audio: "audio/s01_rl_no.webm" }
      }
    }
  ],
  closing: { text: "끝", audio: "audio/closing.webm" }
};

const scope = { bookIdx: 6922, bookCode: "G1LG11", dayIdx: 1190, actIdx: 9001, lesson: 1, day: 1 };
const base = "Lessons/L1/D1/npcqhk2";

describe("NPCQHK02 resource adapter — selectItems", () => {
  it("uses weak for wrong items and relearn for the rest, keeping every item", () => {
    const selected = selectItems(script, new Set([3027]));
    expect(selected.map((item) => [item.itemIdx, item.variantName])).toEqual([
      [3027, "weak"],
      [2839, "relearn"]
    ]);
    expect(selected[0].itemType).toBe("word");
    expect(selected[1].itemType).toBe("sentence");
  });

  it("falls back to relearn for all items when there are no wrong items", () => {
    const selected = selectItems(script, new Set());
    expect(selected.every((item) => item.variantName === "relearn")).toBe(true);
    expect(selected).toHaveLength(2);
  });
});

describe("NPCQHK02 resource adapter — buildNpcQuickCheck2ResourceBundle", () => {
  it("attaches content refs, correct answers, and asset audio references from the chosen variant", () => {
    const selected = selectItems(script, new Set([2839]));
    const bundle = buildNpcQuickCheck2ResourceBundle(script, scope, selected, base);

    expect(bundle.questions).toHaveLength(2);
    // Item 3027 was not wrong → relearn variant; its correct choice is index 0 ("bats").
    expect(bundle.questions[0]).toMatchObject({
      kind: "single-select",
      questionSoundUrl: `asset:${base}/audio/w_bats_rl.webm`,
      contentRefs: [{ itemType: "word", itemIdx: 3027 }],
      correctAnswer: { mode: "single", selectedIndex: 0 }
    });
    // Item 2839 was wrong → weak variant.
    expect(bundle.questions[1]).toMatchObject({
      questionSoundUrl: `asset:${base}/audio/s01_wk.webm`,
      contentRefs: [{ itemType: "sentence", itemIdx: 2839 }]
    });
    expect(bundle.attemptId.startsWith("npcqhk2:")).toBe(true);
  });

  it("produces a scenario graph whose topology passes shared validation", () => {
    const selected = selectItems(script, new Set([3027, 2839]));
    const bundle = buildNpcQuickCheck2ResourceBundle(script, scope, selected, base);

    expect(bundle.scenario.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "intro", audioUrl: `asset:${base}/audio/opening.webm` }),
      expect.objectContaining({ id: "question:1", qIdx: bundle.questions[0].qIdx }),
      expect.objectContaining({ id: "ending", audioUrl: `asset:${base}/audio/closing.webm` })
    ]));

    // The resource-based scenario uses `asset:` audio references that the strict shared
    // validator (used only by the remote scenario source) rejects. Rewrite them to a
    // root-relative URL so the validator can still confirm graph topology (single reachable
    // ending, no cycles, qIdx matching).
    const scenarioForValidation = {
      ...bundle.scenario,
      nodes: bundle.scenario.nodes.map((node) => ({
        ...node,
        audioUrl: (node as { audioUrl?: string }).audioUrl ? "/audio/x.webm" : ""
      }))
    };
    const normalized = normalizeNpcQuickCheckScenario(scenarioForValidation, {
      bookIdx: scope.bookIdx,
      dayIdx: scope.dayIdx,
      actIdx: scope.actIdx,
      questionQIdxs: bundle.questions.map((question) => question.qIdx)
    });
    expect(normalized?.startNodeId).toBe("intro");
  });
});
