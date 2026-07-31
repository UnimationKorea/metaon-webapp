import { METAON3_BOOKDATA_BASE, assetUrl } from "../api/catalogNormalizer";
import {
  activityTitleForCode,
  canonicalActivityCodeForActType,
  MetaOnActivityCode,
  normalizeActivityCode,
  resolveActTypeFromActivityCode
} from "./activityCodes";
import { guessMimeType } from "./mime";
import type {
  Activity,
  BookData,
  BookResource,
  BookResourceManifest,
  GeneratedPackageFile,
  LessonDay
} from "../types/metaonTypes";
import { ActType } from "../types/metaonTypes";

type UnknownRecord = Record<string, unknown>;

export function normalizeBookResourceManifest(raw: unknown): BookResourceManifest {
  const source = asRecord(raw);
  const rawBook = asRecord(source.book ?? raw);
  const book = normalizeBook(rawBook);
  const resources = new Map<string, BookResource>();
  const generatedFiles: GeneratedPackageFile[] = [];
  const lessonDays: LessonDay[] = [];

  for (const [lessonIndex, rawLesson] of arrayValue(rawBook.lessons).entries()) {
    const lesson = asRecord(rawLesson);
    const lessonNumber = numberValue(lesson.num) || lessonIndex + 1;
    const lessonIdx = numberValue(lesson.lesson_idx ?? lesson.lessonIdx);
    const lessonTitle = stringValue(lesson.name) || `Lesson ${lessonNumber}`;

    for (const [dayIndex, rawDay] of arrayValue(lesson.days).entries()) {
      const day = asRecord(rawDay);
      const dayNumber = numberValue(day.num) || dayIndex + 1;
      const dayIdx = numberValue(day.day_idx ?? day.dayIdx);
      const basePath = stringValue(day.base_path ?? day.basePath);
      const virtualBase = `Lessons/L${lessonNumber}/D${dayNumber}`;
      const activities = arrayValue(day.activities).map((activity, activityIndex) =>
        normalizeActivity(activity, dayIdx, activityIndex)
      );

      generatedFiles.push(jsonFile(`${virtualBase}/word/info_word.json`, toWordInfo(day)));
      generatedFiles.push(jsonFile(`${virtualBase}/sentence/info_sentence.json`, toSentenceInfo(day)));
      generatedFiles.push(jsonFile(`${virtualBase}/listening/01/info_listen_ebook.json`, toListenEbookInfo(day, virtualBase, book)));
      generatedFiles.push(jsonFile(`${virtualBase}/movie/info_movie.json`, toMovieInfo(day, virtualBase)));

      collectWordResources(day, virtualBase, resources);
      collectSentenceResources(day, virtualBase, resources);
      collectReadingResources(day, virtualBase, resources);
      collectListeningResources(day, virtualBase, resources);
      collectMovieResources(day, virtualBase, resources);
      collectVideoWordActivityResources(day, virtualBase, resources);
      collectEbookResources(day, virtualBase, resources);
      collectNpcQuickCheckResources(day, virtualBase, resources);
      collectNpcQuickCheck2Resources(day, virtualBase, resources);

      lessonDays.push({
        id: dayIdx ? String(dayIdx) : `${lessonNumber}:${dayNumber}`,
        lessonIdx,
        dayIdx,
        lesson: lessonNumber,
        day: dayNumber,
        title: stringValue(day.name) || `${lessonTitle} Day ${dayNumber}`,
        lessonTitle,
        dayTitle: stringValue(day.name),
        basePath,
        activities
      });
    }
  }

  return {
    key: packageKeyForBook(book),
    book,
    progress: {
      actTotal: numberValue(asRecord(rawBook.progress).act_total),
      actDone: numberValue(asRecord(rawBook.progress).act_done)
    },
    lessonDays,
    resources: Array.from(resources.values()),
    generatedFiles,
    raw
  };
}

export function packageKeyForBook(book: Pick<BookData, "bookIdx" | "seriesGroup" | "seriesIdx" | "bookId">): string {
  return book.bookIdx ? `book:${book.bookIdx}` : `${book.seriesGroup}:${book.seriesIdx}:${book.bookId}`;
}

export function buildMetaOn3ResourceUrl(path: string): string {
  return assetUrl(path.startsWith("/") ? path : `/${path}`);
}

