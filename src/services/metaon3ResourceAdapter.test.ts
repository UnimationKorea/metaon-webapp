import { describe, expect, it } from "vitest";
import { normalizeBookResourceManifest } from "./metaon3ResourceAdapter";

describe("normalizeBookResourceManifest", () => {
  it("maps getBookInfo resources into virtual package files", () => {
    const manifest = normalizeBookResourceManifest({
      resultCode: 1,
      book: {
        book_idx: 6710,
        book_code: "GPLaa01",
        title: "Over",
        brand_idx: 11,
        sg_idx: 160,
        series_idx: 591,
        thumb_url: "/11/160/591/6710/thumb6710.png",
        progress: { act_total: 10, act_done: 3 },
        lessons: [
          {
            lesson_idx: 978,
            num: 1,
            name: "Lesson 1",
            days: [
              {
                day_idx: 978,
                num: 1,
                base_path: "/11/160/591/6710/978/978/",
                activities: [
                  { act_idx: 12881, num: 1, act_code: "EBOOK01", act_name: "Listen & Read", category: "listening" },
                  { act_idx: 12883, num: 3, act_code: "WDCA01", act_name: "Word Card", category: "word" },
                  {
                    act_idx: 12884,
                    num: 4,
                    act_code: "WDCA02",
                    act_name: "Word Card",
                    category: "word",
                    background_video: "/11/160/591/6710/978/978/wdca02/video/night-loop.mp4"
                  },
                  {
                    act_idx: 12885,
                    num: 5,
                    act_code: "WDQU03",
                    act_name: "Word Quiz",
                    category: "word",
                    background_video: "/11/160/591/6710/978/978/wdqu03/video/quiz-loop.mp4"
                  }
                ],
                word: [
                  {
                    word_idx: 8128,
                    word: "log",
                    word_class: "n",
                    order: 1,
                    img: "/11/160/591/6710/978/978/word/image/word_01.png",
                    snd: "/11/160/591/6710/978/978/word/sound/snd_word_01.mp3",
                    example: "Over the log.",
                    meanings: [{ nation: "KR", meaning: "통나무" }]
                  }
                ],
                sentence: [
                  {
                    sentence_idx: 7618,
                    sentence: "Over the log.",
                    slice: "Over/[the log.]",
                    blank_index: 1,
                    snd: "/11/160/591/6710/978/978/sentence/sound/snd_sentence_01.mp3",
                    meanings: [{ nation: "KR", meaning: "통나무 위로 폴짝." }]
                  }
                ],
                reading: [
                  {
                    reading_idx: 9150,
                    order: 1,
                    img: "/11/160/591/6710/978/978/reading/image/img_01.png",
                    snd1: "/11/160/591/6710/978/978/reading/sound/snd_01_01.mp3"
                  }
                ],
                listening: [
                  {
                    listening_idx: 14355,
                    order: 1,
                    mp4: "/11/160/591/6710/978/978/listening/mp4/video_01.mp4"
                  },
                  {
                    listening_idx: 14356,
                    order: 2,
                    mp4: "/11/160/591/6710/978/978/listening/mp4/video_02.mp4"
                  }
                ],
                ebook: {
                  book_json: "/11/160/591/6710/978/978/ebook/book.json",
                  assets: {
                    pages: ["/11/160/591/6710/978/978/ebook/assets/pages/page_001.png"],
                    audio: ["/11/160/591/6710/978/978/ebook/assets/audio/page_001_01.mp3"]
                  }
                }
              }
            ]
          }
        ]
      }
    });

    expect(manifest.key).toBe("book:6710");
    expect(manifest.book).toMatchObject({ bookIdx: 6710, bookId: "GPLaa01", bookName: "Over" });
    expect(manifest.lessonDays[0].activities).toMatchObject([
      { actIdx: 12881, activityCode: "EBOOK01", actType: 67, category: "listening", title: "Listen & Read" },
      { actIdx: 12883, activityCode: "WDCA01", actType: 1017, category: "word", title: "Word Card" },
      { actIdx: 12884, activityCode: "WDCA02", actType: 1017, category: "word", title: "Word Card" },
      { actIdx: 12885, activityCode: "WDQU03", actType: 1004, category: "word", title: "Word Quiz" }
    ]);
    expect(manifest.generatedFiles.map((file) => file.path)).toEqual([
      "Lessons/L1/D1/word/info_word.json",
      "Lessons/L1/D1/sentence/info_sentence.json",
      "Lessons/L1/D1/listening/01/info_listen_ebook.json"
    ]);
    const listenEbook = JSON.parse(
      manifest.generatedFiles.find((file) => file.path.endsWith("info_listen_ebook.json"))?.content || "{}"
    );
    const sentenceInfo = JSON.parse(
      manifest.generatedFiles.find((file) => file.path.endsWith("info_sentence.json"))?.content || "{}"
    );
    expect(sentenceInfo.sentence[0]).toMatchObject({ Slice: "Over/[the log.]", Blank_Index: 1 });
    expect(listenEbook.pages[0]).toMatchObject({
      imagePath: "Lessons/L1/D1/reading/01/img/img_01.png",
      audioPaths: ["Lessons/L1/D1/reading/01/snd/snd_01_01.mp3"]
    });
    expect(listenEbook.pages[0].captions).toMatchObject([
      { pageIndex: 0, audioIndex: 0, text: "Over" }
    ]);
    expect(listenEbook.fallbackVideoPaths).toContain("Lessons/L1/D1/listening/01/video/video_01.mp4");
    expect(manifest.resources.map((resource) => resource.path)).toContain("Lessons/L1/D1/listening/01/video/video_01.mp4");
    expect(manifest.resources.map((resource) => resource.path)).toContain("Lessons/L1/D1/listening/01/video/video_02.mp4");
    expect(manifest.resources.map((resource) => resource.path)).toContain("Lessons/L1/D1/ebook/book.json");
    expect(manifest.resources.map((resource) => resource.path)).toContain("Lessons/L1/D1/ebook/assets/pages/page_001.png");
    expect(manifest.resources.map((resource) => resource.path)).toContain("Lessons/L1/D1/ebook/assets/audio/page_001_01.mp3");
    expect(manifest.resources.map((resource) => resource.path)).toContain("Lessons/L1/D1/wdca02/video/night-loop.mp4");
    expect(manifest.resources.map((resource) => resource.path)).toContain("Lessons/L1/D1/wdqu03/video/quiz-loop.mp4");
    expect(manifest.resources[0].url).toMatch(/^https:\/\/metaon\.s3\.ap-northeast-2\.amazonaws\.com\/MetaOn3\/BookData\//);
  });

  it("keeps reading page audio slots instead of forcing sentence audio into Listen pages", () => {
    const manifest = normalizeBookResourceManifest({
      resultCode: 1,
      book: {
        book_idx: 6710,
        book_code: "GPLaa01",
        title: "Over",
        lessons: [
          {
            lesson_idx: 978,
            num: 1,
            days: [
              {
                day_idx: 978,
                num: 1,
                activities: [{ act_idx: 12881, num: 1, act_code: "67", act_name: "Listen", category: "listening" }],
                sentence: [
                  { sentence: "Over the log.", snd: "/book/snd_sentence_01.mp3" },
                  { sentence: "Over the pot.", snd: "/book/snd_sentence_02.mp3" },
                  { sentence: "Over the bike.", snd: "/book/snd_sentence_03.mp3" },
                  { sentence: "Over the bat.", snd: "/book/snd_sentence_04.mp3" },
                  { sentence: "Over the ball.", snd: "/book/snd_sentence_05.mp3" },
                  { sentence: "Over the cat.", snd: "/book/snd_sentence_06.mp3" }
                ],
                reading: [
                  { img: "/book/img_01.png", snd1: "/book/snd_01_01.mp3" },
                  { img: "/book/img_02.png", snd1: "/book/snd_02_01.mp3" },
                  { img: "/book/img_03.png", snd1: "/book/snd_03_01.mp3" },
                  { img: "/book/img_04.png", snd1: "/book/snd_04_01.mp3" },
                  { img: "/book/img_05.png", snd1: "/book/snd_05_01.mp3", snd2: "/book/snd_05_02.mp3" }
                ]
              }
            ]
          }
        ]
      }
    });
    const listenEbook = JSON.parse(
      manifest.generatedFiles.find((file) => file.path.endsWith("info_listen_ebook.json"))?.content || "{}"
    );

    expect(listenEbook.pages[4].audioPaths).toEqual([
      "Lessons/L1/D1/reading/01/snd/snd_05_01.mp3",
      "Lessons/L1/D1/reading/01/snd/snd_05_02.mp3"
    ]);
    expect(listenEbook.pages[4].captions).toMatchObject([
      { audioIndex: 0, text: "Over the doll." },
      { audioIndex: 1, text: "Over the cat." }
    ]);
  });

  it("builds sentence fallback captions for multi-sentence Raz Kids pages", () => {
    const manifest = normalizeBookResourceManifest({
      resultCode: 1,
      book: {
        book_idx: 7405,
        book_code: "G3LL02",
        title: "Ancient Egypt",
        lessons: [
          {
            lesson_idx: 536,
            num: 1,
            days: [
              {
                day_idx: 536,
                num: 1,
                activities: [{ act_idx: 7804, num: 1, act_code: "67", act_name: "Listen", category: "listening" }],
                sentence: [
                  { sentence: "When the king died, he was given a very fancy burial.", snd: "/book/snd_sentence_01.mp3" },
                  { sentence: "By studying ancient Egyptians, we know that they had a great culture.", snd: "/book/snd_sentence_02.mp3" },
                  { sentence: "The preserved body was called a mummy.", snd: "/book/snd_sentence_03.mp3" },
                  { sentence: "They were ruled by a king called a pharaoh.", snd: "/book/snd_sentence_04.mp3" },
                  { sentence: "After a king died, his body was preserved so that it would not rot.", snd: "/book/snd_sentence_05.mp3" },
                  { sentence: "The king was buried inside a huge stone structure called a pyramid.", snd: "/book/snd_sentence_06.mp3" },
                  { sentence: "They were used to keep out thieves.", snd: "/book/snd_sentence_07.mp3" },
                  { sentence: "They were built to trick anyone who tried to steal things from the tomb.", snd: "/book/snd_sentence_08.mp3" },
                  { sentence: "We can learn about the food they ate and the gods they worshipped.", snd: "/book/snd_sentence_09.mp3" }
                ],
                reading: [
                  { img: "/book/img_01.png", snd1: "/book/snd_01_01.mp3" },
                  { img: "/book/img_02.png", snd1: "/book/snd_02_02.mp3" },
                  { img: "/book/img_03.png", snd1: "/book/snd_03_01.mp3", snd2: "/book/snd_03_02.mp3" },
                  { img: "/book/img_04.png", snd1: "/book/snd_04_01.mp3", snd2: "/book/snd_04_02.mp3" },
                  { img: "/book/img_05.png", snd1: "/book/snd_05_01.mp3", snd2: "/book/snd_05_02.mp3" },
                  { img: "/book/img_06.png", snd1: "/book/snd_06_01.mp3", snd2: "/book/snd_06_02.mp3" },
                  { img: "/book/img_07.png", snd1: "/book/snd_07_01.mp3" }
                ]
              }
            ]
          }
        ]
      }
    });
    const listenEbook = JSON.parse(
      manifest.generatedFiles.find((file) => file.path.endsWith("info_listen_ebook.json"))?.content || "{}"
    );

    expect(listenEbook.pages[0].captions).toMatchObject([{ audioIndex: 0, text: "Ancient Egypt" }]);
    expect(listenEbook.pages[1].captions).toMatchObject([{ audioIndex: 0, text: "When the king died, he was given a very fancy burial." }]);
    expect(listenEbook.pages[2].captions).toMatchObject([
      { audioIndex: 0, text: "By studying ancient Egyptians, we know that they had a great culture." },
      { audioIndex: 1, text: "The preserved body was called a mummy." }
    ]);
    expect(listenEbook.pages[6].captions).toMatchObject([
      { audioIndex: 0, text: "We can learn about the food they ate and the gods they worshipped." }
    ]);
  });
});
