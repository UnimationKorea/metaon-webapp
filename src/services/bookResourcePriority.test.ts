import { describe, expect, it } from "vitest";
import { MetaOnActivityCode } from "./activityCodes";
import { planBookResourceDownload } from "./bookResourcePriority";
import { ActType, type BookResource, type LessonDay } from "../types/metaonTypes";

const resources: BookResource[] = [
  { path: "Lessons/L1/D1/reading/01/img/img_01.png", sourcePath: "/reading.png", url: "https://example.test/reading.png", mimeType: "image/png", category: "reading" },
  { path: "Lessons/L1/D1/word/img/word_01.png", sourcePath: "/word.png", url: "https://example.test/word.png", mimeType: "image/png", category: "word" },
  { path: "Lessons/L1/D1/word/snd/snd_word_01.mp3", sourcePath: "/word.mp3", url: "https://example.test/word.mp3", mimeType: "audio/mpeg", category: "word" },
  { path: "Lessons/L1/D1/sentence/snd/snd_sentence_01.mp3", sourcePath: "/sentence.mp3", url: "https://example.test/sentence.mp3", mimeType: "audio/mpeg", category: "sentence" }
];

const lessonDays: LessonDay[] = [
  {
    id: "1:1",
    lesson: 1,
    day: 1,
    title: "Day 1",
    activities: [
      { id: "word-card", actType: ActType.FlashCardSpace, activityCode: MetaOnActivityCode.WordCard, title: "Word Card", actNum: 0, category: "word" },
      { id: "sentence-blank", actType: ActType.SentenceCheckSpace, activityCode: MetaOnActivityCode.SentenceBlank, title: "Sentence Blank", actNum: 1, category: "sentence" }
    ]
  }
];

describe("planBookResourceDownload", () => {
  it("fetches the first Activity and next Activity media before unrelated Book resources", () => {
    const plan = planBookResourceDownload(resources, lessonDays);

    expect(plan.immediateResources.map((resource) => resource.path)).toEqual([
      "Lessons/L1/D1/word/img/word_01.png",
      "Lessons/L1/D1/word/snd/snd_word_01.mp3",
      "Lessons/L1/D1/sentence/snd/snd_sentence_01.mp3"
    ]);
    expect(plan.deferredResources.map((resource) => resource.path)).toEqual([
      "Lessons/L1/D1/reading/01/img/img_01.png"
    ]);
    expect(plan.orderedResources.map((resource) => resource.path)).toEqual([
      ...plan.immediateResources.map((resource) => resource.path),
      "Lessons/L1/D1/reading/01/img/img_01.png"
    ]);
  });
});