function normalizeBook(rawBook: UnknownRecord): BookData {
  const bookIdx = numberValue(rawBook.book_idx ?? rawBook.bookIdx);
  const brandIdx = numberValue(rawBook.brand_idx ?? rawBook.brandIdx);
  const sgIdx = numberValue(rawBook.sg_idx ?? rawBook.sgIdx ?? rawBook.seriesGroup);
  const seriesIdx = numberValue(rawBook.series_idx ?? rawBook.seriesIdx);
  const bookCode = stringValue(rawBook.book_code ?? rawBook.bookCode ?? rawBook.bookId ?? rawBook.book_id);
  const title = stringValue(rawBook.title ?? rawBook.bookName ?? rawBook.name ?? bookCode);
  const thumbUrl = stringValue(rawBook.thumb_url ?? rawBook.thumbUrl);

  return {
    seriesGroup: sgIdx,
    seriesIdx,
    bookIdx,
    bookId: bookCode || String(bookIdx),
    bookCode,
    bookName: title,
    title,
    bookNumber: numberValue(rawBook.order ?? rawBook.bookNumber),
    lexile: stringValue(rawBook.lexile),
    bUrl: stringValue(rawBook.base_path ?? rawBook.bUrl),
    thumbnailUrl: thumbUrl ? buildMetaOn3ResourceUrl(thumbUrl) : "",
    themeId: 0,
    appVersion: "",
    brandIdx,
    sgIdx
  };
}

function normalizeActivity(rawActivity: unknown, dayIdx: number, index: number): Activity {
  const activity = asRecord(rawActivity);
  const actIdx = numberValue(activity.act_idx ?? activity.actIdx);
  const rawActCode = activity.act_code ?? activity.actCode ?? activity.code;
  const actNumber = numberValue(activity.num) || index + 1;
  const category = stringValue(activity.category);
  const rawTitle = stringValue(activity.act_name ?? activity.actName ?? activity.title);
  const resolvedActType = resolveActTypeFromActivityCode(rawActCode, { category, title: rawTitle });
  const normalizedActType = resolvedActType || ActType.BookPage;
  const activityCode = canonicalActivityCodeForActType(normalizedActType, rawActCode);
  const legacyActCode = normalizeActivityCode(rawActCode);
  const fallbackTitle = rawTitle || `Activity ${actNumber}`;

  return {
    id: actIdx ? String(actIdx) : `${normalizedActType}:${index}`,
    actIdx,
    dayIdx,
    activityCode,
    legacyActCode: legacyActCode && legacyActCode !== activityCode ? legacyActCode : undefined,
    actType: normalizedActType,
    actNum: index,
    category: category === "quickcheck" ? "quickcheck" : category,
    title: activityTitleForCode(activityCode, fallbackTitle),
    raw: rawActivity
  };
}

function toWordInfo(day: UnknownRecord) {
  return {
    word: arrayValue(day.word).map((rawWord) => {
      const word = asRecord(rawWord);
      return {
        Word_Idx: numberValue(word.word_idx ?? word.wordIdx),
        Eng: stringValue(word.word),
        Mean: firstMeaning(word),
        Sentence: stringValue(word.example),
        WordClass: stringValue(word.word_class ?? word.wordClass)
      };
    })
  };
}

function toSentenceInfo(day: UnknownRecord) {
  return {
    sentence: arrayValue(day.sentence).map((rawSentence) => {
      const sentence = asRecord(rawSentence);
        return {
          Sentence_Idx: numberValue(sentence.sentence_idx ?? sentence.sentenceIdx),
          Eng: stringValue(sentence.sentence),
          Mean: firstMeaning(sentence),
          Slice: stringValue(sentence.slice),
          Blank_Index: sentenceBlankIndex(sentence)
        };
    })
  };
}

function toListenEbookInfo(day: UnknownRecord, virtualBase: string, book: BookData) {
  const readings = arrayValue(day.reading).map(asRecord);
  const sentences = arrayValue(day.sentence).map(asRecord);
  const listeningRows = arrayValue(day.listening).map(asRecord);
  const knownCaptionPages = knownListenCaptionPages(book.bookCode || book.bookId);
  const readingAudioCounts = readings.map((reading) => [stringValue(reading.snd1), stringValue(reading.snd2)].filter(Boolean).length);
  const sentenceItems = sentences.map((sentence, index) => ({
    text: splitCaptionSentences(firstText(sentence.sentence, sentence.eng, sentence.Eng, sentence.text, sentence.script, sentence.caption))[0] || "",
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
    .map((listening, index) => (stringValue(listening.mp4) ? `${virtualBase}/listening/01/video/video_${twoDigit(index + 1)}.mp4` : ""))
    .filter(Boolean);

  const pages = readings
    .map((reading, index) => {
      const pageNumber = index + 1;
      const imagePath = stringValue(reading.img) ? `${virtualBase}/reading/01/img/img_${twoDigit(pageNumber)}.png` : "";
      const audioPaths = [
        stringValue(reading.snd1) ? `${virtualBase}/reading/01/snd/snd_${twoDigit(pageNumber)}_01.mp3` : "",
        stringValue(reading.snd2) ? `${virtualBase}/reading/01/snd/snd_${twoDigit(pageNumber)}_02.mp3` : ""
      ].filter(Boolean);
      const captionPaths = captionVirtualPaths(reading, virtualBase, pageNumber, "reading");
      const sentencePageItems = (distributedSentenceItems[index] || []).filter((item) => item.text && item.audioPath);
      const inlineTexts = splitCaptionSentences(
        firstText(
          reading.caption,
          reading.subtitle,
          reading.script,
          reading.text,
          reading.sentence,
          reading.eng,
          reading.Eng
        )
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

function knownListenCaptionPages(bookCode: string): string[][] {
  const normalized = bookCode.trim().toUpperCase();
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

function buildFallbackListenCaptionPages(
  book: BookData,
  sentenceTexts: string[],
  pageCount: number,
  audioCounts: number[],
  knownCaptionPages: string[][]
): string[][] {
  if (knownCaptionPages.some((page) => page.length > 0)) return knownCaptionPages;

  const cleanSentenceTexts = sentenceTexts.map((text) => text.trim()).filter(Boolean);
  const result = Array.from({ length: pageCount }, () => [] as string[]);
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

function listenBookTitle(book: BookData): string {
  return stringValue(book.title || book.bookName || book.bookCode || book.bookId).trim();
}

function distributeListenItems<T>(items: T[], pageCount: number, audioCounts: number[]): T[][] {
  const result = Array.from({ length: pageCount }, () => [] as T[]);
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

function buildGeneratedListenCues(pageIndex: number, audioCount: number, captionTexts: string[]) {
  const cleanTexts = captionTexts.map((text) => text.trim()).filter(Boolean);
  if (cleanTexts.length === 0 || audioCount === 0) return [];

  if (audioCount === 1 && cleanTexts.length > 1) {
    return cleanTexts.map((text, index) => generatedCue(pageIndex, 0, text, index * 60000, (index + 1) * 60000));
  }

  return Array.from({ length: audioCount }, (_, audioIndex) =>
    generatedCue(pageIndex, audioIndex, cleanTexts[Math.min(audioIndex, cleanTexts.length - 1)])
  );
}

function splitCaptionSentences(value: string): string[] {
  const normalized = value.replace(/\[[^\]]*\]/g, "").replace(/\//g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const matches = normalized.match(/[^.!?。！？]+[.!?。！？]+|[^.!?。！？]+$/g) || [normalized];
  return matches.map((item) => item.trim()).filter(Boolean);
}

function toMovieInfo(day: UnknownRecord, virtualBase: string) {
  const movie = movieRecords(day);
  const sentences = arrayValue(day.sentence).map(asRecord);
  const captions = sentences.flatMap((sentence, sentenceIndex) => {
    const translation = firstMeaning(sentence);
    return splitCaptionSentences(firstText(sentence.sentence, sentence.eng, sentence.Eng, sentence.script, sentence.text, sentence.caption)).map(
      (text, textIndex) => ({
        pageIndex: 0,
        audioIndex: sentenceIndex,
        startMs: (sentenceIndex + textIndex) * 60000,
        endMs: (sentenceIndex + textIndex + 1) * 60000,
        text,
        translation
      })
    );
  });

  return {
    version: 1,
    source: "metaon3-movie",
    movie: movie.map((item, index) => {
      const videoSource = movieVideoSource(item);
      return {
        videoPath: videoSource ? `${virtualBase}/movie/video/${movieFileName(videoSource, index)}` : "",
        captionPaths: captionVirtualPaths(item, virtualBase, index + 1, "movie")
      };
    }),
    captions
  };
}

function movieRecords(day: UnknownRecord): UnknownRecord[] {
  const dayMovie = day.movie;
  const records = Array.isArray(dayMovie)
    ? dayMovie.map(asRecord).filter((item) => Object.keys(item).length > 0)
    : typeof dayMovie === "string" && dayMovie.trim()
      ? [{ path: dayMovie.trim() }]
      : Object.keys(asRecord(dayMovie)).length > 0
        ? [asRecord(dayMovie)]
        : [];

  if (records.length > 0) return records;

  return arrayValue(day.activities)
    .map(asRecord)
    .filter((activity) => {
      const activityCode = normalizeActivityCode(activity.act_code ?? activity.actCode ?? activity.activity_code ?? activity.activityCode);
      return activityCode === MetaOnActivityCode.Movie || activityCode === String(ActType.MoviePlay);
    });
}

function movieVideoSource(movie: UnknownRecord): string {
  return firstResourcePath(
    movie.mp4,
    movie.video,
    movie.video_path,
    movie.videoPath,
    movie.video_url,
    movie.videoUrl,
    movie.path
  );
}

function movieFileName(sourcePath: string, index: number): string {
  const fileName = sourcePath.replace(/\\/g, "/").split("?")[0].split("/").filter(Boolean).pop();
  return fileName || `movie_${twoDigit(index + 1)}.mp4`;
}

function collectWordResources(day: UnknownRecord, virtualBase: string, resources: Map<string, BookResource>): void {
  arrayValue(day.word).forEach((rawWord, index) => {
    const word = asRecord(rawWord);
    addResource(resources, `${virtualBase}/word/img/word_${twoDigit(index + 1)}.png`, stringValue(word.img), "word");
    addResource(resources, `${virtualBase}/word/snd/snd_word_${twoDigit(index + 1)}.mp3`, stringValue(word.snd), "word");
  });
}

function collectSentenceResources(day: UnknownRecord, virtualBase: string, resources: Map<string, BookResource>): void {
  arrayValue(day.sentence).forEach((rawSentence, index) => {
    const sentence = asRecord(rawSentence);
    addResource(resources, `${virtualBase}/sentence/snd/snd_sentence_${twoDigit(index + 1)}.mp3`, stringValue(sentence.snd), "sentence");
  });
}

function collectReadingResources(day: UnknownRecord, virtualBase: string, resources: Map<string, BookResource>): void {
  arrayValue(day.reading).forEach((rawReading, index) => {
    const reading = asRecord(rawReading);
    addResource(resources, `${virtualBase}/reading/01/img/img_${twoDigit(index + 1)}.png`, stringValue(reading.img), "reading");
    addResource(resources, `${virtualBase}/reading/01/snd/snd_${twoDigit(index + 1)}_01.mp3`, stringValue(reading.snd1), "reading");
    addResource(resources, `${virtualBase}/reading/01/snd/snd_${twoDigit(index + 1)}_02.mp3`, stringValue(reading.snd2), "reading");
    collectCaptionResources(reading, virtualBase, index + 1, "reading", resources);
  });
}

function collectListeningResources(day: UnknownRecord, virtualBase: string, resources: Map<string, BookResource>): void {
  arrayValue(day.listening).forEach((rawListening, index) => {
    const listening = asRecord(rawListening);
    addResource(resources, `${virtualBase}/listening/01/video/video_${twoDigit(index + 1)}.mp4`, stringValue(listening.mp4), "listening");
    collectCaptionResources(listening, virtualBase, index + 1, "listening", resources);
  });
}

function collectMovieResources(day: UnknownRecord, virtualBase: string, resources: Map<string, BookResource>): void {
  movieRecords(day).forEach((movie, index) => {
    const videoSource = movieVideoSource(movie);
    addResource(resources, `${virtualBase}/movie/video/${movieFileName(videoSource, index)}`, videoSource, "movie");
    collectCaptionResources(movie, virtualBase, index + 1, "movie", resources);
  });
}

function collectVideoWordActivityResources(day: UnknownRecord, virtualBase: string, resources: Map<string, BookResource>): void {
  const videoActivities = arrayValue(day.activities).map((rawActivity, index) => {
    const activity = asRecord(rawActivity);
    const activityCode = normalizeActivityCode(activity.act_code ?? activity.actCode ?? activity.activity_code ?? activity.activityCode);
    const videoFolder =
      activityCode === MetaOnActivityCode.VideoWordCard ? "wdca02" :
      activityCode === MetaOnActivityCode.VideoWordQuiz ? "wdqu03" :
      activityCode === MetaOnActivityCode.VideoWordBlank ? "wdbl02" :
      activityCode === MetaOnActivityCode.VideoSentenceBlank ? "stbl02" :
      activityCode === MetaOnActivityCode.VideoUnscramble ? "stsc02" :
      activityCode === MetaOnActivityCode.VideoSentenceRecord ? "strc02" : "";
    if (!videoFolder) return undefined;

    return {
      index,
      videoFolder,
      sourcePath: firstResourcePath(
      activity.background_video,
      activity.backgroundVideo,
      activity.bg_video,
      activity.bgVideo,
      activity.video_path,
      activity.videoPath,
      activity.video_url,
      activity.videoUrl
      )
    };
  }).filter((activity): activity is { index: number; videoFolder: string; sourcePath: string } => Boolean(activity));

  // MetaOn3 can expose one Movie per Day instead of a background_video field
  // on each video activity. Cache it once and use it as the shared fallback.
  const movie = asRecord(day.movie);
  const sharedSourcePath = firstResourcePath(
    day.background_video,
    day.backgroundVideo,
    day.bg_video,
    day.bgVideo,
    day.video_path,
    day.videoPath,
    day.video_url,
    day.videoUrl,
    movie.mp4,
    movie.video,
    movie.video_path,
    movie.videoPath,
    movie.video_url,
    movie.videoUrl
  );
  if (sharedSourcePath && videoActivities.some((activity) => !activity.sourcePath)) {
    addResource(resources, `${virtualBase}/video/${videoBackgroundFileName(sharedSourcePath, 0)}`, sharedSourcePath, "video-background");
  }

  videoActivities.forEach(({ index, videoFolder, sourcePath }) => {
    if (!sourcePath) return;
    addResource(resources, `${virtualBase}/${videoFolder}/video/${videoBackgroundFileName(sourcePath, index)}`, sourcePath, videoFolder);
  });
}

function collectEbookResources(day: UnknownRecord, virtualBase: string, resources: Map<string, BookResource>): void {
  const ebook = ebookRecord(day);
  if (!ebook) return;

  const ebookBase = `${virtualBase}/ebook`;
  const bookJsonPath = firstResourcePath(ebook.book_json, ebook.bookJson, ebook.book, ebook.json, ebook.manifest, ebook.path);
  addResource(resources, `${ebookBase}/book.json`, bookJsonPath, "ebook");

  const assets = asRecord(ebook.assets);
  collectEbookAssetEntries(resources, ebookBase, "pages", [...arrayValue(assets.pages), ...arrayValue(ebook.pages)]);
  collectEbookAssetEntries(resources, ebookBase, "audio", [...arrayValue(assets.audio), ...arrayValue(ebook.audio), ...arrayValue(ebook.audios)]);
}

function collectNpcQuickCheckResources(day: UnknownRecord, virtualBase: string, resources: Map<string, BookResource>): void {
  const npcqhk = npcQuickCheckRecord(day);
  if (!npcqhk) return;

  const npcqhkBase = `${virtualBase}/npcqhk`;
  const scriptPath = npcQuickCheckScriptPath(npcqhk);
  addResource(resources, `${npcqhkBase}/script.json`, scriptPath, "npcqhk");

  const assets = asRecord(npcqhk.assets);
  const audioPaths = [
    ...firstResourcePaths(npcqhk.audio, npcqhk.audios, npcqhk.audio_paths, npcqhk.audioPaths),
    ...firstResourcePaths(assets.audio, assets.audios, assets.audio_paths, assets.audioPaths)
  ];
  audioPaths.forEach((path, index) => {
    addResource(resources, npcQuickCheckVirtualPath(npcqhkBase, path, index), path, "npcqhk");
  });
}

function npcQuickCheckRecord(day: UnknownRecord): UnknownRecord | undefined {
  const value = day.npcqhk ?? day.npc_qhk ?? day.npcQuickCheck ?? day.npc_quick_check;
  if (typeof value === "string" && value.trim()) return { path: value.trim() };
  if (Array.isArray(value)) return value.map(asRecord).find((item) => Object.keys(item).length > 0);
  const record = asRecord(value);
  return Object.keys(record).length > 0 ? record : undefined;
}

function collectNpcQuickCheck2Resources(day: UnknownRecord, virtualBase: string, resources: Map<string, BookResource>): void {
  const npcqhk2 = npcQuickCheck2Record(day);
  if (!npcqhk2) return;

  const npcqhk2Base = `${virtualBase}/npcqhk2`;
  const scriptPath = npcQuickCheckScriptPath(npcqhk2);
  addResource(resources, `${npcqhk2Base}/script.json`, scriptPath, "npcqhk2");
  // Audio (webm) is authored as relative paths inside script.json and is derived on the
  // client from the cached script.json (see bookPackageImporter), so only script.json is emitted.
}

function npcQuickCheck2Record(day: UnknownRecord): UnknownRecord | undefined {
  const value = day.npcqhk2 ?? day.npc_qhk2 ?? day.npc_qhk_2 ?? day.npcQuickCheck2 ?? day.npc_quick_check2;
  if (typeof value === "string" && value.trim()) return { path: value.trim() };
  if (Array.isArray(value)) return value.map(asRecord).find((item) => Object.keys(item).length > 0);
  const record = asRecord(value);
  return Object.keys(record).length > 0 ? record : undefined;
}

function npcQuickCheckScriptPath(value: UnknownRecord): string {
  const source = firstResourcePath(
    value.script_json,
    value.scriptJson,
    value.script,
    value.manifest,
    value.json,
    value.resource_path,
    value.resourcePath,
    value.path
  );
  if (!source) return "";
  return /\.json(?:\?.*)?$/i.test(source) ? source : `${source.replace(/\/+$/, "")}/script.json`;
}

function npcQuickCheckVirtualPath(npcqhkBase: string, sourcePath: string, index: number): string {
  const normalized = sourcePath.replace(/\\/g, "/").split("?")[0];
  const marker = "/npcqhk/";
  const markerIndex = normalized.toLowerCase().lastIndexOf(marker);
  if (markerIndex >= 0) return `${npcqhkBase}/${normalized.slice(markerIndex + marker.length)}`;

  const fileName = normalized.split("/").filter(Boolean).pop() || `audio_${twoDigit(index + 1)}.mp3`;
  return `${npcqhkBase}/audio/${fileName}`;
}

function ebookRecord(day: UnknownRecord): UnknownRecord | undefined {
  const candidates = [day.ebook, day.e_book, day.listen_ebook, day.listenEbook, day.listen_ebook_resource, day.listenEbookResource];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      const firstRecord = candidate.map(asRecord).find((item) => Object.keys(item).length > 0);
      if (firstRecord) return firstRecord;
    }
    const record = asRecord(candidate);
    if (Object.keys(record).length > 0) return record;
  }
  return undefined;
}

function collectEbookAssetEntries(
  resources: Map<string, BookResource>,
  ebookBase: string,
  kind: "pages" | "audio",
  entries: unknown[]
): void {
  entries.forEach((entry, index) => {
    if (typeof entry === "string") {
      addResource(resources, ebookVirtualPath(ebookBase, kind, entry, index), entry, "ebook");
      return;
    }

    const record = asRecord(entry);
    const paths =
      kind === "pages"
        ? [firstResourcePath(record.image, record.imagePath, record.page, record.path)]
        : firstResourcePaths(record.audioPaths, record.audio, record.audios, record.path);
    paths.filter(Boolean).forEach((path, pathIndex) => {
      addResource(resources, ebookVirtualPath(ebookBase, kind, path, index + pathIndex), path, "ebook");
    });
  });
}

function ebookVirtualPath(ebookBase: string, kind: "pages" | "audio", sourcePath: string, index: number): string {
  const normalized = sourcePath.replace(/\\/g, "/").split("?")[0];
  const marker = "/ebook/";
  const markerIndex = normalized.toLowerCase().lastIndexOf(marker);
  if (markerIndex >= 0) return `${ebookBase}/${normalized.slice(markerIndex + marker.length)}`;

  const fileName = normalized.split("/").filter(Boolean).pop() || `${kind === "pages" ? "page" : "audio"}_${twoDigit(index + 1)}`;
  return `${ebookBase}/assets/${kind}/${fileName}`;
}

function firstResourcePath(...values: unknown[]): string {
  return firstResourcePaths(...values)[0] || "";
}

function firstResourcePaths(...values: unknown[]): string[] {
  for (const value of values) {
    if (Array.isArray(value)) {
      const paths = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
      if (paths.length > 0) return paths;
    }
    if (typeof value === "string" && value.trim()) return [value.trim()];
  }
  return [];
}

function videoBackgroundFileName(sourcePath: string, index: number): string {
  const normalized = sourcePath.replace(/\\/g, "/").split("?")[0];
  return normalized.split("/").filter(Boolean).pop() || `background_${twoDigit(index + 1)}.mp4`;
}

function addResource(resources: Map<string, BookResource>, virtualPath: string, sourcePath: string, category: string): void {
  if (!sourcePath) return;
  resources.set(virtualPath, {
    path: virtualPath,
    sourcePath,
    url: buildMetaOn3ResourceUrl(sourcePath),
    mimeType: guessMimeType(sourcePath),
    category
  });
}

function jsonFile(path: string, value: unknown): GeneratedPackageFile {
  return {
    path,
    content: JSON.stringify(value),
    mimeType: "application/json"
  };
}

function firstMeaning(value: UnknownRecord): string {
  const meanings = arrayValue(value.meanings);
  const korean = meanings.map(asRecord).find((item) => stringValue(item.nation).toUpperCase() === "KR");
  return stringValue(korean?.meaning ?? asRecord(meanings[0]).meaning);
}

function generatedCue(pageIndex: number, audioIndex: number, text: string, startMs = 0, endMs = 3600000) {
  return {
    pageIndex,
    audioIndex,
    startMs,
    endMs,
    text
  };
}

function collectCaptionResources(
  record: UnknownRecord,
  virtualBase: string,
  index: number,
  source: "reading" | "listening" | "movie",
  resources: Map<string, BookResource>
): void {
  captionSourceEntries(record).forEach(({ key, value }) => {
    if (!isResourcePath(value)) return;
    addResource(resources, captionVirtualPath(virtualBase, index, source, key, value), value, "listening-caption");
  });
}

function captionVirtualPaths(record: UnknownRecord, virtualBase: string, index: number, source: "reading" | "listening" | "movie"): string[] {
  return captionSourceEntries(record)
    .filter(({ value }) => isResourcePath(value))
    .map(({ key, value }) => captionVirtualPath(virtualBase, index, source, key, value));
}

function captionVirtualPath(virtualBase: string, index: number, source: "reading" | "listening" | "movie", key: string, sourcePath: string): string {
  const extension = sourcePath.split("?")[0].split(".").pop()?.toLowerCase() || "txt";
  return `${virtualBase}/listening/01/caption/${source}_${twoDigit(index)}_${key}.${extension}`;
}

function captionSourceEntries(record: UnknownRecord): Array<{ key: string; value: string }> {
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

function isResourcePath(value: string): boolean {
  const lower = value.toLowerCase().split("?")[0];
  return value.startsWith("/") || /\.(smi|srt|vtt|json|txt)$/.test(lower);
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const text = stringValue(value);
    if (text && !isResourcePath(text)) return text;
  }
  return "";
}

function twoDigit(value: number): string {
  return value.toString().padStart(2, "0");
}

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? (value as UnknownRecord) : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown): string {
  return value == null ? "" : String(value);
}

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sentenceBlankIndex(sentence: UnknownRecord): number {
  const value = sentence.blank_index ?? sentence.blank_idx ?? sentence.blankIndex ?? sentence.Blank_Index;
  if (value == null || value === "") return -1;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : -1;
}

export { METAON3_BOOKDATA_BASE };
