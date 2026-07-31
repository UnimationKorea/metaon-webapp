import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject, type TouchEvent as ReactTouchEvent } from "react";
import { BarChart3, BookOpen, Check, ChevronDown, ChevronLeft, ChevronRight, Flag, Gauge, ImageOff, Keyboard, Mic, Pause, Play, RotateCcw, Square, Star, Trophy, Volume2, Wrench, X } from "lucide-react";
import { uploadLearnRecording } from "../../api/uniplanetApi";
import { ActivityHintImage, ActivityListeningImage, ActivityPageArrowImage, ActivitySoundImage, ActivityTimerBadge, videoActivityControlAssets, VideoActivityPageArrow, VideoActivityPageIndicator } from "../ActivityImageControls";
import { ActivityLoadingVisual } from "./ActivityLoadingVisual";
import { bffRecognitionPort } from "../../ports/bffRecognitionPort";
import { browserRecorderPort } from "../../ports/browserRecorderPort";
import { getActTypeDefinition, getActTypeLabel } from "../../services/actTypeCatalog";
import { MetaOnActivityCode, normalizeActivityCode } from "../../services/activityCodes";
import { indexedDbStorage } from "../../services/indexedDbStorage";
import { parseCaptionCues, type ListenCaptionCue } from "../../services/listenEbookCaptions";
import {
  hasCachedVideoMedia,
  isVideoMediaServiceWorkerControlling,
  videoMediaCacheUrl
} from "../../services/videoMediaCache";
import type { LearnEventInput } from "../../types/learnEvents";
import { ActType, type Activity, type ActivityRendererContext } from "../../types/metaonTypes";

type StoryInfo = {
  story?: {
    scripts?: Array<{ Page?: number; Eng?: string; Mean?: string }>;
  };
};

type WordInfo = {
  word?: Array<{ Word_Idx?: number; word_idx?: number; wordIdx?: number; Eng?: string; Mean?: string; Sentence?: string; WordClass?: string }>;
};

type SentenceInfo = {
  sentence?: Array<{ Sentence_Idx?: number; sentence_idx?: number; sentenceIdx?: number; Eng?: string; Mean?: string; Slice?: string; Blank_Index?: number }>;
};

type MovieInfo = {
  version?: number;
  source?: string;
  captionTiming?: "generated" | "source";
  movie?: Array<{
    is_url?: boolean;
    video_path?: string;
    videoPath?: string;
    audioPath?: string;
    smi_path?: string;
    captionPaths?: string[];
  }>;
  captions?: MovieCaptionCue[];
};

type MovieCaptionCue = ListenCaptionCue & {
  translation?: string;
  generated?: boolean;
};

type ListenEbookInfo = {
  version?: number;
  source?: string;
  pages?: ListenEbookPageInfo[];
  captionPaths?: string[];
  fallbackVideoPaths?: string[];
};

type ListenEbookPageInfo = {
  pageIndex: number;
  bookPage?: number | string;
  pdfPage?: number | string;
  imagePath?: string;
  audioPaths?: string[];
  captionPaths?: string[];
  captions?: ListenCaptionCue[];
  imgW?: number;
  imgH?: number;
  label?: string;
  words?: ListenViewerWord[];
};

type CanonicalListenEbook = {
  title?: string;
  layout?: string;
  defaultView?: string;
  pages?: CanonicalListenEbookPage[];
};

type CanonicalListenEbookPage = {
  pageNo?: number | string;
  pageIndex?: number;
  bookPage?: number | string;
  pdfPage?: number | string;
  img?: string;
  image?: string;
  imagePath?: string;
  page?: string;
  audio?: string | string[];
  audioPaths?: string[];
  audios?: string[];
  captions?: ListenCaptionCue[];
  cues?: ListenCaptionCue[];
  width?: number;
  height?: number;
  imgW?: number;
  imgH?: number;
  label?: string;
  words?: CanonicalListenEbookWord[];
};

type CanonicalListenEbookWord = {
  w?: string;
  text?: string;
  x?: number;
  y?: number;
  bw?: number;
  bh?: number;
  t0?: number | null;
  t1?: number | null;
  body?: boolean;
  read?: boolean;
};

type LoadedListenEbookPage = {
  pageIndex: number;
  bookPage?: number | string;
  pdfPage?: number | string;
  imagePath?: string;
  imageUrl?: string;
  audioPaths: string[];
  audioUrls: string[];
  captionPaths: string[];
  captions: ListenCaptionCue[];
  imgW?: number;
  imgH?: number;
  label?: string;
  words?: ListenViewerWord[];
};

type LoadedListenEbook = {
  checked: boolean;
  pages: LoadedListenEbookPage[];
  fallbackVideoPaths: string[];
};

type ListenViewerAudio = {
  src: string;
  path?: string;
  cues: ListenCaptionCue[];
};

type ListenViewerWord = {
  w: string;
  x: number;
  y: number;
  bw: number;
  bh: number;
  t0: number | null;
  t1: number | null;
  body: boolean;
  read: boolean;
};

type ListenViewerPage = {
  pageIndex: number;
  bookPage: number | string;
  pdfPage?: number | string;
  img: string;
  imgPath?: string;
  imgW?: number;
  imgH?: number;
  audios: ListenViewerAudio[];
  words: ListenViewerWord[];
  label?: string;
};

type ListenViewerBook = {
  id: string;
  title: string;
  level: string;
  boxSource: string;
  pages: ListenViewerPage[];
};

type BookPageInfo = {
  book_page?: unknown[];
};

type QuizInfo = {
  quizs?: Array<{ question?: string; right_num?: number; answers?: Array<{ text?: string }> }>;
};

type ReadFlipInfo = {
  pages?: Array<{ Items?: Array<{ left?: string; flip?: string; right?: string; flip_2?: string; right_2?: string }> }>;
};

type ReadMatchInfo = {
  page?: Array<{ answers?: Array<{ text?: string; is_word?: boolean }> }>;
};

type LoadedWord = {
  index: number;
  wordIdx?: number;
  eng: string;
  mean: string;
  sentence: string;
  wordClass: string;
  imagePath?: string;
  imageUrl?: string;
  audioPath?: string;
  audioUrl?: string;
};

type LoadedReadingPage = {
  index: number;
  imagePath: string;
  imageUrl?: string;
  audioUrls: string[];
  script?: { Eng?: string; Mean?: string };
};

type LoadedSentence = {
  index: number;
  sentenceIdx?: number;
  eng: string;
  mean: string;
  slice: string;
  blankIndex: number;
  audioPath?: string;
  audioUrl?: string;
};

export type PrototypeActivityData = {
  words?: LoadedWord[];
  sentences?: LoadedSentence[];
};

type MemoryCard = {
  id: string;
  wordIndex: number;
  kind: "image" | "word";
  word: LoadedWord;
};

type VocaQuizMode = "text-image" | "image-text" | "sound-text" | "sound-image";

type MemoryRoundConfig = {
  pairCount: number;
  columns: number;
  rows: number;
  timeLimit: number;
};

type MemoryGameStatus = "playing" | "round-complete" | "failed" | "complete";

type UnscrambleDisplayItem =
  | { kind: "static"; text: string; punctuation: boolean }
  | { kind: "slot"; answerIndex: number };

const MAX_UNSCRAMBLE_ACTIVE_TOKENS = 10;

type WordBlankQuestion = {
  letters: string[];
  blankIndex: number;
  answer: string;
  options: string[];
};

type UnderSeaBubble = {
  id: string;
  letter: string;
  x: number;
  y: number;
  tone: number;
};

type UnderSeaQuestion = {
  letters: string[];
  blankIndexes: number[];
  bubbles: UnderSeaBubble[];
};

type PercentPoint = {
  x: number;
  y: number;
};

type ContextClozeQuestion = {
  sentence: LoadedSentence;
  tokens: string[];
  blankTokenIndex: number;
  answer: string;
  options: string[];
};

type SentenceRepairQuestion = {
  sentence: LoadedSentence;
  tokens: string[];
  answerTokens: string[];
  brokenTokens: string[];
  bank: string[];
};

type GrammarTransformQuestion = {
  sentence: LoadedSentence;
  prompt: string;
  source: string;
  target: string;
  helper: string;
};

type ParaphraseMatchQuestion = {
  sentence: LoadedSentence;
  prompt: string;
  answer: string;
  options: string[];
};

const UNDERSEA_ASSET_BASE = "/metaon-assets/unity-undersea";
const FIGMA_RENEWAL_ASSET_BASE = "/metaon-assets/activity/figma-renewal";
const MEMORY_GAME_ROUNDS: readonly MemoryRoundConfig[] = [
  { pairCount: 2, columns: 2, rows: 2, timeLimit: 7 },
  { pairCount: 3, columns: 3, rows: 2, timeLimit: 10 },
  { pairCount: 4, columns: 4, rows: 2, timeLimit: 20 },
  { pairCount: 6, columns: 4, rows: 3, timeLimit: 40 }
];
const READ_RECORD_WAVEFORM = [
  18, 34, 48, 62, 78, 92, 84, 67, 52, 72, 88, 96, 82, 58, 43, 66, 76, 61, 49, 36, 54, 70, 86, 93, 98, 87,
  71, 55, 40, 29, 48, 63, 77, 65, 51, 38, 57, 73, 89, 81, 66, 50, 35, 28, 43, 59, 34, 21
];

export function ActivityFrame({
  context,
  children,
  loading = false,
  className = ""
}: {
  context: ActivityRendererContext;
  children: ReactNode;
  actionLabel: string;
  /**
   * Metadata can be available before dependent media has been turned into
   * browser URLs. Keep the shared loader over the activity until that work is
   * complete so transient "No word" / missing-image UI is never exposed.
   */
  loading?: boolean;
  className?: string;
}) {
  const metadataPaths = useMemo(
    () => activityMetadataPaths(context),
    [context.day?.day, context.day?.lesson, context.packageMeta?.key, context.packageMeta?.manifest]
  );
  const [isResourceLoading, setIsResourceLoading] = useState(() => Boolean(context.packageMeta?.key));

  useEffect(() => {
    let active = true;
    const packageKey = context.packageMeta?.key;
    if (!packageKey) {
      setIsResourceLoading(false);
      return undefined;
    }

    setIsResourceLoading(true);
    void warmActivityResources(packageKey, context, metadataPaths)
      .catch(() => undefined)
      .finally(() => {
        if (active) setIsResourceLoading(false);
      });

    return () => {
      active = false;
    };
  }, [context.packageMeta?.key, metadataPaths]);

  const isLoading = isResourceLoading || loading;

  return (
    <section
      aria-busy={isLoading}
      className={`activity-frame unity-activity-frame${className ? ` ${className}` : ""}${isLoading ? " is-resource-loading" : ""}`}
    >
      {children}
      {isLoading ? <ActivityResourceLoading /> : null}
    </section>
  );
}

async function warmActivityResources(
  packageKey: string,
  context: ActivityRendererContext,
  metadataPaths: string[]
): Promise<void> {
  // Resource hooks own their image/audio URL and decode lifecycle. Warming each
  // word image here made every asset read and decode twice before the Activity
  // became visible. Only verify the activity metadata that selects its assets.
  await Promise.all(metadataPaths.map((path) => indexedDbStorage.getFileBlob(packageKey, path)));
}

function ActivityResourceLoading() {
  return <ActivityLoadingVisual className="activity-resource-loading" />;
}

function activityMetadataPaths(context: ActivityRendererContext): string[] {
  const manifest = context.packageMeta?.manifest as { generatedFiles?: Array<{ path?: unknown }> } | undefined;
  const base = `${dayBase(context)}/`;
  return Array.from(
    new Set(
      (manifest?.generatedFiles || [])
        .map((file) => (typeof file.path === "string" ? file.path : ""))
        .filter((path) => path.startsWith(base) && path.toLowerCase().endsWith(".json"))
    )
  );
}

function RenewalCounter({ current, total, className = "" }: { current: number; total: number; className?: string }) {
  return (
    <div className={`renewal-question-counter${className ? ` ${className}` : ""}`} aria-label={`Question ${current} of ${total}`}>
      <strong>{current}</strong>
      <span>/</span>
      <span>{total}</span>
    </div>
  );
}

function ActivityQuestionNavigation({
  current,
  total,
  onChange,
  disablePrev = false,
  disableNext = false,
  variant = "standard"
}: {
  current: number;
  total: number;
  onChange: (nextIndex: number) => void;
  disablePrev?: boolean;
  disableNext?: boolean;
  variant?: "standard" | "video";
}) {
  return (
    <>
      <button
        aria-label="Previous question"
        className={`activity-question-edge-nav previous image-page-control${variant === "video" ? " is-video" : ""}`}
        disabled={disablePrev || total === 0 || current <= 0}
        onClick={() => onChange(Math.max(0, current - 1))}
        type="button"
      >
        {variant === "video" ? <VideoActivityPageArrow direction="prev" /> : <ActivityPageArrowImage direction="prev" />}
      </button>
      <button
        aria-label="Next question"
        className={`activity-question-edge-nav next image-page-control${variant === "video" ? " is-video" : ""}`}
        disabled={disableNext || total === 0 || current >= total - 1}
        onClick={() => onChange(Math.min(Math.max(total - 1, 0), current + 1))}
        type="button"
      >
        {variant === "video" ? <VideoActivityPageArrow direction="next" /> : <ActivityPageArrowImage direction="next" />}
      </button>
    </>
  );
}

function RenewalSoundButton({
  src,
  label,
  className = "",
  icon = "listening",
  assetSrc,
  onPlay
}: {
  src?: string;
  label: string;
  className?: string;
  icon?: "listening" | "sound";
  assetSrc?: string;
  onPlay?: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  function replay() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setIsPlaying(true);
    audio.play().catch(() => setIsPlaying(false));
    onPlay?.();
  }

  return (
    <>
      <button
        aria-label={label}
        className={`renewal-sound-button${isPlaying ? " is-playing" : ""}${className ? ` ${className}` : ""}`}
        disabled={!src}
        onClick={replay}
        type="button"
      >
        {assetSrc ? <img aria-hidden="true" className="renewal-sound-asset" draggable={false} src={assetSrc} alt="" /> : icon === "sound" ? <ActivitySoundImage /> : <ActivityListeningImage />}
      </button>
      {src ? <audio ref={audioRef} src={src} preload="auto" onEnded={() => setIsPlaying(false)} /> : null}
    </>
  );
}

function recordLearnEvent(context: ActivityRendererContext, event: LearnEventInput): void {
  context.learnEventRecorder?.record(event);
}

function ImmersiveVideoFrame({ children, loading = false }: { children: ReactNode; loading?: boolean }) {
  return (
    <section aria-busy={loading} className={`activity-frame unity-activity-frame immersive-video-frame${loading ? " is-resource-loading" : ""}`}>
      <div className="immersive-video-activity">{children}</div>
      {loading ? <ActivityResourceLoading /> : null}
    </section>
  );
}

export function BookPageActivity({ context }: { context: ActivityRendererContext }) {
  const base = dayBase(context);
  const folder = paramFolder(context.activity);
  const pageInfoState = usePackageJsonState<BookPageInfo>(context, `${base}/bookpage/${folder}/info_bookpage.json`);
  const pageInfo = pageInfoState.data;
  const pathState = usePackagePathListState(context, `${base}/bookpage/${folder}/`);
  const paths = pathState.paths;
  const pagePaths = useMemo(
    () => paths.filter((path) => /\/img\/img_page\.png$/i.test(path)).sort(),
    [paths]
  );
  const pageUrlState = usePackageUrlsState(context, pagePaths);
  const pageUrls = pageUrlState.urls;
  const [page, setPage] = useState(0);
  const visibleUrl = pageUrls[pagePaths[page]];
  const isVisibleImageDecoded = useDecodedImageUrls([visibleUrl]);
  const isResourceLoading = isCachedResourceLoading(context, pageInfoState, pathState, pageUrlState) || !isVisibleImageDecoded;

  useEffect(() => {
    if (page >= pagePaths.length) setPage(0);
  }, [page, pagePaths.length]);

  return (
    <ActivityFrame context={context} actionLabel="Preview" loading={isResourceLoading}>
      <div className="package-viewer">
        <div className="package-stage">
          {visibleUrl ? (
            <img className="package-page-image" src={visibleUrl} alt={`Book page ${page + 1}`} />
          ) : (
            <ResourceMissing label="bookpage image" />
          )}
        </div>
        <div className="activity-side-panel">
          <strong>Book package resource</strong>
          <p>
            {pagePaths.length} page images loaded from <code>{base}/bookpage/{folder}</code>.
          </p>
          <p className="muted">Book page JSON entries: {pageInfo?.book_page?.length ?? 0}</p>
          <div className="inline-actions">
            <button className="activity-question-edge-nav previous image-page-control" aria-label="Previous page" type="button" onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={page === 0}>
              <ActivityPageArrowImage direction="prev" />
            </button>
            <span>
              {pagePaths.length === 0 ? 0 : page + 1} / {pagePaths.length}
            </span>
            <button
              className="activity-question-edge-nav next image-page-control"
              aria-label="Next page"
              type="button"
              onClick={() => setPage((value) => Math.min(pagePaths.length - 1, value + 1))}
              disabled={pagePaths.length === 0 || page >= pagePaths.length - 1}
            >
              <ActivityPageArrowImage direction="next" />
            </button>
          </div>
        </div>
      </div>
    </ActivityFrame>
  );
}

export function ReadingActivity({ context }: { context: ActivityRendererContext }) {
  const reading = useReadingAssets(context);
  const wordResource = useWordsState(context);
  const words = wordResource.words;
  const isResourceLoading = reading.status === "loading" || wordResource.status === "loading";
  const [page, setPage] = useState(0);
  const [wordPanelSide, setWordPanelSide] = useState<"left" | "right">();
  const [readMode, setReadMode] = useState<"auto" | "manual">("auto");
  const [activeAudioIndex, setActiveAudioIndex] = useState(0);
  const readingAudioRef = useRef<HTMLAudioElement>(null);
  const current = reading.pages[page];
  const recorder = useActivityRecorder(current?.script?.Eng);
  const totalPages = reading.pages.length;
  const currentAudioUrl = current?.audioUrls[activeAudioIndex] || current?.audioUrls[0];
  const pageWords = useMemo(() => selectReadingPageWords(words, page), [page, words]);
  const pageViewKeyRef = useRef("");

  useEffect(() => {
    if (page >= reading.pages.length) setPage(0);
  }, [page, reading.pages.length]);

  useEffect(() => {
    setActiveAudioIndex(0);
    setWordPanelSide(undefined);
  }, [page]);

  useEffect(() => {
    if (!current) return;
    const key = `${current.imagePath}:${page}`;
    if (pageViewKeyRef.current === key) return;
    pageViewKeyRef.current = key;
    recordLearnEvent(context, {
      action: "page_view",
      item_type: "page",
      item_idx: null,
      extra: {
        page_no: page + 1,
        page_index: page,
        image_path: current.imagePath,
        audio_count: current.audioUrls.length,
        script: current.script?.Eng
      }
    });
  }, [context, current, page]);

  function movePage(delta: number) {
    recordLearnEvent(context, {
      action: delta > 0 ? "page_next" : "page_prev",
      item_type: "page",
      item_idx: null,
      extra: {
        from_page_no: page + 1,
        to_page_no: Math.min(Math.max(page + delta, 0), Math.max(totalPages - 1, 0)) + 1
      }
    });
    setPage((value) => Math.min(Math.max(value + delta, 0), Math.max(totalPages - 1, 0)));
  }

  function playPageAudio(index = 0) {
    if (!current?.audioUrls[index]) return;
    setActiveAudioIndex(index);
    window.setTimeout(() => {
      void readingAudioRef.current?.play().catch(() => undefined);
    }, 0);
    recordLearnEvent(context, {
      action: "audio_play",
      item_type: "page",
      item_idx: null,
      audio_replays: 1,
      extra: {
        page_no: page + 1,
        page_index: page,
        audio_index: index,
        script: current.script?.Eng
      }
    });
  }

  function playWordAudio(word: LoadedWord) {
    if (!word.audioUrl) return;
    const audio = new Audio(word.audioUrl);
    void audio.play().catch(() => undefined);
    recordLearnEvent(context, {
      action: "audio_play",
      item_type: "word",
      item_idx: wordItemIdx(word),
      audio_replays: 1,
      extra: {
        word: word.eng,
        page_no: page + 1,
        audio_path: word.audioPath
      }
    });
  }

  async function toggleReadingRecording() {
    const stopping = recorder.isRecording;
    await recorder.toggleRecording();
    recordLearnEvent(context, {
      action: stopping ? "record_stop" : "record_start",
      item_type: "page",
      item_idx: null,
      extra: {
        page_no: page + 1,
        page_index: page,
        script: current?.script?.Eng
      }
    });
  }

  return (
    <ActivityFrame context={context} actionLabel="Read Record" loading={isResourceLoading}>
      <div className="read-record-shell" data-mode={readMode}>
        <div className="read-record-room" aria-hidden="true">
          <span className="read-record-shelf left" />
          <span className="read-record-shelf right" />
          <span className="read-record-floor" />
          <span className="read-record-mascot" />
        </div>

        <button
          type="button"
          className="read-record-back-chip"
          aria-label="Toggle reading mode"
          onClick={() => setReadMode((value) => (value === "auto" ? "manual" : "auto"))}
        >
          {readMode === "auto" ? "Auto" : "Manual"}
        </button>

        <section className="read-record-book" aria-label="Read Record book">
          <div className="read-record-book-stack" />
          <div className="read-record-page-card">
            {current?.imageUrl ? (
              <img className="read-record-page-image" src={current.imageUrl} alt={current.script?.Eng || `Reading page ${page + 1}`} />
            ) : (
              <ResourceMissing label="reading page image" />
            )}
          </div>

          <button
            className="read-record-page-nav previous image-page-control"
            onClick={() => movePage(-1)}
            disabled={page === 0}
            aria-label="Previous page"
            type="button"
          >
            <ActivityPageArrowImage direction="prev" />
          </button>
          <button
            type="button"
            className="read-record-page-nav next image-page-control"
            onClick={() => movePage(1)}
            disabled={totalPages === 0 || page >= totalPages - 1}
            aria-label="Next page"
          >
            <ActivityPageArrowImage direction="next" />
          </button>

          <div className="read-record-page-count" aria-label="Page count">
            <strong>{totalPages === 0 ? 0 : page + 1}</strong>
            <span>/</span>
            <strong>{totalPages}</strong>
          </div>

          <button
            type="button"
            className="read-record-word-tab left"
            aria-label="Open left vocabulary popup"
            onClick={() => setWordPanelSide((value) => (value === "left" ? undefined : "left"))}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            className="read-record-word-tab right"
            aria-label="Open right vocabulary popup"
            onClick={() => setWordPanelSide((value) => (value === "right" ? undefined : "right"))}
          >
            <ChevronRight size={18} />
          </button>

          {wordPanelSide ? (
            <div className={`read-record-word-popup ${wordPanelSide}`}>
              <button type="button" className="read-record-popup-close" aria-label="Close vocabulary popup" onClick={() => setWordPanelSide(undefined)}>
                <X size={24} />
              </button>
              {pageWords.length > 0 ? (
                pageWords.map((word) => (
                  <div className="read-record-word-row" key={`${word.index}:${word.eng}`}>
                    <Star size={17} fill="#ffb61d" strokeWidth={0} />
                    <div>
                      <strong>{word.eng}</strong>
                      {word.mean ? <span>{word.mean}</span> : null}
                    </div>
                    <button
                      type="button"
                      className="read-record-word-sound"
                      aria-label={`Play ${word.eng}`}
                      onClick={() => playWordAudio(word)}
                      disabled={!word.audioUrl}
                    >
                      <ActivityListeningImage />
                    </button>
                  </div>
                ))
              ) : (
                <p className="read-record-popup-empty">No vocabulary</p>
              )}
            </div>
          ) : null}
        </section>

        <div className="read-record-control-bar" aria-label="Read Record controls">
          <div className="read-record-control-icons">
            <button
              type="button"
              className={`read-record-circle control-mic${recorder.isRecording ? " is-active" : ""}`}
              aria-label="Toggle recording"
              onClick={() => void toggleReadingRecording()}
            >
              {recorder.isRecording ? <Square size={22} fill="currentColor" /> : <Mic size={24} />}
            </button>
            <button
              type="button"
              className="read-record-circle control-listen"
              aria-label="Play page audio"
              onClick={() => playPageAudio(0)}
              disabled={!current?.audioUrls.length}
            >
              <ActivityListeningImage />
            </button>
          </div>

          <span className="read-record-divider" />

          <div className="read-record-media-zone">
            <button
              type="button"
              className="read-record-rec-pill"
              aria-label={recorder.recordingUrl ? "Play my voice" : "Record status"}
              onClick={() => {
                if (recorder.recordingUrl) void new Audio(recorder.recordingUrl).play().catch(() => undefined);
              }}
            >
              <span />
              {recorder.recordingUrl ? "My Voice" : recorder.isRecording ? "REC..." : "REC"}
            </button>
            <div className={`read-record-waveform${recorder.isRecording ? " is-recording" : recorder.recordingUrl ? " is-saved" : ""}`} aria-hidden="true">
              {READ_RECORD_WAVEFORM.map((height, index) => (
                <span key={`${height}:${index}`} style={{ "--bar-height": `${height}%` } as CSSProperties} />
              ))}
            </div>
            <p className="read-record-status">{recorder.status}</p>
          </div>

          <button type="button" className="read-record-book-toggle" aria-label="Toggle book view">
            <BookOpen size={34} />
          </button>
        </div>

        {currentAudioUrl ? <audio ref={readingAudioRef} src={currentAudioUrl} preload="metadata" /> : null}
      </div>
    </ActivityFrame>
  );
}

export function ListeningActivity({ context }: { context: ActivityRendererContext }) {
  const base = dayBase(context);
  const folder = paramFolder(context.activity);
  const listenEbook = useListenEbookAssets(context);
  const videoPathState = usePackagePathListState(context, `${base}/listening/${folder}/video/`);
  const paths = videoPathState.paths;
  const videoPaths = useMemo(() => paths.filter((path) => /\.mp4$/i.test(path)).sort(naturalPathCompare), [paths]);
  const [videoIndex, setVideoIndex] = useState(0);
  const safeVideoIndex = Math.min(videoIndex, Math.max(videoPaths.length - 1, 0));
  const videoPath = videoPaths[safeVideoIndex];
  const videoUrlState = usePackageUrlsState(context, videoPath ? [videoPath] : []);
  const videoUrl = videoPath ? videoUrlState.urls[videoPath] : undefined;
  const videoViewKeyRef = useRef("");

  useEffect(() => {
    setVideoIndex((current) => Math.min(current, Math.max(videoPaths.length - 1, 0)));
  }, [videoPaths.length]);

  useEffect(() => {
    if (!videoPath) return;
    const key = `${videoPath}:${safeVideoIndex}`;
    if (videoViewKeyRef.current === key) return;
    videoViewKeyRef.current = key;
    recordLearnEvent(context, {
      action: "video_view",
      item_type: "page",
      item_idx: null,
      extra: {
        page_no: safeVideoIndex + 1,
        video_index: safeVideoIndex,
        video_path: videoPath,
        video_count: videoPaths.length
      }
    });
  }, [context, safeVideoIndex, videoPath, videoPaths.length]);

  if (listenEbook.checked && listenEbook.pages.some((page) => page.imagePath && page.audioPaths.length > 0)) {
    return <ListeningViewerActivity context={context} assets={listenEbook} />;
  }

  if (!listenEbook.checked || isCachedResourceLoading(context, videoPathState, videoUrlState)) {
    return (
      <ImmersiveVideoFrame loading>
        <span aria-hidden="true" />
      </ImmersiveVideoFrame>
    );
  }

  if (!videoPath) {
    return <MovieActivity context={context} label="Listening" immersive />;
  }

  const moveVideo = (delta: number) => {
    setVideoIndex((current) => {
      if (videoPaths.length === 0) return 0;
      return (current + delta + videoPaths.length) % videoPaths.length;
    });
  };

  return (
    <ImmersiveVideoFrame>
      <div className="listening-video-shell">
        <video
          key={videoPath}
          className="activity-video immersive-activity-video"
          src={videoUrl}
          controls
          playsInline
          onPlay={() =>
            recordLearnEvent(context, {
              action: "video_play",
              item_type: "page",
              item_idx: null,
              extra: { page_no: safeVideoIndex + 1, video_index: safeVideoIndex, video_path: videoPath }
            })
          }
          onPause={() =>
            recordLearnEvent(context, {
              action: "video_pause",
              item_type: "page",
              item_idx: null,
              extra: { page_no: safeVideoIndex + 1, video_index: safeVideoIndex, video_path: videoPath }
            })
          }
          onEnded={() =>
            recordLearnEvent(context, {
              action: "video_complete",
              item_type: "page",
              item_idx: null,
              extra: { page_no: safeVideoIndex + 1, video_index: safeVideoIndex, video_path: videoPath }
            })
          }
        />
        {videoPaths.length > 1 ? (
          <>
            <button
              type="button"
              className="listening-video-edge-nav previous image-page-control"
              onClick={() => moveVideo(-1)}
              aria-label="Previous video"
              title="Previous video"
            >
              <ActivityPageArrowImage direction="prev" />
            </button>
            <div className="listening-video-controls" aria-label="Listening video playlist">
              <div className="listening-video-pages">
                {videoPaths.map((path, index) => (
                  <button
                    type="button"
                    key={path}
                    className={`listening-video-page${index === safeVideoIndex ? " active" : ""}`}
                    onClick={() => setVideoIndex(index)}
                    aria-label={`Video ${index + 1}`}
                    aria-current={index === safeVideoIndex ? "true" : undefined}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              className="listening-video-edge-nav next image-page-control"
              onClick={() => moveVideo(1)}
              aria-label="Next video"
              title="Next video"
            >
              <ActivityPageArrowImage direction="next" />
            </button>
          </>
        ) : null}
      </div>
    </ImmersiveVideoFrame>
  );
}

function ListeningViewerActivity({ context, assets }: { context: ActivityRendererContext; assets: LoadedListenEbook }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const book = useMemo(() => buildListenViewerBook(context, assets), [assets, context]);
  const viewerSrc = useMemo(() => listenViewerSrc(), []);
  const viewerOrigin = useMemo(() => messageTargetOrigin(viewerSrc), [viewerSrc]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
  }, [viewerSrc, book.id, book.pages.length]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const data = event.data as {
        type?: string;
        payload?: {
          event?: string;
          pageIndex?: number;
          audioIndex?: number;
          pageCount?: number;
          word?: string;
        };
      };
      if (data?.type === "metaon.listenViewer.ready") {
        setReady(true);
        return;
      }

      if (data?.type === "metaon.listenViewer.event") {
        const payload = data.payload || {};
        const action = listenViewerLearnAction(payload.event);
        if (!action) return;

        recordLearnEvent(context, {
          action,
          item_type: "page",
          item_idx: null,
          extra: {
            page_no: typeof payload.pageIndex === "number" ? payload.pageIndex + 1 : undefined,
            page_index: payload.pageIndex,
            audio_index: payload.audioIndex,
            page_count: payload.pageCount,
            viewer_event: payload.event,
            word: payload.word
          }
        });
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [context]);

  useEffect(() => {
    if (!ready || !iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      {
        type: "metaon.listenViewer.load",
        payload: { book }
      },
      viewerOrigin
    );
  }, [book, ready, viewerOrigin]);

  if (book.pages.length === 0) {
    return <ListenEbookActivity context={context} assets={assets} />;
  }

  return (
    <ImmersiveVideoFrame loading={!ready}>
      <div className="listen-viewer-frame-shell">
        <iframe
          ref={iframeRef}
          className="listen-viewer-frame"
          src={viewerSrc}
          title="Listen E-book viewer"
          onLoad={() => setReady(true)}
          sandbox="allow-scripts allow-same-origin"
          allow="autoplay"
          data-book-title={book.title}
          data-page-count={book.pages.length}
        />
      </div>
    </ImmersiveVideoFrame>
  );
}

function listenViewerLearnAction(eventName?: string): string | undefined {
  switch (eventName) {
    case "page.ready":
    case "page.view":
      return "page_view";
    case "audio.play":
      return "audio_play";
    case "audio.pause":
      return "audio_pause";
    case "audio.replay":
      return "audio_replay";
    case "caption.active":
      return "caption_active";
    case "page.next":
      return "page_next";
    case "page.prev":
      return "page_prev";
    case "book.complete":
      return "activity_complete";
    default:
      return undefined;
  }
}

function recordListenEbookAudioEvent(
  context: ActivityRendererContext,
  page: LoadedListenEbookPage | undefined,
  pageIndex: number,
  audioIndex: number,
  action: string,
  autoAdvanced = false
): void {
  recordLearnEvent(context, {
    action,
    item_type: "page",
    item_idx: null,
    extra: {
      page_no: page?.bookPage || pageIndex + 1,
      page_index: page?.pageIndex ?? pageIndex,
      audio_index: audioIndex,
      audio_path: page?.audioPaths[audioIndex],
      auto_advanced: autoAdvanced
    }
  });
}

function buildListenViewerBook(context: ActivityRendererContext, assets: LoadedListenEbook): ListenViewerBook {
  const title = packageBookTitle(context.packageMeta) || context.activity?.title || "Listen";
  const id = context.packageMeta?.bookId || String(context.packageMeta?.bookIdx || "listen");
  const pages = assets.pages
    .filter((page) => page.imageUrl && page.audioUrls.length > 0)
    .map((page, pageIndex) => {
      const audios = page.audioUrls.map((src, audioIndex) => {
        const matchingCues = page.captions.filter((cue) => cue.audioIndex === audioIndex || cue.audioIndex == null);
        const cues = matchingCues.length > 0 ? matchingCues : page.captions;
        return {
          src,
          path: page.audioPaths[audioIndex],
          cues: cues.map((cue) => ({
            ...cue,
            pageIndex: cue.pageIndex ?? page.pageIndex,
            audioIndex
          }))
        };
      });

      return {
        pageIndex: page.pageIndex ?? pageIndex,
        bookPage: page.bookPage ?? pageIndex + 1,
        pdfPage: page.pdfPage,
        img: page.imageUrl || "",
        imgPath: page.imagePath,
        imgW: page.imgW || 0,
        imgH: page.imgH || 0,
        audios,
        words: page.words?.length ? page.words : buildListenViewerWords(audios),
        label: page.label
      };
    });

  return {
    id,
    title,
    level: "",
    boxSource: "metaon-listen-ebook",
    pages
  };
}

function buildListenViewerWords(audios: ListenViewerAudio[]): ListenViewerWord[] {
  const cueWords = audios.flatMap((audio) =>
    audio.cues.flatMap((cue) =>
      splitCaptionText(cue.text).flatMap((sentence) =>
        sentence
          .split(/\s+/)
          .map((word) => word.trim())
          .filter(Boolean)
      )
    )
  );

  return cueWords.slice(0, 80).map((word, index) => ({
    w: word,
    x: 0,
    y: 0,
    bw: 0,
    bh: 0,
    t0: null,
    t1: null,
    body: true,
    read: true
  }));
}

function listenViewerSrc(): string {
  const meta = import.meta as ImportMeta & { env?: { VITE_LISTEN_VIEWER_URL?: string } };
  return meta.env?.VITE_LISTEN_VIEWER_URL || "/ebook-viewer/poc_htmljson/index.html";
}

function messageTargetOrigin(src: string): string {
  if (src.startsWith("/")) return window.location.origin;

  try {
    return new URL(src, window.location.href).origin;
  } catch {
    return window.location.origin;
  }
}

function ListenEbookActivity({ context, assets }: { context: ActivityRendererContext; assets: LoadedListenEbook }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const playablePages = assets.pages.filter((page) => page.imagePath && page.audioPaths.length > 0);
  const [pageIndex, setPageIndex] = useState(0);
  const [audioIndex, setAudioIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoPlayNext, setAutoPlayNext] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const currentPage = playablePages[Math.min(pageIndex, Math.max(playablePages.length - 1, 0))];
  const currentAudioUrl = currentPage?.audioUrls[Math.min(audioIndex, Math.max(currentPage.audioUrls.length - 1, 0))];
  const currentAudioIndex = Math.min(audioIndex, Math.max((currentPage?.audioUrls.length || 1) - 1, 0));
  const currentPageCaptions = currentPage?.captions || [];
  const matchingCues = currentPageCaptions.filter((cue) => cue.audioIndex === currentAudioIndex || cue.audioIndex == null);
  const pageCues = normalizeListenCueTiming(
    matchingCues.length > 0 ? matchingCues : currentPageCaptions,
    durationMs
  );
  const activeCue = pageCues.find((cue) => currentMs >= cue.startMs && currentMs < cue.endMs) || pageCues[0];
  const activeCaptionKeyRef = useRef("");

  useEffect(() => {
    setPageIndex((value) => Math.min(value, Math.max(playablePages.length - 1, 0)));
  }, [playablePages.length]);

  useEffect(() => {
    setAudioIndex(0);
    setCurrentMs(0);
    setDurationMs(0);
  }, [pageIndex]);

  useEffect(() => {
    setCurrentMs(0);
    setDurationMs(0);
  }, [currentAudioUrl]);

  useEffect(() => {
    if (!currentPage) return;
    recordLearnEvent(context, {
      action: "page_view",
      item_type: "page",
      item_idx: null,
      extra: {
        page_no: currentPage.bookPage || pageIndex + 1,
        page_index: currentPage.pageIndex ?? pageIndex,
        audio_count: currentPage.audioPaths.length,
        image_path: currentPage.imagePath
      }
    });
  }, [context, currentPage, pageIndex]);

  useEffect(() => {
    if (!activeCue) return;
    const key = `${pageIndex}:${activeCue.audioIndex}:${activeCue.startMs}:${activeCue.text}`;
    if (activeCaptionKeyRef.current === key) return;
    activeCaptionKeyRef.current = key;
    recordLearnEvent(context, {
      action: "caption_active",
      item_type: "page",
      item_idx: null,
      extra: {
        caption_text: activeCue.text,
        page_no: currentPage?.bookPage || pageIndex + 1,
        page_index: currentPage?.pageIndex ?? pageIndex,
        audio_index: activeCue.audioIndex ?? currentAudioIndex
      }
    });
  }, [activeCue, context, currentAudioIndex, currentPage, pageIndex]);

  useEffect(() => {
    if (!autoPlayNext || !currentAudioUrl) return;
    const audio = audioRef.current;
    if (!audio) return;
    setAutoPlayNext(false);
    audio.currentTime = 0;
    audio
      .play()
      .then(() => {
        setIsPlaying(true);
        recordListenEbookAudioEvent(context, currentPage, pageIndex, currentAudioIndex, "audio_play", true);
      })
      .catch(() => setIsPlaying(false));
  }, [autoPlayNext, context, currentAudioIndex, currentAudioUrl, currentPage, pageIndex]);

  function playCurrent() {
    const audio = audioRef.current;
    if (!audio || !currentAudioUrl) return;
    audio
      .play()
      .then(() => {
        setIsPlaying(true);
        recordListenEbookAudioEvent(context, currentPage, pageIndex, currentAudioIndex, "audio_play");
      })
      .catch(() => setIsPlaying(false));
  }

  function pauseCurrent() {
    const audio = audioRef.current;
    if (!audio) return;
    const wasPlaying = !audio.paused;
    audio.pause();
    setIsPlaying(false);
    if (wasPlaying) {
      recordListenEbookAudioEvent(context, currentPage, pageIndex, currentAudioIndex, "audio_pause");
    }
  }

  function togglePlay() {
    if (isPlaying) {
      pauseCurrent();
      return;
    }
    playCurrent();
  }

  function movePage(delta: number) {
    pauseCurrent();
    recordLearnEvent(context, {
      action: delta > 0 ? "page_next" : "page_prev",
      item_type: "page",
      item_idx: null,
      extra: {
        from_page_no: currentPage?.bookPage || pageIndex + 1,
        to_page_no: Math.min(Math.max(pageIndex + delta, 0), Math.max(playablePages.length - 1, 0)) + 1
      }
    });
    setPageIndex((value) => Math.min(Math.max(value + delta, 0), Math.max(playablePages.length - 1, 0)));
  }

  function handleEnded() {
    if (currentPage && currentAudioIndex < currentPage.audioUrls.length - 1) {
      setAudioIndex((value) => value + 1);
      setAutoPlayNext(true);
      return;
    }

    if (pageIndex < playablePages.length - 1) {
      setPageIndex((value) => value + 1);
      setAudioIndex(0);
      setAutoPlayNext(true);
      return;
    }

    setIsPlaying(false);
    recordLearnEvent(context, {
      action: "activity_complete",
      item_type: "activity",
      item_idx: context.activity?.actIdx ?? null,
      extra: {
        page_count: playablePages.length
      }
    });
  }

  if (!currentPage) {
    return (
      <ImmersiveVideoFrame>
        <ResourceMissing label="Listen E-book pages" />
      </ImmersiveVideoFrame>
    );
  }

  return (
    <ImmersiveVideoFrame>
      <div className="listen-ebook-shell">
        <div className="listen-ebook-page-stage">
          {currentPage.imageUrl ? (
            <button type="button" className="listen-ebook-image-button" onClick={togglePlay} aria-label="Play or pause Listen audio">
              <img className="listen-ebook-page-image" src={currentPage.imageUrl} alt={`Listen page ${pageIndex + 1}`} />
            </button>
          ) : (
            <ResourceMissing label="Listen page image" />
          )}
          <button
            type="button"
            className="listen-ebook-edge-nav previous image-page-control"
            onClick={() => movePage(-1)}
            disabled={pageIndex <= 0}
            aria-label="Previous page"
          >
            <ActivityPageArrowImage direction="prev" />
          </button>
          <button
            type="button"
            className="listen-ebook-edge-nav next image-page-control"
            onClick={() => movePage(1)}
            disabled={pageIndex >= playablePages.length - 1}
            aria-label="Next page"
          >
            <ActivityPageArrowImage direction="next" />
          </button>
          <div className="listen-ebook-caption-strip" aria-label="Listen captions">
            {activeCue ? (
              <span key={`${activeCue.audioIndex}:${activeCue.startMs}:${activeCue.text}`} className="listen-ebook-caption active">
                {activeCue.text}
              </span>
            ) : (
              <span className="listen-ebook-caption">Listen and follow the page.</span>
            )}
          </div>
        </div>
        <audio
          ref={audioRef}
          src={currentAudioUrl}
          preload="metadata"
          onLoadedMetadata={(event) => setDurationMs(Math.round(event.currentTarget.duration * 1000) || 0)}
          onTimeUpdate={(event) => {
            setCurrentMs(Math.round(event.currentTarget.currentTime * 1000));
            setDurationMs(Math.round(event.currentTarget.duration * 1000) || 0);
          }}
          onPause={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
          onEnded={handleEnded}
        />
      </div>
    </ImmersiveVideoFrame>
  );
}

export function MovieActivity(props: {
  context: ActivityRendererContext;
  label?: string;
  immersive?: boolean;
}) {
  if (normalizeActivityCode(props.context.activity?.activityCode) === MetaOnActivityCode.Movie) {
    return <Movie01Activity context={props.context} />;
  }

  return <LegacyMovieActivity {...props} />;
}

function LegacyMovieActivity({
  context,
  label = "Movie",
  immersive = false
}: {
  context: ActivityRendererContext;
  label?: string;
  immersive?: boolean;
}) {

  const base = dayBase(context);
  const infoState = usePackageJsonState<MovieInfo>(context, `${base}/movie/info_movie.json`);
  const info = infoState.data;
  const movieIndex = paramIndex(context.activity);
  const movie = info?.movie?.[movieIndex] || info?.movie?.[0];
  const localPath = movie && !movie.is_url && movie.video_path ? `video/movie/${movie.video_path}` : undefined;
  const localUrlState = usePackageUrlsState(context, localPath ? [localPath] : []);
  const localUrl = localPath ? localUrlState.urls[localPath] : undefined;
  const videoUrl = movie?.is_url ? movie.video_path?.replaceAll(" ", "_") : localUrl;
  const isResourceLoading = isCachedResourceLoading(context, infoState, localUrlState);

  if (immersive) {
    return (
      <ImmersiveVideoFrame loading={isResourceLoading}>
        {videoUrl ? (
          <video className="activity-video immersive-activity-video" src={videoUrl} controls playsInline />
        ) : (
          <ResourceMissing label="movie video" />
        )}
      </ImmersiveVideoFrame>
    );
  }

  return (
    <ActivityFrame context={context} actionLabel={label} loading={isResourceLoading}>
      <div className="video-activity">
        {videoUrl ? <video className="activity-video" src={videoUrl} controls playsInline /> : <ResourceMissing label="movie video" />}
        <div className="activity-side-panel">
          <strong>Movie source</strong>
          <p>{movie?.is_url ? "Remote CDN MP4" : "Cached package MP4"}</p>
          <p className="muted">{movie?.video_path || localPath || "No movie metadata"}</p>
        </div>
      </div>
    </ActivityFrame>
  );
}

type MovieLearningMode = "movie" | "script" | "movie-script";

function Movie01Activity({ context }: { context: ActivityRendererContext }) {
  const base = dayBase(context);
  const infoState = usePackageJsonState<MovieInfo>(context, `${base}/movie/info_movie.json`);
  const info = infoState.data;
  const moviePathState = usePackagePathListState(context, `${base}/movie/video/`);
  const moviePaths = moviePathState.paths;
  const selectedMovie = info?.movie?.[paramIndex(context.activity)] || info?.movie?.[0];
  const configuredVideoPath = selectedMovie?.videoPath || selectedMovie?.video_path;
  const videoPath = configuredVideoPath || moviePaths.filter((path) => /\.(mp4|webm|m3u8)$/i.test(path)).sort(naturalPathCompare)[0];
  const videoUrlState = usePackageUrlsState(context, videoPath ? [videoPath] : []);
  const videoUrl = videoPath ? videoUrlState.urls[videoPath] : undefined;
  const scriptAudioPath = selectedMovie?.audioPath;
  const scriptAudioUrlState = usePackageUrlsState(context, scriptAudioPath ? [scriptAudioPath] : []);
  const scriptAudioUrl = scriptAudioPath ? scriptAudioUrlState.urls[scriptAudioPath] : undefined;
  const captionPaths = selectedMovie?.captionPaths || [];
  const captionTextByPath = usePackageTextList(context, captionPaths);
  const isResourceLoading = isCachedResourceLoading(context, infoState, moviePathState, videoUrlState, scriptAudioUrlState);
  const modeVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [mode, setMode] = useState<MovieLearningMode>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showKorean, setShowKorean] = useState(false);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);

  const parsedCaptionCues = useMemo(
    () =>
      Object.entries(captionTextByPath).flatMap(([path, source]) =>
        parseCaptionCues(source, path).map((cue) => ({ ...cue, translation: "" }))
      ),
    [captionTextByPath]
  );
  const previewCues = useMemo<MovieCaptionCue[]>(
    () =>
      !context.packageMeta && import.meta.env.DEV
        ? [
            { pageIndex: 0, audioIndex: 0, startMs: 0, endMs: 4500, text: "They go back on the boat.", translation: "그들은 배로 돌아갑니다." },
            { pageIndex: 0, audioIndex: 1, startMs: 4500, endMs: 9000, text: "It was a good trip.", translation: "즐거운 여행이었어요." }
          ]
        : [],
    [context.packageMeta]
  );
  const scriptCues = useMemo(() => {
    const source = parsedCaptionCues.length > 0 ? parsedCaptionCues : info?.captions?.length ? info.captions : previewCues;
    return normalizeMovieCaptionCues(source, durationMs, parsedCaptionCues.length === 0 && info?.captionTiming !== "source");
  }, [durationMs, info?.captionTiming, info?.captions, parsedCaptionCues, previewCues]);
  const activeCueIndex = useMemo(() => findMovieCueIndex(scriptCues, currentMs), [currentMs, scriptCues]);
  const visibleCues = useMemo(() => movieScriptWindow(scriptCues, activeCueIndex), [activeCueIndex, scriptCues]);
  const isScriptMode = mode === "script" || mode === "movie-script";
  const usesScriptAudio = mode === "script" && Boolean(scriptAudioUrl);
  const hasPlayableMedia = Boolean(mode === "script" ? scriptAudioUrl || videoUrl : videoUrl);

  function activeMedia(): HTMLMediaElement | null {
    return usesScriptAudio ? audioRef.current : videoRef.current;
  }

  useEffect(() => {
    const media = activeMedia();
    if (!media) return;
    media.playbackRate = playbackRate;
  }, [playbackRate, mode, scriptAudioUrl, usesScriptAudio, videoUrl]);

  useEffect(() => {
    const media = activeMedia();
    if (!media || !mode) return;
    void media.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
  }, [mode, scriptAudioUrl, usesScriptAudio, videoUrl]);

  function resetMediaToStart(media: HTMLMediaElement | null) {
    if (!media) return;
    media.pause();
    try {
      media.currentTime = 0;
    } catch {
      // Seeking is unavailable until some streamed media exposes metadata.
    }
  }

  function selectMode(nextMode: MovieLearningMode) {
    resetMediaToStart(modeVideoRef.current);
    resetMediaToStart(videoRef.current);
    resetMediaToStart(audioRef.current);
    setCurrentMs(0);
    setDurationMs(0);
    setIsPlaying(false);
    setMode(nextMode);
    setShowModeMenu(false);
    recordLearnEvent(context, {
      action: "movie_mode_select",
      item_type: "activity",
      item_idx: context.activity?.actIdx ?? null,
      extra: { mode: nextMode, video_path: videoPath || "" }
    });
  }

  function togglePlayback() {
    const media = activeMedia();
    if (!media) return;
    if (media.paused) {
      void media.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      media.pause();
    }
  }

  return (
    <ActivityFrame context={context} actionLabel="Movie" loading={isResourceLoading} className="movie01-frame">
      <section className={`movie01-shell${mode ? " is-player" : " is-mode-select"}${mode === "script" ? " is-script-mode" : ""}`}>
        {mode ? (
          <>
            {videoUrl && !usesScriptAudio ? (
              <video
                key="movie01-player-video"
                className="movie01-video"
                controls={false}
                crossOrigin="anonymous"
                playsInline
                preload="auto"
                ref={videoRef}
                src={videoUrl}
                onClick={togglePlayback}
                onLoadedMetadata={(event) => setDurationMs(Math.round(event.currentTarget.duration * 1000) || 0)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={(event) => setCurrentMs(Math.round(event.currentTarget.currentTime * 1000))}
              />
            ) : (
              <img className="movie01-fallback-image" src="/metaon-assets/activity/movie01/figma-source/player-fallback-warm.png" alt="" />
            )}
            {usesScriptAudio ? (
              <audio
                ref={audioRef}
                src={scriptAudioUrl}
                crossOrigin="anonymous"
                preload="auto"
                onLoadedMetadata={(event) => setDurationMs(Math.round(event.currentTarget.duration * 1000) || 0)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={(event) => setCurrentMs(Math.round(event.currentTarget.currentTime * 1000))}
              />
            ) : null}
            {mode === "script" ? <img className="movie01-script-poster" src="/metaon-assets/activity/movie01/figma-source/player-fallback-warm.png" alt="" /> : null}
            <span aria-hidden="true" className="movie01-player-scrim" />
            <div className="movie01-controls" aria-label="Movie controls">
              <div className="movie01-control-menu">
                <button type="button" onClick={() => setShowModeMenu((value) => !value)}>
                  Mode <ChevronDown size={18} aria-hidden="true" />
                </button>
                {showModeMenu ? (
                  <div className="movie01-popover" role="menu">
                    <button className={mode === "movie" ? "is-selected" : ""} type="button" onClick={() => selectMode("movie")}>Movie</button>
                    <button className={mode === "script" ? "is-selected" : ""} type="button" onClick={() => selectMode("script")}>Script</button>
                    <button className={mode === "movie-script" ? "is-selected" : ""} type="button" onClick={() => selectMode("movie-script")}>Movie+Script</button>
                  </div>
                ) : null}
              </div>
              <div className="movie01-control-menu">
                <button type="button" onClick={() => setShowSpeedMenu((value) => !value)}>
                  {playbackRate.toFixed(1)}x <ChevronDown size={18} aria-hidden="true" />
                </button>
                {showSpeedMenu ? (
                  <div className="movie01-popover movie01-speed-popover" role="menu">
                    {[0.75, 1, 1.25].map((rate) => (
                      <button className={rate === playbackRate ? "is-selected" : ""} key={rate} type="button" onClick={() => { setPlaybackRate(rate); setShowSpeedMenu(false); }}>
                        {rate.toFixed(2).replace(/0$/, "")}x
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <button className="movie01-korean-toggle" type="button" aria-pressed={showKorean} onClick={() => setShowKorean((value) => !value)}>
                KOR {showKorean ? "ON" : "OFF"}
              </button>
            </div>
            {isScriptMode ? (
              <div className="movie01-script" aria-live="polite">
                {visibleCues.length > 0 ? visibleCues.map(({ cue, index }) => (
                  <div className={index === activeCueIndex ? "movie01-script-line is-active" : "movie01-script-line"} key={`${cue.startMs}:${cue.text}`}>
                    <p>{highlightMovieCue(cue, currentMs, index === activeCueIndex)}</p>
                    {showKorean && cue.translation ? <span>{cue.translation}</span> : null}
                  </div>
                )) : (
                  <div className="movie01-script-line is-active">
                    <p>{videoUrl ? "Script resource is not available for this movie." : "Movie resource is not cached yet."}</p>
                  </div>
                )}
              </div>
            ) : null}
            {hasPlayableMedia ? (
              <button className="movie01-play-toggle" type="button" onClick={togglePlayback} aria-label={isPlaying ? "Pause movie" : "Play movie"}>
                {isPlaying ? <Pause size={28} fill="currentColor" aria-hidden="true" /> : <Play size={28} fill="currentColor" aria-hidden="true" />}
              </button>
            ) : null}
          </>
        ) : (
          <>
            {videoUrl ? (
              <video
                key="movie01-mode-background"
                className="movie01-mode-video"
                ref={modeVideoRef}
                src={videoUrl}
                crossOrigin="anonymous"
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
              />
            ) : (
              <img className="movie01-mode-background" src="/metaon-assets/activity/movie01/figma-source/menu-background.png" alt="" />
            )}
            <span aria-hidden="true" className="movie01-mode-scrim" />
            <div className="movie01-mode-options" aria-label="Select learning mode">
              <MovieModeCard iconSrc="/metaon-assets/activity/movie01/figma-source/movie-icon.png" label="Movie" onClick={() => selectMode("movie")} />
              <MovieModeCard iconSrc="/metaon-assets/activity/movie01/figma-source/script-icon.png" label="Script" onClick={() => selectMode("script")} />
              <MovieModeCard iconSrc="/metaon-assets/activity/movie01/figma-source/moviescript-icon.png" label="Movie+Script" onClick={() => selectMode("movie-script")} />
            </div>
          </>
        )}
      </section>
    </ActivityFrame>
  );
}

function MovieModeCard({ iconSrc, label, onClick }: { iconSrc: string; label: string; onClick: () => void }) {
  return (
    <button className="movie01-mode-card" type="button" onClick={onClick}>
      <span className="movie01-mode-icon" aria-hidden="true">
        <img src={iconSrc} alt="" />
      </span>
      <strong>{label}</strong>
    </button>
  );
}

export function EbookActivity({ context }: { context: ActivityRendererContext }) {
  return <BookPageActivity context={context} />;
}

export function StoryCheckActivity({ context }: { context: ActivityRendererContext }) {
  const base = dayBase(context);
  const folder = paramFolder(context.activity);
  const quizInfoState = usePackageJsonState<QuizInfo>(context, `${base}/reading_1201/${folder}/info_read_quiz.json`);
  const quizInfo = quizInfoState.data;
  const pathState = usePackagePathListState(context, `${base}/reading_1201/${folder}/img/`);
  const paths = pathState.paths;
  const imagePaths = useMemo(() => paths.filter((path) => /\.png$/i.test(path)).sort(), [paths]);
  const imageUrlState = usePackageUrlsState(context, imagePaths);
  const imageUrls = imageUrlState.urls;
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number>();
  const visibleImageUrl = imageUrls[imagePaths[index]];
  const isVisibleImageDecoded = useDecodedImageUrls([visibleImageUrl]);
  const isResourceLoading = isCachedResourceLoading(context, quizInfoState, pathState, imageUrlState) || !isVisibleImageDecoded;
  const quiz = quizInfo?.quizs?.[index];
  const quizCount = quizInfo?.quizs?.length ?? 0;
  const rightAnswer = quiz?.right_num || 1;
  const result = selected == null ? "" : selected === rightAnswer ? "Correct" : "Try again";

  return (
    <ActivityFrame context={context} actionLabel="Story Check" loading={isResourceLoading}>
      <ActivityQuestionNavigation
        current={index}
        total={quizCount}
        onChange={(nextIndex) => {
          setSelected(undefined);
          setIndex(nextIndex);
        }}
      />
      <div className="package-viewer">
        <div className="package-stage">
          {imageUrls[imagePaths[index]] ? (
            <img className="package-page-image contain" src={imageUrls[imagePaths[index]]} alt={`Story check ${index + 1}`} />
          ) : (
            <ResourceMissing label="quiz image" />
          )}
        </div>
        <div className="activity-side-panel">
          <strong>{quiz?.question || "No quiz question"}</strong>
          <div className="answer-grid compact">
            <button className={selected === 1 ? "answer selected" : "answer"} type="button" onClick={() => setSelected(1)}>
              O / Yes
            </button>
            <button className={selected === 2 ? "answer selected" : "answer"} type="button" onClick={() => setSelected(2)}>
              X / No
            </button>
          </div>
          {result ? <p className={result === "Correct" ? "success-text" : "error-text"}>{result}</p> : null}
        </div>
      </div>
    </ActivityFrame>
  );
}

export function WordBoxActivity({ context }: { context: ActivityRendererContext }) {
  const wordResource = useWordsState(context);
  const words = wordResource.words;
  const isWordResourceLoading = wordResource.status === "loading";

  return (
    <ActivityFrame context={context} actionLabel="Words" loading={isWordResourceLoading}>
      <div className="asset-grid">
        {words.length > 0 ? (
          words.map((word) => <WordCard key={`${word.index}:${word.eng}`} word={word} />)
        ) : (
          <ResourceMissing label="word list" />
        )}
      </div>
    </ActivityFrame>
  );
}

export function FlashCardActivity({
  context,
  label = "Flash Card",
  prototypeData
}: {
  context: ActivityRendererContext;
  label?: string;
  prototypeData?: PrototypeActivityData;
}) {
  const wordResource = useWordsState(context);
  const loadedWords = wordResource.words;
  const words = prototypeData?.words ?? loadedWords;
  const isWordResourceLoading = !prototypeData && wordResource.status === "loading";
  const [index, setIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [showMoreInfo, setShowMoreInfo] = useState(false);
  const [videoUnavailable, setVideoUnavailable] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastAudioRequestAt = useRef(Number.NEGATIVE_INFINITY);
  const flipResetTimerRef = useRef<number | undefined>(undefined);
  const swipeStartRef = useRef<{ pointerId: number; x: number; y: number }>();
  const touchSwipeStartRef = useRef<{ identifier: number; x: number; y: number }>();
  const ignoredClickAfterSwipeRef = useRef(false);
  const word = words[index];
  const cardViewKeyRef = useRef("");
  const flipCountRef = useRef(0);
  const activityCode = normalizeActivityCode(context.activity?.activityCode);
  const usesVideoBackground = activityCode === MetaOnActivityCode.VideoWordCard;
  const wdca02VideoPaths = usePackagePathList(context, `${dayBase(context)}/wdca02/video/`);
  const dayVideoPaths = usePackagePathList(context, `${dayBase(context)}/video/`);
  const wdca02VideoPath = useMemo(
    () => [...wdca02VideoPaths, ...dayVideoPaths].find((path) => /\.(?:mp4|webm|m4v|mov)$/i.test(path)),
    [wdca02VideoPaths, dayVideoPaths]
  );
  const wdca02VideoUrl = usePackageUrl(context, wdca02VideoPath);
  const usesWdcaDesign =
    activityCode === MetaOnActivityCode.WordCard ||
    usesVideoBackground ||
    context.activity?.actType === ActType.FlashCardSpace;

  useEffect(() => {
    clearFlipResetTimer();
    setShowBack(false);
    flipCountRef.current = 0;
    if (index >= words.length) setIndex(0);
  }, [index, words.length]);

  useEffect(() => {
    setVideoUnavailable(false);
  }, [wdca02VideoUrl]);

  useEffect(() => {
    return () => {
      clearFlipResetTimer();
      audioRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    if (!word) return;
    const key = `${wordItemIdx(word)}:${word.eng}:${index}`;
    if (cardViewKeyRef.current === key) return;
    cardViewKeyRef.current = key;
    recordLearnEvent(context, {
      action: "card_view",
      item_type: "word",
      item_idx: wordItemIdx(word),
      extra: {
        word: word.eng,
        index,
        image_path: word.imagePath,
        audio_path: word.audioPath
      }
    });
  }, [context, index, word]);

  function playWordAudio() {
    const audio = audioRef.current;
    if (!audio || !word) return;

    const now = Date.now();
    if (now - lastAudioRequestAt.current < 120) return;
    lastAudioRequestAt.current = now;

    audio.pause();
    audio.currentTime = 0;
    audio.play().catch(() => undefined);
    recordLearnEvent(context, {
      action: "audio_play",
      item_type: "word",
      item_idx: wordItemIdx(word),
      audio_replays: 1,
      extra: {
        word: word.eng,
        index,
        audio_path: word.audioPath
      }
    });
  }

  function flipCard() {
    if (!word) return;
    clearFlipResetTimer();
    const fromSide = showBack ? "word" : "image";
    flipCountRef.current += 1;
    setShowBack(true);
    recordLearnEvent(context, {
      action: "card_flip",
      item_type: "word",
      item_idx: wordItemIdx(word),
      extra: {
        word: word.eng,
        index,
        from_side: fromSide,
        to_side: "word",
        flip_count: flipCountRef.current,
        auto_return_ms: 2000
      }
    });
    flipResetTimerRef.current = window.setTimeout(() => {
      setShowBack(false);
      flipResetTimerRef.current = undefined;
    }, 2000);
  }

  function toggleMoreInfo() {
    const nextValue = !showMoreInfo;
    setShowMoreInfo(nextValue);
    recordLearnEvent(context, {
      action: "more_info_toggle",
      item_type: "word",
      item_idx: wordItemIdx(word),
      extra: {
        word: word?.eng,
        index,
        enabled: nextValue
      }
    });
  }

  function moveCard(direction: -1 | 1) {
    if (words.length < 2) return;
    clearFlipResetTimer();
    setShowBack(false);
    setIndex((current) => (current + direction + words.length) % words.length);
  }

  function clearFlipResetTimer() {
    if (flipResetTimerRef.current === undefined) return;
    window.clearTimeout(flipResetTimerRef.current);
    flipResetTimerRef.current = undefined;
  }

  function handleCardPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.pointerType === "touch") return;
    ignoredClickAfterSwipeRef.current = false;
    swipeStartRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is unavailable in some embedded WebViews. The gesture
      // still works while the pointer remains inside the card.
    }
  }

  function handleCardPointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.pointerType === "touch") return;
    const start = swipeStartRef.current;
    swipeStartRef.current = undefined;
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Ignore browsers that do not expose pointer capture state.
    }
    if (!start || start.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) <= Math.abs(deltaY)) return;

    ignoredClickAfterSwipeRef.current = true;
    moveCard(deltaX < 0 ? 1 : -1);
  }

  function cancelCardSwipe() {
    swipeStartRef.current = undefined;
  }

  function handleCardTouchStart(event: ReactTouchEvent<HTMLButtonElement>) {
    const touch = event.changedTouches[0];
    if (!touch) return;
    ignoredClickAfterSwipeRef.current = false;
    touchSwipeStartRef.current = { identifier: touch.identifier, x: touch.clientX, y: touch.clientY };
  }

  function handleCardTouchEnd(event: ReactTouchEvent<HTMLButtonElement>) {
    const start = touchSwipeStartRef.current;
    touchSwipeStartRef.current = undefined;
    if (!start) return;
    const touch = Array.from(event.changedTouches).find((item) => item.identifier === start.identifier);
    if (!touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) <= Math.abs(deltaY)) return;

    event.preventDefault();
    ignoredClickAfterSwipeRef.current = true;
    moveCard(deltaX < 0 ? 1 : -1);
  }

  function cancelCardTouchSwipe() {
    touchSwipeStartRef.current = undefined;
  }

  function handleCardClick() {
    if (ignoredClickAfterSwipeRef.current) {
      ignoredClickAfterSwipeRef.current = false;
      return;
    }
    playWordAudio();
    flipCard();
  }

  if (usesWdcaDesign) {
    return (
      <ActivityFrame context={context} actionLabel={label} loading={isWordResourceLoading} className="wdca-flashcard-frame">
        <div className={usesVideoBackground ? `wdca-flashcard-shell wdca02-video-flashcard-shell${videoUnavailable ? " is-video-background-unavailable" : ""}` : "wdca-flashcard-shell"}>
          {usesVideoBackground ? (
            <>
              <VideoActivityBackground className="wdca02-background-video" onUnavailable={() => setVideoUnavailable(true)} url={wdca02VideoUrl} />
              <span aria-hidden="true" className="wdca02-background-scrim" />
            </>
          ) : null}
          <button
            aria-checked={showMoreInfo}
            aria-label="More info"
            className={showMoreInfo ? "wdca-more-info-toggle is-on" : "wdca-more-info-toggle"}
            onClick={toggleMoreInfo}
            role="switch"
            type="button"
          >
            {usesVideoBackground ? (
              <img
                aria-hidden="true"
                draggable={false}
                src={showMoreInfo ? videoActivityControlAssets.moreInfoOn : videoActivityControlAssets.moreInfoOff}
                alt=""
              />
            ) : (
              <>
                <span>MORE INFO</span>
                <span aria-hidden="true" className="wdca-toggle-track">
                  <span className="wdca-toggle-knob" />
                </span>
              </>
            )}
          </button>

          {usesVideoBackground ? (
            <VideoActivityProgress currentIndex={index} total={words.length} />
          ) : (
            <div aria-live="polite" className="wdca-card-count">
              <strong>{words.length === 0 ? 0 : index + 1}</strong>
              <span>/</span>
              <span>{words.length}</span>
            </div>
          )}

          <button
            aria-label="Previous word card"
            className="wdca-card-arrow wdca-card-arrow-prev image-page-control"
            disabled={words.length < 2}
            onClick={() => moveCard(-1)}
            type="button"
          >
            {usesVideoBackground ? <VideoActivityPageArrow direction="prev" /> : <ActivityPageArrowImage direction="prev" />}
          </button>

          <button
            aria-label={showBack ? `Show image for ${word?.eng || "word"}` : `Flip word card ${word?.eng || ""}`}
            className={showBack ? "flashcard-display wdca-flashcard-display flipped" : "flashcard-display wdca-flashcard-display"}
            disabled={!word}
            onClick={handleCardClick}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") playWordAudio();
            }}
            onPointerCancel={cancelCardSwipe}
            onPointerDown={handleCardPointerDown}
            onPointerUp={handleCardPointerUp}
            onTouchCancel={cancelCardTouchSwipe}
            onTouchEnd={handleCardTouchEnd}
            onTouchStart={handleCardTouchStart}
            type="button"
          >
            <span className="flashcard-face flashcard-front wdca-flashcard-face wdca-flashcard-front">
              {word?.imageUrl ? <img src={word.imageUrl} alt={word.eng} /> : <ResourceMissing label="word image" />}
            </span>
            <span className="flashcard-face flashcard-back wdca-flashcard-face wdca-flashcard-back">
              <span className={showMoreInfo ? "wdca-card-copy has-more-info" : "wdca-card-copy"}>
                <AutoFitFlashCardWord compact={showMoreInfo} text={word?.eng || (isWordResourceLoading ? "" : "No word")} />
                {showMoreInfo ? (
                  <span className="wdca-card-more-info">
                    {word?.mean ? <strong className="wdca-card-meaning">{word.mean}</strong> : null}
                    {word?.sentence ? <AutoAlignedFlashCardExample text={word.sentence} /> : null}
                  </span>
                ) : null}
              </span>
            </span>
          </button>

          <button
            aria-label="Next word card"
            className="wdca-card-arrow wdca-card-arrow-next image-page-control"
            disabled={words.length < 2}
            onClick={() => moveCard(1)}
            type="button"
          >
            {usesVideoBackground ? <VideoActivityPageArrow direction="next" /> : <ActivityPageArrowImage direction="next" />}
          </button>

          {word?.audioUrl ? <audio ref={audioRef} src={word.audioUrl} preload="auto" /> : null}
        </div>
      </ActivityFrame>
    );
  }

  return (
    <ActivityFrame context={context} actionLabel={label} loading={isWordResourceLoading}>
      <div className="flashcard-shell">
        <button
          aria-label={showBack ? `Word card ${word?.eng || ""}` : `Flip word card ${word?.eng || ""}`}
          className={showBack ? "flashcard-display flipped" : "flashcard-display"}
          disabled={!word}
          onClick={handleCardClick}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              playWordAudio();
            }
          }}
          onPointerCancel={cancelCardSwipe}
          onPointerDown={handleCardPointerDown}
          onPointerUp={handleCardPointerUp}
          onTouchCancel={cancelCardTouchSwipe}
          onTouchEnd={handleCardTouchEnd}
          onTouchStart={handleCardTouchStart}
          type="button"
        >
          <span className="flashcard-face flashcard-front">
            {word?.imageUrl ? <img src={word.imageUrl} alt={word.eng} /> : <ResourceMissing label="word image" />}
          </span>
          <span className="flashcard-face flashcard-back">
            <strong>{word?.eng || (isWordResourceLoading ? "" : "No word")}</strong>
          </span>
        </button>
        {word?.audioUrl ? <audio ref={audioRef} src={word.audioUrl} preload="auto" /> : null}
        <div className="inline-actions">
          <button
            className="activity-question-edge-nav previous image-page-control"
            aria-label="Previous word card"
            type="button"
            onClick={() => {
              setShowBack(false);
              setIndex((value) => Math.max(0, value - 1));
            }}
            disabled={index === 0}
          >
            <ActivityPageArrowImage direction="prev" />
          </button>
          <span>
            {words.length === 0 ? 0 : index + 1} / {words.length}
          </span>
          <button
            className="activity-question-edge-nav next image-page-control"
            aria-label="Next word card"
            type="button"
            onClick={() => {
              setShowBack(false);
              setIndex((value) => Math.min(words.length - 1, value + 1));
            }}
            disabled={words.length === 0 || index >= words.length - 1}
          >
            <ActivityPageArrowImage direction="next" />
          </button>
        </div>
      </div>
    </ActivityFrame>
  );
}

function VideoActivityBackground({
  className,
  onUnavailable,
  url
}: {
  className: string;
  onUnavailable: () => void;
  url?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const startPlayback = (video: HTMLVideoElement | null) => {
    if (!video) return;
    video.muted = true;
    video.defaultMuted = true;
    try {
      void video.play().catch(() => undefined);
    } catch {
      // Autoplay can still require a gesture in embedded WebViews. The one-shot
      // pointer listener below retries without showing the static fallback.
    }
  };

  useEffect(() => {
    if (!url) return;
    const retryOnFirstGesture = () => startPlayback(videoRef.current);
    window.addEventListener("pointerdown", retryOnFirstGesture, { capture: true, once: true });
    return () => window.removeEventListener("pointerdown", retryOnFirstGesture, { capture: true });
  }, [url]);

  if (!url) return null;

  return (
    <video
      aria-hidden="true"
      autoPlay
      className={className}
      crossOrigin="anonymous"
      loop
      muted
      onCanPlay={(event) => startPlayback(event.currentTarget)}
      onError={onUnavailable}
      playsInline
      preload="auto"
      ref={videoRef}
      src={url}
    />
  );
}

function VideoActivityProgress({ currentIndex, total }: { currentIndex: number; total: number }) {
  return <VideoActivityPageIndicator current={currentIndex + 1} total={total} />;
}

function calculateSingleLineFontSize(element: HTMLElement, maximumSize: number, minimumSize: number): number {
  const availableWidth = element.clientWidth;
  const effectiveMinimumSize = Math.min(maximumSize, minimumSize);
  element.style.fontSize = `${maximumSize}px`;

  if (availableWidth <= 0 || element.scrollWidth <= availableWidth + 0.5) return maximumSize;

  let lower = effectiveMinimumSize;
  let upper = maximumSize;
  for (let iteration = 0; iteration < 10; iteration += 1) {
    const candidate = (lower + upper) / 2;
    element.style.fontSize = `${candidate}px`;
    if (element.scrollWidth <= availableWidth + 0.5) {
      lower = candidate;
    } else {
      upper = candidate;
    }
  }

  return Math.max(effectiveMinimumSize, Math.floor(lower * 10) / 10);
}

function AutoFitSingleLineText({
  className,
  maximumSize,
  minimumSize,
  observedSelectors,
  text
}: {
  className: string;
  maximumSize: number;
  minimumSize: number;
  observedSelectors: string;
  text: string;
}) {
  const textRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const element = textRef.current;
    if (!element) return undefined;

    let active = true;
    let animationFrame = 0;
    const fitText = () => {
      if (!active) return;
      element.style.fontSize = `${calculateSingleLineFontSize(element, maximumSize, minimumSize)}px`;
    };

    const scheduleFit = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(fitText);
    };

    fitText();
    scheduleFit();
    const resizeObserver = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(scheduleFit);
    const observedElements = observedSelectors
      .split(",")
      .map((selector) => element.closest<HTMLElement>(selector.trim()))
      .filter((candidate, index, candidates): candidate is HTMLElement => Boolean(candidate) && candidates.indexOf(candidate) === index);
    observedElements.forEach((candidate) => resizeObserver?.observe(candidate));
    window.addEventListener("resize", scheduleFit);
    void document.fonts?.ready.then(scheduleFit);

    return () => {
      active = false;
      window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleFit);
    };
  }, [maximumSize, minimumSize, observedSelectors, text]);

  return (
    <strong className={className} data-fit-single-line="true" ref={textRef}>
      {text}
    </strong>
  );
}

function UniformAutoFitText({ className = "", text }: { className?: string; text: string }) {
  return (
    <strong
      className={`uniform-choice-text${className ? ` ${className}` : ""}`}
      data-fit-single-line="true"
      data-uniform-fit-text="true"
    >
      {text}
    </strong>
  );
}

function UniformAutoFitTextGroup({
  children,
  className,
  maximumSize,
  minimumSize,
  style
}: {
  children: ReactNode;
  className: string;
  maximumSize: number;
  minimumSize: number;
  style?: CSSProperties;
}) {
  const groupRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return undefined;

    let active = true;
    let animationFrame = 0;
    const resizeObserver = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(() => scheduleFit());

    const fitTextGroup = () => {
      if (!active) return;
      const textElements = Array.from(group.querySelectorAll<HTMLElement>("[data-uniform-fit-text='true']"));
      if (textElements.length === 0) {
        delete group.dataset.uniformFitSize;
        return;
      }

      const fittedSizes = textElements.map((element) => calculateSingleLineFontSize(element, maximumSize, minimumSize));
      const sharedSize = Math.min(...fittedSizes);
      textElements.forEach((element) => {
        element.style.fontSize = `${sharedSize}px`;
        if (element.parentElement) resizeObserver?.observe(element.parentElement);
      });
      group.dataset.uniformFitSize = String(sharedSize);
    };

    function scheduleFit() {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(fitTextGroup);
    }

    fitTextGroup();
    scheduleFit();
    resizeObserver?.observe(group);
    const mutationObserver = typeof MutationObserver === "undefined"
      ? undefined
      : new MutationObserver(scheduleFit);
    mutationObserver?.observe(group, { childList: true, characterData: true, subtree: true });
    window.addEventListener("resize", scheduleFit);
    void document.fonts?.ready.then(scheduleFit);

    return () => {
      active = false;
      window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      window.removeEventListener("resize", scheduleFit);
    };
  }, [maximumSize, minimumSize]);

  return (
    <div className={className} data-uniform-fit-group="true" ref={groupRef} style={style}>
      {children}
    </div>
  );
}

function AutoFitFlashCardWord({ compact, text }: { compact: boolean; text: string }) {
  return (
    <AutoFitSingleLineText
      className="wdca-card-word"
      maximumSize={compact ? 80 : 100}
      minimumSize={14}
      observedSelectors=".wdca-flashcard-display,.wdca-flashcard-shell"
      text={text}
    />
  );
}

function AutoFitVocaQuizText({ text, variant }: { text: string; variant: "prompt" | "option" }) {
  if (variant === "option") {
    return <UniformAutoFitText className="voca-quiz-fit-text is-option" text={text} />;
  }

  return (
    <AutoFitSingleLineText
      className="voca-quiz-fit-text is-prompt"
      maximumSize={64}
      minimumSize={8}
      observedSelectors=".voca-quiz-option,.voca-quiz-prompt,.voca-quiz-options,.voca-quiz-renewal-shell"
      text={text}
    />
  );
}

function useVocaQuizSpellingWordStyle(letterCount: number): {
  ref: RefObject<HTMLDivElement>;
  style: CSSProperties;
} {
  const ref = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(40);

  useLayoutEffect(() => {
    const word = ref.current;
    const container = word?.parentElement;
    if (!container) return undefined;

    let animationFrame = 0;
    const updateSize = () => {
      const availableWidth = container.clientWidth * 0.94;
      if (availableWidth <= 0) return;
      const count = Math.max(1, letterCount);
      // The Figma design uses 40px letters, 16px gaps, and a 48px blank slot.
      const widthInLetterUnits = count * 0.66 + 0.54 + Math.max(0, count - 1) * 0.4;
      const nextSize = Math.max(14, Math.min(40, Math.floor(availableWidth / widthInLetterUnits)));
      setFontSize((current) => (current === nextSize ? current : nextSize));
    };
    const scheduleUpdate = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(updateSize);
    };

    updateSize();
    const resizeObserver = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(scheduleUpdate);
    resizeObserver?.observe(container);
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [letterCount]);

  return {
    ref,
    style: {
      "--voca-quiz-spelling-font-size": `${fontSize}px`,
      "--voca-quiz-spelling-gap": `${Math.max(5, Math.round(fontSize * 0.4))}px`,
      "--voca-quiz-spelling-blank-size": `${Math.max(20, Math.round(fontSize * 1.2))}px`
    } as CSSProperties
  };
}

function AutoFitSentenceBlankOption({ text }: { text: string }) {
  return <UniformAutoFitText className="sentence-blank-option-text" text={text} />;
}

function AutoAlignedFlashCardExample({ text }: { text: string }) {
  const textRef = useRef<HTMLSpanElement>(null);
  const [isMultiline, setIsMultiline] = useState(false);

  useLayoutEffect(() => {
    const element = textRef.current;
    if (!element) return undefined;

    let active = true;
    let animationFrame = 0;
    const updateAlignment = () => {
      if (!active) return;
      const computed = window.getComputedStyle(element);
      const fontSize = Number.parseFloat(computed.fontSize) || 16;
      const lineHeight = Number.parseFloat(computed.lineHeight) || fontSize * 1.2;
      const nextIsMultiline = element.scrollHeight > lineHeight * 1.4;
      setIsMultiline((current) => (current === nextIsMultiline ? current : nextIsMultiline));
    };

    const scheduleAlignment = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(updateAlignment);
    };

    updateAlignment();
    scheduleAlignment();
    const resizeObserver = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(scheduleAlignment);
    const observedElements = [
      element.closest<HTMLElement>(".wdca-flashcard-display"),
      element.closest<HTMLElement>(".wdca-flashcard-shell")
    ].filter((candidate, index, candidates): candidate is HTMLElement => Boolean(candidate) && candidates.indexOf(candidate) === index);
    observedElements.forEach((candidate) => resizeObserver?.observe(candidate));
    window.addEventListener("resize", scheduleAlignment);
    void document.fonts?.ready.then(scheduleAlignment);

    return () => {
      active = false;
      window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleAlignment);
    };
  }, [text]);

  return (
    <span className={`wdca-card-example${isMultiline ? " is-multiline" : ""}`} ref={textRef}>
      {text}
    </span>
  );
}

export function WordChoiceActivity({
  context,
  label = "Word Check",
  promptMode = "image"
}: {
  context: ActivityRendererContext;
  label?: string;
  promptMode?: "image" | "audio";
}) {
  const wordResource = useWordsState(context);
  const words = wordResource.words;
  const isWordResourceLoading = wordResource.status === "loading";
  const [shuffleSeed] = useState(createShuffleSeed);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<string>();
  const target = words[current];
  const wordsSignature = buildWordsSignature(words);
  const answers = useMemo(
    () => buildWordOptions(words, current, mixSeed(shuffleSeed, `${wordsSignature}:${current}`)),
    [current, shuffleSeed, words, wordsSignature]
  );
  const result = selected == null ? "" : selected === target?.eng ? "Correct" : `Answer: ${target?.eng}`;

  useEffect(() => {
    setSelected(undefined);
    if (current >= words.length) setCurrent(0);
  }, [current, words.length]);

  return (
    <ActivityFrame context={context} actionLabel={label} loading={isWordResourceLoading}>
      <ActivityQuestionNavigation current={current} total={words.length} onChange={setCurrent} />
      <div className="quiz-shell package-quiz word-choice-shell">
        <div className="quiz-media">
          {promptMode === "image" ? (
            target?.imageUrl ? (
              <img src={target.imageUrl} alt={target.eng} />
            ) : (
              <ResourceMissing label="word image" />
            )
          ) : (
            <div className="sound-prompt">
              <Volume2 size={42} />
              <strong>Listen</strong>
              <span>{target?.wordClass || label}</span>
            </div>
          )}
          {target?.audioUrl ? <audio src={target.audioUrl} controls /> : null}
        </div>
        <div className="word-choice-main">
          <div className="answer-grid">
            {answers.map((answer) => (
              <button
                className={selected === answer.eng ? "answer selected" : "answer"}
                key={`${answer.index}:${answer.eng}`}
                onClick={() => setSelected(answer.eng)}
                type="button"
              >
                {answer.eng}
              </button>
            ))}
          </div>
          {result ? <p className={selected === target?.eng ? "success-text" : "error-text"}>{result}</p> : null}
          {target?.mean ? <p className="muted">{selected === target.eng ? target.mean : "Choose the matching word."}</p> : null}
        </div>
      </div>
    </ActivityFrame>
  );
}

export function WordBlankActivity({
  context,
  label = "Word Blank",
  prototypeData
}: {
  context: ActivityRendererContext;
  label?: string;
  prototypeData?: PrototypeActivityData;
}) {
  const wordResource = useWordsState(context);
  const loadedWords = wordResource.words;
  const words = prototypeData?.words ?? loadedWords;
  const isWordResourceLoading = !prototypeData && wordResource.status === "loading";
  const [shuffleSeed] = useState(createShuffleSeed);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<string>();
  const [videoUnavailable, setVideoUnavailable] = useState(false);
  const feedbackTimerRef = useRef<number | undefined>(undefined);
  const activityCode = normalizeActivityCode(context.activity?.activityCode);
  const usesVideoBackground = activityCode === MetaOnActivityCode.VideoWordBlank;
  const wdbl02VideoPaths = usePackagePathList(context, `${dayBase(context)}/wdbl02/video/`);
  const dayVideoPaths = usePackagePathList(context, `${dayBase(context)}/video/`);
  const wdbl02VideoPath = useMemo(
    () => [...wdbl02VideoPaths, ...dayVideoPaths].find((path) => /\.(?:mp4|webm|m4v|mov)$/i.test(path)),
    [wdbl02VideoPaths, dayVideoPaths]
  );
  const wdbl02VideoUrl = usePackageUrl(context, wdbl02VideoPath);
  const target = words[current];
  const targetKey = target ? wordOptionKey(target) : "";
  const question = useMemo(
    () => buildWordBlankQuestion(target, mixSeed(shuffleSeed, `${targetKey}:${current}`)),
    [current, shuffleSeed, target, targetKey]
  );
  const isCorrect = selected != null && normalizeToken(selected) === normalizeToken(question.answer);
  const wordPrefix = question.blankIndex >= 0 ? question.letters.slice(0, question.blankIndex).join("") : "";
  const wordSuffix = question.blankIndex >= 0 ? question.letters.slice(question.blankIndex + 1).join("") : "";
  const videoWordUnits = Math.max(1, question.letters.length + Math.max(0, question.letters.length - 1) * 0.112);
  const videoWordFontSize = Math.max(20, Math.min(40, Math.floor(416 / videoWordUnits)));
  const videoWordStyle = usesVideoBackground
    ? ({ "--wdbl02-word-font-size": `${videoWordFontSize}px` } as CSSProperties)
    : undefined;
  const questionViewKeyRef = useRef("");

  useEffect(() => {
    if (feedbackTimerRef.current !== undefined) window.clearTimeout(feedbackTimerRef.current);
    setSelected(undefined);
    if (current >= words.length) setCurrent(0);
  }, [current, words.length]);

  useEffect(
    () => () => {
      if (feedbackTimerRef.current !== undefined) window.clearTimeout(feedbackTimerRef.current);
    },
    []
  );

  useEffect(() => {
    setVideoUnavailable(false);
  }, [wdbl02VideoUrl]);

  useEffect(() => {
    if (!target || !question.answer) return;
    const viewKey = `${wordItemIdx(target) ?? target.index}:${current}:${question.blankIndex}:${question.options.join("|")}`;
    if (questionViewKeyRef.current === viewKey) return;
    questionViewKeyRef.current = viewKey;
    recordLearnEvent(context, {
      action: "question_view",
      item_type: "word",
      item_idx: wordItemIdx(target),
      chunk_index: question.blankIndex >= 0 ? question.blankIndex : undefined,
      extra: {
        blank_indexes: question.blankIndex >= 0 ? [question.blankIndex] : [],
        blank_pattern: question.letters.map((letter, index) => (index === question.blankIndex ? "_" : letter)).join(""),
        option_order: question.options
      }
    });
  }, [current, question, target]);

  function chooseLetter(option: string) {
    if (!target) return;
    const correct = normalizeToken(option) === normalizeToken(question.answer);
    setSelected(option);
    recordLearnEvent(context, {
      action: "letter_select",
      item_type: "word",
      item_idx: wordItemIdx(target),
      chunk_index: question.blankIndex >= 0 ? question.blankIndex : undefined,
      extra: {
        selected_letter: option,
        blank_index: question.blankIndex
      }
    });
    recordLearnEvent(context, {
      action: "submit",
      item_type: "word",
      item_idx: wordItemIdx(target),
      chunk_index: question.blankIndex >= 0 ? question.blankIndex : undefined,
      correct: boolCorrect(correct),
      attempts: 1,
      extra: {
        answer: question.answer,
        selected: option,
        blank_indexes: question.blankIndex >= 0 ? [question.blankIndex] : [],
        option_order: question.options
      }
    });

    if (feedbackTimerRef.current !== undefined) window.clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = window.setTimeout(() => {
      if (correct && current < words.length - 1) {
        setCurrent((value) => Math.min(words.length - 1, value + 1));
      } else if (!correct) {
        setSelected(undefined);
      }
    }, correct ? 850 : 700);
  }

  return (
    <ActivityFrame context={context} actionLabel={label} loading={isWordResourceLoading} className="figma-renewal-frame">
      <div className={`figma-renewal-shell word-blank-renewal-shell${usesVideoBackground ? ` wdbl02-video-word-blank-shell${videoUnavailable ? " is-video-background-unavailable" : ""}` : ""}`}>
        {usesVideoBackground ? (
          <>
            <VideoActivityBackground className="wdbl02-background-video" onUnavailable={() => setVideoUnavailable(true)} url={wdbl02VideoUrl} />
            <span aria-hidden="true" className="wdbl02-background-scrim" />
          </>
        ) : null}
        {usesVideoBackground ? (
          <VideoActivityProgress currentIndex={current} total={words.length} />
        ) : (
          <RenewalCounter current={words.length === 0 ? 0 : current + 1} total={words.length} className="word-blank-counter" />
        )}
        <ActivityQuestionNavigation current={current} total={words.length} onChange={setCurrent} variant={usesVideoBackground ? "video" : "standard"} />
        <div className="word-blank-renewal-content">
          <div className="word-blank-renewal-media">
            {target?.imageUrl ? <img src={target.imageUrl} alt={target.eng} /> : <ResourceMissing label="word image" />}
            <RenewalSoundButton
              src={target?.audioUrl}
              label={`Play ${target?.eng || "word"}`}
              className="word-blank-sound-button"
              icon={usesVideoBackground ? "sound" : "listening"}
              onPlay={() =>
                recordLearnEvent(context, {
                  action: "audio_play",
                  item_type: "word",
                  item_idx: wordItemIdx(target),
                  audio_replays: 1,
                  extra: { word: target?.eng, question_index: current + 1 }
                })
              }
            />
          </div>
          <div className="word-blank-renewal-question">
            <div className="word-blank-renewal-word" aria-label={target?.eng ? `Word blank for ${target.eng}` : "Word blank"} style={videoWordStyle}>
              {usesVideoBackground ? (
                question.letters.map((letter, index) => {
                  const isBlank = index === question.blankIndex;
                  return (
                    <span
                      className={
                        isBlank
                          ? selected
                            ? isCorrect
                              ? "renewal-blank is-correct"
                              : "renewal-blank is-wrong"
                            : "renewal-blank"
                          : "word-blank-letter"
                      }
                      key={`${letter}:${index}`}
                    >
                      {isBlank ? selected || "" : letter}
                    </span>
                  );
                })
              ) : (
                <>
                  <span>{wordPrefix}</span>
                  <span className={selected ? (isCorrect ? "renewal-blank is-correct" : "renewal-blank is-wrong") : "renewal-blank"}>
                    {selected || ""}
                  </span>
                  <span>{wordSuffix}</span>
                </>
              )}
            </div>
            <UniformAutoFitTextGroup className="word-blank-renewal-options" maximumSize={40} minimumSize={8}>
              {question.options.map((option) => (
                <button
                  className={[
                    "renewal-option-button",
                    selected === option ? "is-selected" : "",
                    selected === option && isCorrect ? "is-correct" : "",
                    selected === option && !isCorrect ? "is-wrong" : ""
                  ].filter(Boolean).join(" ")}
                  disabled={!question.answer || selected !== undefined}
                  key={option}
                  onClick={() => chooseLetter(option)}
                  type="button"
                >
                  <UniformAutoFitText className="word-blank-option-text" text={option} />
                </button>
              ))}
            </UniformAutoFitTextGroup>
            {selected ? (
              <p className={isCorrect ? "renewal-feedback is-correct" : "renewal-feedback is-wrong"} role="status">
                {isCorrect ? "Correct" : `Answer: ${question.answer}`}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </ActivityFrame>
  );
}

export function MatchingGameActivity({
  context,
  label = "Matching Game",
  prototypeData
}: {
  context: ActivityRendererContext;
  label?: string;
  prototypeData?: PrototypeActivityData;
}) {
  const wordResource = useWordsState(context);
  const loadedWords = wordResource.words;
  const words = prototypeData?.words ?? loadedWords;
  const isWordResourceLoading = !prototypeData && wordResource.status === "loading";
  const [shuffleSeed] = useState(createShuffleSeed);
  const [restartNonce, setRestartNonce] = useState(0);
  const gameWords = words.slice(0, 5);
  const wordsSignature = buildWordsSignature(gameWords);
  const wordOptions = useMemo(
    () => shuffleAvoidingSameOrder(gameWords, mixSeed(shuffleSeed, `${wordsSignature}:${restartNonce}`), wordOptionKey),
    [gameWords, restartNonce, shuffleSeed, wordsSignature]
  );
  const [selectedImage, setSelectedImage] = useState<number>();
  const [selectedWord, setSelectedWord] = useState<number>();
  const [matched, setMatched] = useState<Set<number>>(() => new Set());
  const [message, setMessage] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(60);
  const mismatchTimerRef = useRef<number | undefined>(undefined);
  const boardViewKeyRef = useRef("");
  const isTimedOut = secondsLeft <= 0 && matched.size < gameWords.length;

  useEffect(() => {
    if (mismatchTimerRef.current !== undefined) window.clearTimeout(mismatchTimerRef.current);
    setSelectedImage(undefined);
    setSelectedWord(undefined);
    setMatched(new Set());
    setMessage("");
    setSecondsLeft(60);
  }, [restartNonce, wordsSignature]);

  useEffect(
    () => () => {
      if (mismatchTimerRef.current !== undefined) window.clearTimeout(mismatchTimerRef.current);
    },
    []
  );

  useEffect(() => {
    if (gameWords.length === 0 || matched.size >= gameWords.length || secondsLeft <= 0) return undefined;
    const timer = window.setTimeout(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [gameWords.length, matched.size, secondsLeft]);

  useEffect(() => {
    if (gameWords.length === 0) return;
    const boardKey = `${wordsSignature}:${wordOptions.map(wordOptionKey).join("|")}`;
    if (boardViewKeyRef.current === boardKey) return;
    boardViewKeyRef.current = boardKey;
    recordLearnEvent(context, {
      action: "board_view",
      item_type: "activity",
      item_idx: context.activity?.actIdx ?? null,
      extra: {
        left_order: wordOptionOrder(gameWords),
        right_order: wordOptionOrder(wordOptions)
      }
    });
  }, [gameWords, wordOptions, wordsSignature]);

  function tryMatch(nextImage?: number, nextWord?: number) {
    if (nextImage == null || nextWord == null || isTimedOut) return;

    const imageWord = gameWords.find((word) => word.index === nextImage);
    const selectedWordRecord = gameWords.find((word) => word.index === nextWord);
    const correct = nextImage === nextWord;
    recordLearnEvent(context, {
      action: "pair_submit",
      item_type: "pair",
      item_idx: wordItemIdx(imageWord),
      correct: boolCorrect(correct),
      attempts: 1,
      extra: {
        selected_word_idx: wordItemIdx(selectedWordRecord),
        target_word_idx: wordItemIdx(imageWord)
      }
    });

    if (nextImage === nextWord) {
      setMatched((current) => new Set(current).add(nextImage));
      setMessage("Correct");
      setSelectedImage(undefined);
      setSelectedWord(undefined);
      recordLearnEvent(context, {
        action: "pair_match",
        item_type: "word",
        item_idx: wordItemIdx(imageWord),
        correct: 1,
        extra: {
          attempts_for_pair: 1
        }
      });
      return;
    }

    setMessage("Try again");
    if (mismatchTimerRef.current !== undefined) window.clearTimeout(mismatchTimerRef.current);
    mismatchTimerRef.current = window.setTimeout(() => {
      setSelectedImage(undefined);
      setSelectedWord(undefined);
      setMessage("");
    }, 650);
  }

  return (
    <ActivityFrame context={context} actionLabel={label} loading={isWordResourceLoading} className="figma-renewal-frame">
      <div className="figma-renewal-shell matching-renewal-shell">
        <div className="matching-renewal-score" aria-label={`${matched.size} matched pairs`}>
          <Star aria-hidden="true" />
          <strong>{matched.size}</strong>
        </div>
        <ActivityTimerBadge
          seconds={secondsLeft}
          className={isTimedOut ? "matching-renewal-timer is-expired" : "matching-renewal-timer"}
          visualStyle="framed"
        />
        {gameWords.length > 0 ? (
          <>
            <UniformAutoFitTextGroup className="matching-renewal-board" maximumSize={32} minimumSize={7}>
              <div className="matching-renewal-column">
              {gameWords.map((word) => (
                <button
                  className={[
                    "matching-renewal-card",
                    selectedImage === word.index ? "selected" : "",
                    matched.has(word.index) ? "matched" : ""
                  ].filter(Boolean).join(" ")}
                  disabled={matched.has(word.index) || isTimedOut}
                  key={`word:${word.index}:${word.eng}`}
                  onClick={() => {
                    setSelectedImage(word.index);
                    tryMatch(word.index, selectedWord);
                  }}
                  type="button"
                >
                  <UniformAutoFitText className="matching-renewal-card-text" text={word.eng} />
                </button>
              ))}
              </div>
              <div className="matching-renewal-column">
              {wordOptions.map((word) => (
                <button
                  className={[
                    "matching-renewal-card",
                    selectedWord === word.index ? "selected" : "",
                    matched.has(word.index) ? "matched" : ""
                  ].filter(Boolean).join(" ")}
                  disabled={matched.has(word.index) || isTimedOut}
                  key={`meaning:${word.index}:${word.eng}`}
                  onClick={() => {
                    setSelectedWord(word.index);
                    tryMatch(selectedImage, word.index);
                  }}
                  type="button"
                >
                  <UniformAutoFitText className="matching-renewal-card-text" text={word.mean || word.eng} />
                </button>
              ))}
              </div>
            </UniformAutoFitTextGroup>
            {message ? <p className={message === "Correct" ? "renewal-feedback is-correct" : "renewal-feedback is-wrong"}>{message}</p> : null}
            {matched.size === gameWords.length ? <div className="renewal-game-overlay is-success"><strong>Complete!</strong></div> : null}
            {isTimedOut ? (
              <div className="renewal-game-overlay">
                <strong>Time is up</strong>
                <button type="button" onClick={() => setRestartNonce((value) => value + 1)}>
                  <RotateCcw aria-hidden="true" /> 다시 하기
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <ResourceMissing label="word list" />
        )}
      </div>
    </ActivityFrame>
  );
}

export function MemoryGameActivity({
  context,
  label = "Memory Game",
  prototypeData
}: {
  context: ActivityRendererContext;
  label?: string;
  prototypeData?: PrototypeActivityData;
}) {
  const wordResource = useWordsState(context);
  const loadedWords = wordResource.words;
  const words = prototypeData?.words ?? loadedWords;
  const isWordResourceLoading = !prototypeData && wordResource.status === "loading";
  const [shuffleSeed] = useState(createShuffleSeed);
  const [roundIndex, setRoundIndex] = useState(0);
  const [restartNonce, setRestartNonce] = useState(0);
  const round = MEMORY_GAME_ROUNDS[roundIndex] || MEMORY_GAME_ROUNDS[0];
  const allWordsSignature = buildWordsSignature(words);
  const gameWords = useMemo(
    () => shuffleWithSeed(words, mixSeed(shuffleSeed, `${allWordsSignature}:${roundIndex}:${restartNonce}`)).slice(0, round.pairCount),
    [allWordsSignature, restartNonce, round.pairCount, roundIndex, shuffleSeed, words]
  );
  const wordsSignature = buildWordsSignature(gameWords);
  const cards = useMemo<MemoryCard[]>(() => {
    const nextCards = gameWords.flatMap<MemoryCard>((word) => [
      { id: `image:${word.index}`, wordIndex: word.index, kind: "image", word },
      { id: `word:${word.index}`, wordIndex: word.index, kind: "word", word }
    ]);
    return shuffleAvoidingSameOrder(nextCards, mixSeed(shuffleSeed, `${wordsSignature}:${roundIndex}:${restartNonce}`), (card) => card.id);
  }, [gameWords, restartNonce, roundIndex, shuffleSeed, wordsSignature]);
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [matched, setMatched] = useState<Set<number>>(() => new Set());
  const [pendingReset, setPendingReset] = useState(false);
  const [status, setStatus] = useState<MemoryGameStatus>("playing");
  const [secondsLeft, setSecondsLeft] = useState(round.timeLimit);
  const [hintActive, setHintActive] = useState(false);
  const hintTimerRef = useRef<number | undefined>(undefined);
  const boardViewKeyRef = useRef("");
  const roundKey = `${roundIndex}:${restartNonce}:${allWordsSignature}`;

  useEffect(() => {
    setOpenIds([]);
    setMatched(new Set());
    setPendingReset(false);
    setStatus("playing");
    setSecondsLeft(round.timeLimit);
    setHintActive(false);
  }, [round.timeLimit, roundKey]);

  useEffect(
    () => () => {
      if (hintTimerRef.current !== undefined) window.clearTimeout(hintTimerRef.current);
    },
    []
  );

  useEffect(() => {
    if (cards.length === 0) return;
    const key = `${roundKey}:${cards.map((card) => card.id).join("|")}`;
    if (boardViewKeyRef.current === key) return;
    boardViewKeyRef.current = key;
    recordLearnEvent(context, {
      action: "board_view",
      item_type: "pair",
      item_idx: null,
      extra: {
        round: roundIndex + 1,
        time_limit_seconds: round.timeLimit,
        pair_count: gameWords.length,
        card_order: cards.map((card) => ({
          card_id: card.id,
          kind: card.kind,
          word_idx: wordItemIdx(card.word),
          text: card.word.eng
        }))
      }
    });
  }, [cards, context, gameWords.length, round.timeLimit, roundIndex, roundKey]);

  useEffect(() => {
    if (!pendingReset) return undefined;
    const timeout = window.setTimeout(() => {
      setOpenIds([]);
      setPendingReset(false);
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [pendingReset]);

  useEffect(() => {
    if (status !== "playing" || cards.length === 0) return undefined;
    if (secondsLeft <= 0) {
      setStatus("failed");
      recordLearnEvent(context, {
        action: "round_timeout",
        item_type: "activity",
        item_idx: context.activity?.actIdx ?? null,
        correct: 0,
        extra: {
          round: roundIndex + 1,
          matched_pairs: matched.size,
          target_pairs: gameWords.length
        }
      });
      return undefined;
    }
    const timer = window.setTimeout(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cards.length, context, gameWords.length, matched.size, roundIndex, secondsLeft, status]);

  useEffect(() => {
    if (status !== "playing" || gameWords.length === 0 || matched.size !== gameWords.length) return;
    const isLastRound = roundIndex >= MEMORY_GAME_ROUNDS.length - 1;
    setStatus(isLastRound ? "complete" : "round-complete");
    recordLearnEvent(context, {
      action: isLastRound ? "activity_complete" : "round_complete",
      item_type: "activity",
      item_idx: context.activity?.actIdx ?? null,
      correct: 1,
      score: roundIndex + 1,
      extra: {
        round: roundIndex + 1,
        remaining_seconds: secondsLeft,
        pair_count: gameWords.length
      }
    });
  }, [context, gameWords.length, matched.size, roundIndex, secondsLeft, status]);

  useEffect(() => {
    if (status !== "round-complete") return undefined;
    const timer = window.setTimeout(() => setRoundIndex((value) => Math.min(MEMORY_GAME_ROUNDS.length - 1, value + 1)), 900);
    return () => window.clearTimeout(timer);
  }, [status]);

  function flipCard(card: MemoryCard) {
    if (status !== "playing" || hintActive || pendingReset || openIds.includes(card.id) || matched.has(card.wordIndex)) return;
    recordLearnEvent(context, {
      action: "card_open",
      item_type: "word",
      item_idx: wordItemIdx(card.word),
      extra: {
        card_id: card.id,
        kind: card.kind,
        word: card.word.eng,
        open_count: openIds.length + 1
      }
    });
    const nextOpenIds = [...openIds, card.id];
    setOpenIds(nextOpenIds);

    if (nextOpenIds.length !== 2) return;

    const [first, second] = nextOpenIds.map((id) => cards.find((item) => item.id === id));
    const correct = Boolean(first && second && first.wordIndex === second.wordIndex && first.kind !== second.kind);
    recordLearnEvent(context, {
      action: "pair_attempt",
      item_type: "pair",
      item_idx: first && second && first.wordIndex === second.wordIndex ? wordItemIdx(first.word) : null,
      correct: boolCorrect(correct),
      extra: {
        first_card_id: first?.id,
        second_card_id: second?.id,
        first_word_idx: first ? wordItemIdx(first.word) : null,
        second_word_idx: second ? wordItemIdx(second.word) : null,
        first_kind: first?.kind,
        second_kind: second?.kind
      }
    });

    if (correct && first) {
      setMatched((current) => new Set(current).add(first.wordIndex));
      setOpenIds([]);
      recordLearnEvent(context, {
        action: "pair_match",
        item_type: "pair",
        item_idx: wordItemIdx(first.word),
        correct: 1,
        extra: {
          word: first.word.eng,
          first_card_id: first.id,
          second_card_id: second?.id
        }
      });
    } else {
      setPendingReset(true);
    }
  }

  function revealHint() {
    if (status !== "playing" || cards.length === 0 || hintActive) return;
    setHintActive(true);
    recordLearnEvent(context, {
      action: "hint_use",
      item_type: "activity",
      item_idx: context.activity?.actIdx ?? null,
      hints_used: 1,
      extra: { round: roundIndex + 1 }
    });
    if (hintTimerRef.current !== undefined) window.clearTimeout(hintTimerRef.current);
    hintTimerRef.current = window.setTimeout(() => setHintActive(false), 1400);
  }

  function restartGame() {
    setRoundIndex(0);
    setRestartNonce((value) => value + 1);
    recordLearnEvent(context, {
      action: "activity_restart",
      item_type: "activity",
      item_idx: context.activity?.actIdx ?? null,
      extra: { failed_round: roundIndex + 1 }
    });
  }

  return (
    <ActivityFrame context={context} actionLabel={label} loading={isWordResourceLoading} className="figma-renewal-frame">
      <div
        className="figma-renewal-shell memory-renewal-shell"
        data-round={roundIndex + 1}
        data-time-limit={round.timeLimit}
      >
        <div className="memory-round-label">ROUND {roundIndex + 1} / {MEMORY_GAME_ROUNDS.length}</div>
        <ActivityTimerBadge
          seconds={secondsLeft}
          className={secondsLeft <= 3 ? "memory-round-timer is-urgent" : "memory-round-timer"}
          visualStyle="framed"
        />
        <button
          aria-label="Hint"
          aria-pressed={hintActive}
          className="memory-hint-button"
          type="button"
          onClick={revealHint}
          disabled={status !== "playing" || hintActive}
        >
          <ActivityHintImage />
        </button>
        {cards.length > 0 ? (
          <>
            <UniformAutoFitTextGroup
              className="memory-renewal-grid"
              maximumSize={40}
              minimumSize={7}
              style={{ "--memory-columns": round.columns, "--memory-rows": round.rows } as CSSProperties}
            >
              {cards.map((card, cardIndex) => {
                const isOpen = hintActive || openIds.includes(card.id) || matched.has(card.wordIndex);
                return (
                  <button
                    className={[
                      "memory-renewal-card",
                      isOpen ? "open" : "",
                      matched.has(card.wordIndex) ? "matched" : ""
                    ].filter(Boolean).join(" ")}
                    aria-label={isOpen ? `${card.kind} card ${card.word.eng}` : `Open memory card ${cardIndex + 1}`}
                    disabled={status !== "playing" || hintActive || matched.has(card.wordIndex)}
                    key={card.id}
                    onClick={() => flipCard(card)}
                    type="button"
                  >
                    <span className="memory-renewal-card-back" aria-hidden="true">
                      <img src={`${FIGMA_RENEWAL_ASSET_BASE}/memory-card-back.png`} alt="" />
                    </span>
                    <span className="memory-renewal-card-front">
                      {card.kind === "image" && card.word.imageUrl ? (
                        <img src={card.word.imageUrl} alt={card.word.eng} />
                      ) : (
                        <UniformAutoFitText className="memory-renewal-card-text" text={card.word.eng} />
                      )}
                    </span>
                  </button>
                );
              })}
            </UniformAutoFitTextGroup>
            {status === "round-complete" ? <div className="renewal-game-overlay is-success"><strong>Round clear!</strong></div> : null}
            {status === "complete" ? (
              <div className="renewal-game-overlay is-success">
                <Trophy aria-hidden="true" />
                <strong>All rounds complete!</strong>
                <button type="button" onClick={restartGame}><RotateCcw aria-hidden="true" /> 처음부터 다시하기</button>
              </div>
            ) : null}
            {status === "failed" ? (
              <div className="renewal-game-overlay">
                <strong>Round {roundIndex + 1} time out</strong>
                <span>{matched.size} / {gameWords.length} pairs</span>
                <button type="button" onClick={restartGame}><RotateCcw aria-hidden="true" /> 처음부터 다시하기</button>
              </div>
            ) : null}
          </>
        ) : (
          <ResourceMissing label="word list" />
        )}
      </div>
    </ActivityFrame>
  );
}

export function WordPuzzleActivity({ context, label = "Word Puzzle" }: { context: ActivityRendererContext; label?: string }) {
  const wordResource = useWordsState(context);
  const words = wordResource.words;
  const isWordResourceLoading = wordResource.status === "loading";
  const [index, setIndex] = useState(0);
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);
  const word = words[index];
  const letters = useMemo(() => scrambleWord(word?.eng || ""), [word?.eng]);
  const answer = selectedIndexes.map((letterIndex) => letters[letterIndex]).join("");
  const isCorrect = answer.toLowerCase() === (word?.eng || "").toLowerCase();

  useEffect(() => {
    setSelectedIndexes([]);
    setChecked(false);
    if (index >= words.length) setIndex(0);
  }, [index, words.length]);

  return (
    <ActivityFrame context={context} actionLabel={label} loading={isWordResourceLoading}>
      <ActivityQuestionNavigation current={index} total={words.length} onChange={setIndex} />
      <div className="word-puzzle-shell">
        <div className="puzzle-prompt">
          {word?.imageUrl ? <img src={word.imageUrl} alt={word.eng} /> : <ResourceMissing label="word image" />}
          <div>
            <strong>{word?.mean || "Build the word."}</strong>
            {word?.audioUrl ? <audio src={word.audioUrl} controls /> : null}
          </div>
        </div>
        <div className="puzzle-answer" aria-label="Selected letters">
          {word?.eng.split("").map((_, letterIndex) => (
            <span key={letterIndex}>{answer[letterIndex] || ""}</span>
          ))}
        </div>
        <div className="letter-bank">
          {letters.map((letter, letterIndex) => (
            <button
              disabled={selectedIndexes.includes(letterIndex)}
              key={`${letter}:${letterIndex}`}
              onClick={() => {
                setSelectedIndexes((current) => [...current, letterIndex]);
                setChecked(false);
              }}
              type="button"
            >
              {letter}
            </button>
          ))}
        </div>
        {checked ? <p className={isCorrect ? "success-text" : "error-text"}>{isCorrect ? "Correct" : `Answer: ${word?.eng}`}</p> : null}
        <div className="inline-actions">
          <button type="button" onClick={() => setSelectedIndexes([])} disabled={selectedIndexes.length === 0}>
            Reset
          </button>
          <button type="button" onClick={() => setChecked(true)} disabled={!word || selectedIndexes.length === 0}>
            Check
          </button>
        </div>
      </div>
    </ActivityFrame>
  );
}

export function WordSearchActivity({
  context,
  label = "Word Search",
  prototypeData
}: {
  context: ActivityRendererContext;
  label?: string;
  prototypeData?: PrototypeActivityData;
}) {
  const wordResource = useWordsState(context);
  const loadedWords = wordResource.words;
  const words = prototypeData?.words ?? loadedWords;
  const isWordResourceLoading = !prototypeData && wordResource.status === "loading";
  const [shuffleSeed] = useState(createShuffleSeed);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<string>();
  const feedbackTimerRef = useRef<number | undefined>(undefined);
  const target = words[current];
  const wordsSignature = buildWordsSignature(words);
  const answers = useMemo(
    () => buildWordSearchOptions(words, current, mixSeed(shuffleSeed, `word-search:${wordsSignature}:${current}`)),
    [current, shuffleSeed, words, wordsSignature]
  );
  const answersSignature = answers.map(wordOptionKey).join("|");
  const questionViewKeyRef = useRef("");

  useEffect(() => {
    if (feedbackTimerRef.current !== undefined) window.clearTimeout(feedbackTimerRef.current);
    setSelected(undefined);
    if (current >= words.length) setCurrent(0);
  }, [current, words.length]);

  useEffect(
    () => () => {
      if (feedbackTimerRef.current !== undefined) window.clearTimeout(feedbackTimerRef.current);
    },
    []
  );

  useEffect(() => {
    if (!target) return;
    const viewKey = `${wordItemIdx(target) ?? target.index}:${current}:${answersSignature}`;
    if (questionViewKeyRef.current === viewKey) return;
    questionViewKeyRef.current = viewKey;
    recordLearnEvent(context, {
      action: "question_view",
      item_type: "word",
      item_idx: wordItemIdx(target),
      extra: {
        question_index: current + 1,
        quiz_mode: "image-text",
        option_order: wordOptionOrder(answers)
      }
    });
  }, [answersSignature, current, target]);

  function chooseAnswer(answer: LoadedWord) {
    if (!target || selected !== undefined) return;
    const correct = normalizeToken(answer.eng) === normalizeToken(target.eng);
    setSelected(answer.eng);
    recordLearnEvent(context, {
      action: "option_select",
      item_type: "word",
      item_idx: wordItemIdx(target),
      extra: {
        selected_word_idx: wordItemIdx(answer),
        selected_text: answer.eng,
        question_index: current + 1
      }
    });
    recordLearnEvent(context, {
      action: "submit",
      item_type: "word",
      item_idx: wordItemIdx(target),
      correct: boolCorrect(correct),
      attempts: 1,
      extra: {
        answer_word_idx: wordItemIdx(target),
        selected_word_idx: wordItemIdx(answer),
        selected_text: answer.eng,
        option_order: wordOptionOrder(answers)
      }
    });

    if (feedbackTimerRef.current !== undefined) window.clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = window.setTimeout(() => {
      if (correct && current < words.length - 1) {
        setCurrent((value) => Math.min(words.length - 1, value + 1));
      } else if (!correct) {
        setSelected(undefined);
      }
    }, correct ? 850 : 700);
  }

  return (
    <ActivityFrame context={context} actionLabel={label} loading={isWordResourceLoading} className="figma-renewal-frame">
      <div className="figma-renewal-shell word-search-renewal-shell">
        <RenewalCounter current={words.length === 0 ? 0 : current + 1} total={words.length} className="word-search-counter" />
        <ActivityQuestionNavigation current={current} total={words.length} onChange={setCurrent} />
        <RenewalSoundButton
          src={target?.audioUrl}
          label={`Play ${target?.eng || "word"}`}
          className="word-search-sound-button"
          icon="sound"
          assetSrc={`${FIGMA_RENEWAL_ASSET_BASE}/word-search-sound.png`}
          onPlay={() =>
            recordLearnEvent(context, {
              action: "audio_play",
              item_type: "word",
              item_idx: wordItemIdx(target),
              audio_replays: 1,
              extra: { word: target?.eng, question_index: current + 1 }
            })
          }
        />
        <section className="word-search-machine" aria-label="Word Search game">
          <div className="word-search-machine-core">
            <div className="word-search-prompt">
              <img
                className={target?.imageUrl ? "is-book-image" : "is-figma-illustration"}
                src={target?.imageUrl || `${FIGMA_RENEWAL_ASSET_BASE}/word-search-bunny.png`}
                alt={target?.eng || "Word prompt"}
              />
            </div>
            <div className="word-search-answer-slot" aria-live="polite">
              <UniformAutoFitText text={selected || "Choose the word"} />
            </div>
            <div className="word-search-conveyor" aria-hidden="true">
              <span className="word-search-conveyor-light" />
              <span className="word-search-conveyor-light" />
              <span className="word-search-conveyor-light" />
            </div>
          </div>
        </section>
        {words.length > 0 ? (
          <UniformAutoFitTextGroup className="word-search-options" maximumSize={32} minimumSize={5}>
            {answers.map((answer) => {
              const isSelected = selected === answer.eng;
              const isCorrect = isSelected && normalizeToken(answer.eng) === normalizeToken(target?.eng || "");
              return (
                <button
                  aria-label={`Answer ${answer.eng}`}
                  className={[
                    "renewal-option-button",
                    isSelected ? "is-selected" : "",
                    isCorrect ? "is-correct" : "",
                    isSelected && !isCorrect ? "is-wrong" : ""
                  ].filter(Boolean).join(" ")}
                  disabled={selected !== undefined}
                  key={wordOptionKey(answer)}
                  onClick={() => chooseAnswer(answer)}
                  type="button"
                >
                  <UniformAutoFitText text={answer.eng} />
                </button>
              );
            })}
          </UniformAutoFitTextGroup>
        ) : (
          <ResourceMissing label="word list" />
        )}
        {selected ? (
          <p className={normalizeToken(selected) === normalizeToken(target?.eng || "") ? "renewal-feedback is-correct" : "renewal-feedback is-wrong"} role="status">
            {normalizeToken(selected) === normalizeToken(target?.eng || "") ? "Correct" : `Answer: ${target?.eng}`}
          </p>
        ) : null}
      </div>
    </ActivityFrame>
  );
}

export function PeelingWordActivity({ context, label = "Peeling Word" }: { context: ActivityRendererContext; label?: string }) {
  const wordResource = useWordsState(context);
  const words = wordResource.words;
  const isWordResourceLoading = wordResource.status === "loading";
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(1);
  const [value, setValue] = useState("");
  const [checked, setChecked] = useState(false);
  const word = words[index];
  const expected = word?.eng || "";
  const masked = expected.split("").map((letter, letterIndex) => letterIndex < revealed ? letter : "_").join(" ");
  const isCorrect = value.trim().toLowerCase() === expected.toLowerCase();

  useEffect(() => {
    setRevealed(1);
    setValue("");
    setChecked(false);
    if (index >= words.length) setIndex(0);
  }, [index, words.length]);

  return (
    <ActivityFrame context={context} actionLabel={label} loading={isWordResourceLoading}>
      <ActivityQuestionNavigation current={index} total={words.length} onChange={setIndex} />
      <div className="peeling-word-shell">
        <div className="puzzle-prompt">
          {word?.imageUrl ? <img src={word.imageUrl} alt={word.eng} /> : <ResourceMissing label="word image" />}
          <div>
            <strong>{word?.mean || "Reveal and type the word."}</strong>
            {word?.audioUrl ? <audio src={word.audioUrl} controls /> : null}
          </div>
        </div>
        <div className="peeling-word">{masked || (isWordResourceLoading ? "" : "No word")}</div>
        <input
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setChecked(false);
          }}
          placeholder="Type the word"
        />
        {checked ? <p className={isCorrect ? "success-text" : "error-text"}>{isCorrect ? "Correct" : `Answer: ${expected}`}</p> : null}
        <div className="inline-actions">
          <button type="button" onClick={() => setRevealed((current) => Math.min(expected.length, current + 1))} disabled={!expected || revealed >= expected.length}>
            Reveal
          </button>
          <button type="button" onClick={() => setChecked(true)} disabled={!expected || value.trim().length === 0}>
            Check
          </button>
        </div>
      </div>
    </ActivityFrame>
  );
}

export function VocaQuizActivity({
  context,
  prototypeData
}: {
  context: ActivityRendererContext;
  prototypeData?: PrototypeActivityData;
}) {
  const wordResource = useWordsState(context);
  const loadedWords = wordResource.words;
  const words = prototypeData?.words ?? loadedWords;
  const isWordResourceLoading = !prototypeData && wordResource.status === "loading";

  if (isMetaOnWordQuiz(context.activity)) {
    return <VocaQuizSpellingActivity context={context} loading={isWordResourceLoading} words={words} />;
  }

  return <VocaQuizChoiceActivity context={context} loading={isWordResourceLoading} words={words} />;
}

function VocaQuizChoiceActivity({
  context,
  loading = false,
  words
}: {
  context: ActivityRendererContext;
  loading?: boolean;
  words: LoadedWord[];
}) {
  const [shuffleSeed] = useState(createShuffleSeed);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<string>();
  const [videoUnavailable, setVideoUnavailable] = useState(false);
  const feedbackTimerRef = useRef<number | undefined>(undefined);
  const activityCode = normalizeActivityCode(context.activity?.activityCode);
  const usesVideoBackground = activityCode === MetaOnActivityCode.VideoWordQuiz;
  const wdqu03VideoPaths = usePackagePathList(context, `${dayBase(context)}/wdqu03/video/`);
  const dayVideoPaths = usePackagePathList(context, `${dayBase(context)}/video/`);
  const wdqu03VideoPath = useMemo(
    () => [...wdqu03VideoPaths, ...dayVideoPaths].find((path) => /\.(?:mp4|webm|m4v|mov)$/i.test(path)),
    [wdqu03VideoPaths, dayVideoPaths]
  );
  const wdqu03VideoUrl = usePackageUrl(context, wdqu03VideoPath);
  const target = words[current];
  const wordsSignature = buildWordsSignature(words);
  const answers = useMemo(
    () => buildWordOptions(words, current, mixSeed(shuffleSeed, `${wordsSignature}:${current}`)),
    [current, shuffleSeed, words, wordsSignature]
  );
  const requestedMode = useMemo(
    () => resolveVocaQuizMode(context.activity, current, shuffleSeed),
    [context.activity, current, shuffleSeed]
  );
  const optionKind = requestedMode.endsWith("image") && answers.every((answer) => Boolean(answer.imageUrl)) ? "image" : "text";
  let promptKind = requestedMode.split("-")[0] as "text" | "image" | "sound";
  if (promptKind === "image" && !target?.imageUrl) promptKind = target?.audioUrl ? "sound" : "text";
  if (promptKind === "sound" && !target?.audioUrl) promptKind = target?.imageUrl ? "image" : "text";
  if (promptKind === "text" && optionKind === "text") promptKind = target?.audioUrl ? "sound" : target?.imageUrl ? "image" : "text";
  const answersSignature = answers.map(wordOptionKey).join("|");
  const questionViewKeyRef = useRef("");

  useEffect(() => {
    if (feedbackTimerRef.current !== undefined) window.clearTimeout(feedbackTimerRef.current);
    setSelected(undefined);
  }, [current]);

  useEffect(
    () => () => {
      if (feedbackTimerRef.current !== undefined) window.clearTimeout(feedbackTimerRef.current);
    },
    []
  );

  useEffect(() => {
    setVideoUnavailable(false);
  }, [wdqu03VideoUrl]);

  useEffect(() => {
    if (!target) return;
    const viewKey = `${wordItemIdx(target) ?? target.index}:${current}:${answersSignature}`;
    if (questionViewKeyRef.current === viewKey) return;
    questionViewKeyRef.current = viewKey;
    recordLearnEvent(context, {
      action: "question_view",
      item_type: "word",
      item_idx: wordItemIdx(target),
      extra: {
        question_index: current + 1,
        quiz_mode: `${promptKind}-${optionKind}`,
        option_order: wordOptionOrder(answers)
      }
    });
  }, [answersSignature, current, optionKind, promptKind, target]);

  function chooseAnswer(answer: LoadedWord) {
    if (!target) return;
    const correct = answer.eng === target.eng;
    setSelected(answer.eng);
    recordLearnEvent(context, {
      action: "option_select",
      item_type: "word",
      item_idx: wordItemIdx(target),
      extra: {
        selected_word_idx: wordItemIdx(answer),
        selected_text: answer.eng
      }
    });
    recordLearnEvent(context, {
      action: "submit",
      item_type: "word",
      item_idx: wordItemIdx(target),
      correct: boolCorrect(correct),
      attempts: 1,
      extra: {
        answer_word_idx: wordItemIdx(target),
        selected_word_idx: wordItemIdx(answer),
        selected_text: answer.eng,
        option_order: wordOptionOrder(answers)
      }
    });

    if (feedbackTimerRef.current !== undefined) window.clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = window.setTimeout(() => {
      if (correct && current < words.length - 1) {
        setCurrent((value) => Math.min(words.length - 1, value + 1));
      } else if (!correct) {
        setSelected(undefined);
      }
    }, correct ? 850 : 700);
  }

  return (
    <ActivityFrame context={context} actionLabel="Word Quiz" loading={loading} className="figma-renewal-frame">
      <div
        className={`figma-renewal-shell voca-quiz-renewal-shell${usesVideoBackground ? ` wdqu03-video-quiz-shell${videoUnavailable ? " is-video-background-unavailable" : ""}` : ""}`}
        data-quiz-mode={`${promptKind}-${optionKind}`}
      >
        {usesVideoBackground ? (
          <>
            <VideoActivityBackground className="wdqu03-background-video" onUnavailable={() => setVideoUnavailable(true)} url={wdqu03VideoUrl} />
            <span aria-hidden="true" className="wdqu03-background-scrim" />
          </>
        ) : null}
        {usesVideoBackground ? (
          <VideoActivityProgress currentIndex={current} total={words.length} />
        ) : (
          <RenewalCounter current={words.length === 0 ? 0 : current + 1} total={words.length} className="voca-quiz-counter" />
        )}
        <ActivityQuestionNavigation current={current} total={words.length} onChange={setCurrent} variant={usesVideoBackground ? "video" : "standard"} />
        <div className={`voca-quiz-prompt is-${promptKind}`}>
          {promptKind === "image" ? (
            target?.imageUrl ? <img src={target.imageUrl} alt={target.eng} /> : <ResourceMissing label="word image" />
          ) : null}
          {promptKind === "text" ? <AutoFitVocaQuizText text={target?.eng || (loading ? "" : "No word")} variant="prompt" /> : null}
          {promptKind === "sound" ? (
            <RenewalSoundButton
              src={target?.audioUrl}
              label={`Play ${target?.eng || "word"}`}
              className="voca-quiz-sound-button"
              onPlay={() =>
                recordLearnEvent(context, {
                  action: "audio_play",
                  item_type: "word",
                  item_idx: wordItemIdx(target),
                  audio_replays: 1,
                  extra: { word: target?.eng, question_index: current + 1 }
                })
              }
            />
          ) : null}
        </div>
        <UniformAutoFitTextGroup
          className={`voca-quiz-options is-${optionKind}`}
          maximumSize={32}
          minimumSize={5}
        >
          {answers.map((answer) => (
            <button
              aria-label={`Answer ${answer.eng}`}
              className={[
                "voca-quiz-option",
                selected === answer.eng ? "is-selected" : "",
                selected === answer.eng && answer.eng === target?.eng ? "is-correct" : "",
                selected === answer.eng && answer.eng !== target?.eng ? "is-wrong" : ""
              ].filter(Boolean).join(" ")}
              disabled={selected !== undefined}
              key={`${answer.index}:${answer.eng}`}
              onClick={() => chooseAnswer(answer)}
              type="button"
            >
              {optionKind === "image" && answer.imageUrl ? (
                <img src={answer.imageUrl} alt="" />
              ) : (
                <AutoFitVocaQuizText text={answer.eng} variant="option" />
              )}
            </button>
          ))}
        </UniformAutoFitTextGroup>
        {selected ? (
          <p className={selected === target?.eng ? "renewal-feedback is-correct" : "renewal-feedback is-wrong"} role="status">
            {selected === target?.eng ? "Correct" : `Answer: ${target?.eng}`}
          </p>
        ) : null}
      </div>
    </ActivityFrame>
  );
}

function VocaQuizSpellingActivity({
  context,
  loading = false,
  words
}: {
  context: ActivityRendererContext;
  loading?: boolean;
  words: LoadedWord[];
}) {
  const [shuffleSeed] = useState(createShuffleSeed);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<string>();
  const feedbackTimerRef = useRef<number | undefined>(undefined);
  const target = words[current];
  const targetKey = target ? wordOptionKey(target) : "";
  const question = useMemo(
    () => buildWordBlankQuestion(target, mixSeed(shuffleSeed, `word-quiz:${targetKey}:${current}`)),
    [current, shuffleSeed, target, targetKey]
  );
  const isCorrect = selected != null && normalizeToken(selected) === normalizeToken(question.answer);
  const wordStyle = useVocaQuizSpellingWordStyle(question.letters.length);
  const questionViewKeyRef = useRef("");

  useEffect(() => {
    if (feedbackTimerRef.current !== undefined) window.clearTimeout(feedbackTimerRef.current);
    setSelected(undefined);
    if (current >= words.length) setCurrent(0);
  }, [current, words.length]);

  useEffect(
    () => () => {
      if (feedbackTimerRef.current !== undefined) window.clearTimeout(feedbackTimerRef.current);
    },
    []
  );

  useEffect(() => {
    if (!target || !question.answer) return;
    const viewKey = `${wordItemIdx(target) ?? target.index}:${current}:${question.blankIndex}:${question.options.join("|")}`;
    if (questionViewKeyRef.current === viewKey) return;
    questionViewKeyRef.current = viewKey;
    recordLearnEvent(context, {
      action: "question_view",
      item_type: "word",
      item_idx: wordItemIdx(target),
      chunk_index: question.blankIndex >= 0 ? question.blankIndex : undefined,
      extra: {
        quiz_mode: "spelling-letter",
        blank_indexes: question.blankIndex >= 0 ? [question.blankIndex] : [],
        blank_pattern: question.letters.map((letter, index) => (index === question.blankIndex ? "_" : letter)).join(""),
        option_order: question.options
      }
    });
  }, [context, current, question, target]);

  function chooseLetter(option: string) {
    if (!target || !question.answer || selected !== undefined) return;
    const correct = normalizeToken(option) === normalizeToken(question.answer);
    setSelected(option);
    recordLearnEvent(context, {
      action: "letter_select",
      item_type: "word",
      item_idx: wordItemIdx(target),
      chunk_index: question.blankIndex >= 0 ? question.blankIndex : undefined,
      extra: {
        quiz_mode: "spelling-letter",
        selected_letter: option,
        blank_index: question.blankIndex
      }
    });
    recordLearnEvent(context, {
      action: "submit",
      item_type: "word",
      item_idx: wordItemIdx(target),
      chunk_index: question.blankIndex >= 0 ? question.blankIndex : undefined,
      correct: boolCorrect(correct),
      attempts: 1,
      extra: {
        quiz_mode: "spelling-letter",
        answer: question.answer,
        selected: option,
        blank_indexes: question.blankIndex >= 0 ? [question.blankIndex] : [],
        option_order: question.options
      }
    });

    if (feedbackTimerRef.current !== undefined) window.clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = window.setTimeout(() => {
      if (correct && current < words.length - 1) {
        setCurrent((value) => Math.min(words.length - 1, value + 1));
      } else if (!correct) {
        setSelected(undefined);
      }
    }, correct ? 850 : 700);
  }

  return (
    <ActivityFrame context={context} actionLabel="Word Quiz" loading={loading} className="figma-renewal-frame">
      <div className="figma-renewal-shell voca-quiz-renewal-shell voca-quiz-spelling-shell" data-quiz-mode="spelling-letter">
        <RenewalCounter current={words.length === 0 ? 0 : current + 1} total={words.length} className="voca-quiz-counter" />
        <ActivityQuestionNavigation current={current} total={words.length} onChange={setCurrent} />
        <div className="voca-quiz-spelling-content">
          <div className="voca-quiz-spelling-media">
            {target?.imageUrl ? <img src={target.imageUrl} alt={target.eng} /> : <ResourceMissing label="word image" />}
            <RenewalSoundButton
              src={target?.audioUrl}
              label={`Play ${target?.eng || "word"}`}
              className="voca-quiz-spelling-sound-button"
              onPlay={() =>
                recordLearnEvent(context, {
                  action: "audio_play",
                  item_type: "word",
                  item_idx: wordItemIdx(target),
                  audio_replays: 1,
                  extra: { word: target?.eng, question_index: current + 1 }
                })
              }
            />
          </div>
          <div className="voca-quiz-spelling-question">
            <div
              aria-label={target?.eng ? `Word spelling for ${target.eng}` : "Word spelling"}
              className={isCorrect ? "voca-quiz-spelling-word is-complete" : "voca-quiz-spelling-word"}
              data-answer={target?.eng || ""}
              ref={wordStyle.ref}
              style={wordStyle.style}
            >
              {question.letters.map((letter, index) => {
                const isBlank = index === question.blankIndex;
                const isFilled = isBlank && selected !== undefined;
                const hasUnderline = isBlank && (!isFilled || !isCorrect);
                return (
                  <span
                    className={[
                      "voca-quiz-spelling-letter",
                      hasUnderline ? "is-blank" : "",
                      isFilled ? "is-filled" : "",
                      hasUnderline && selected && !isCorrect ? "is-wrong" : ""
                    ].filter(Boolean).join(" ")}
                    key={`${letter}:${index}`}
                  >
                    {isBlank && !isFilled ? "" : isBlank ? selected : letter}
                  </span>
                );
              })}
            </div>
            <UniformAutoFitTextGroup className="voca-quiz-spelling-options" maximumSize={40} minimumSize={8}>
              {question.options.map((option) => (
                <button
                  aria-label={`Choose ${option}`}
                  className={[
                    "renewal-option-button",
                    selected === option ? "is-selected" : "",
                    selected === option && isCorrect ? "is-correct" : "",
                    selected === option && !isCorrect ? "is-wrong" : ""
                  ].filter(Boolean).join(" ")}
                  disabled={!question.answer || selected !== undefined}
                  key={option}
                  onClick={() => chooseLetter(option)}
                  type="button"
                >
                  <UniformAutoFitText className="voca-quiz-spelling-option-text" text={option} />
                </button>
              ))}
            </UniformAutoFitTextGroup>
          </div>
        </div>
        {selected ? (
          <p className={isCorrect ? "renewal-feedback is-correct" : "renewal-feedback is-wrong"} role="status">
            {isCorrect ? "Correct" : `Answer: ${question.answer}`}
          </p>
        ) : null}
      </div>
    </ActivityFrame>
  );
}

export function ReadAndFlipActivity({ context }: { context: ActivityRendererContext }) {
  const base = dayBase(context);
  const folder = paramFolder(context.activity);
  const infoState = usePackageJsonState<ReadFlipInfo>(context, `${base}/read_n_flip/${folder}/info_read_n_flip.json`);
  const info = infoState.data;
  const isResourceLoading = isCachedResourceLoading(context, infoState);
  const [page, setPage] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const current = info?.pages?.[page];

  return (
    <ActivityFrame context={context} actionLabel="Read & Flip" loading={isResourceLoading}>
      <div className="flip-shell">
        {(current?.Items || []).map((item, index) => (
          <p className="flip-line" key={index}>
            <span>{item.left}</span>
            <button type="button" onClick={() => setFlipped((value) => !value)}>
              {flipped ? item.flip : "?"}
            </button>
            <span>{item.right}</span>
            {item.flip_2 ? <button type="button">{item.flip_2}</button> : null}
            <span>{item.right_2}</span>
          </p>
        ))}
        <div className="inline-actions">
          <button className="activity-question-edge-nav previous image-page-control" aria-label="Previous page" type="button" onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={page === 0}>
            <ActivityPageArrowImage direction="prev" />
          </button>
          <span>
            {info?.pages?.length ? page + 1 : 0} / {info?.pages?.length ?? 0}
          </span>
          <button
            className="activity-question-edge-nav next image-page-control"
            aria-label="Next page"
            type="button"
            onClick={() => {
              setFlipped(false);
              setPage((value) => Math.min((info?.pages?.length ?? 1) - 1, value + 1));
            }}
            disabled={page >= (info?.pages?.length ?? 1) - 1}
          >
            <ActivityPageArrowImage direction="next" />
          </button>
        </div>
      </div>
    </ActivityFrame>
  );
}

export function SentenceBlankActivity({
  context,
  label = "Sentence Blank",
  prototypeData
}: {
  context: ActivityRendererContext;
  label?: string;
  prototypeData?: PrototypeActivityData;
}) {
  const sentenceResource = useSentencesState(context);
  const wordResource = useWordsState(context);
  const loadedSentences = sentenceResource.sentences;
  const loadedWords = wordResource.words;
  const sentences = prototypeData?.sentences ?? loadedSentences;
  const words = prototypeData?.words ?? loadedWords;
  const isSentenceResourceLoading = !prototypeData && (sentenceResource.status === "loading" || wordResource.status === "loading");
  const [shuffleSeed] = useState(createShuffleSeed);
  const [index, setIndex] = useState(0);
  const sentence = sentences[index];
  const [videoUnavailable, setVideoUnavailable] = useState(false);
  const activityCode = normalizeActivityCode(context.activity?.activityCode);
  const usesVideoBackground = activityCode === MetaOnActivityCode.VideoSentenceBlank;
  const stbl02VideoPaths = usePackagePathList(context, `${dayBase(context)}/stbl02/video/`);
  const dayVideoPaths = usePackagePathList(context, `${dayBase(context)}/video/`);
  const stbl02VideoPath = useMemo(
    () => [...stbl02VideoPaths, ...dayVideoPaths].find((path) => /\.(?:mp4|webm|m4v|mov)$/i.test(path)),
    [stbl02VideoPaths, dayVideoPaths]
  );
  const stbl02VideoUrl = usePackageUrl(context, stbl02VideoPath);
  const parsed = parseSentenceTokens(sentence);
  const resolvedBlank = resolveClozeAnswer(parsed, words);
  const answer = resolvedBlank.answer;
  const blankTokenIndex = resolvedBlank.blankTokenIndex;
  const sentenceBlankAnswers = sentences
    .map((item) => resolveClozeAnswer(parseSentenceTokens(item), words).answer)
    .filter(Boolean);
  const [selected, setSelected] = useState<string>();
  const feedbackTimerRef = useRef<number | undefined>(undefined);
  const options = useMemo(
    () => buildSentenceBlankOptions(answer, words, mixSeed(shuffleSeed, `${index}:${answer}`), sentenceBlankAnswers),
    [answer, index, sentenceBlankAnswers.join("|"), shuffleSeed, words]
  );
  const isCorrect = selected != null && normalizeToken(selected) === normalizeToken(answer);
  const sentencePrefix = blankTokenIndex >= 0 ? formatSentence(parsed.tokens.slice(0, blankTokenIndex)) : "";
  const sentenceSuffix = blankTokenIndex >= 0 ? formatSentence(parsed.tokens.slice(blankTokenIndex + 1)) : "";
  const questionViewKeyRef = useRef("");

  useEffect(() => {
    if (feedbackTimerRef.current !== undefined) window.clearTimeout(feedbackTimerRef.current);
    setSelected(undefined);
    if (index >= sentences.length) setIndex(0);
  }, [index, sentences.length]);

  useEffect(
    () => () => {
      if (feedbackTimerRef.current !== undefined) window.clearTimeout(feedbackTimerRef.current);
    },
    []
  );

  useEffect(() => {
    setVideoUnavailable(!stbl02VideoUrl);
  }, [stbl02VideoUrl]);

  useEffect(() => {
    if (!sentence || !answer) return;
    const viewKey = `${sentenceItemIdx(sentence) ?? sentence.index}:${index}:${blankTokenIndex}:${options.join("|")}`;
    if (questionViewKeyRef.current === viewKey) return;
    questionViewKeyRef.current = viewKey;
    recordLearnEvent(context, {
      action: "question_view",
      item_type: "sentence",
      item_idx: sentenceItemIdx(sentence),
      chunk_index: blankTokenIndex >= 0 ? blankTokenIndex : undefined,
      extra: {
        blank_index: blankTokenIndex,
        blank_token: answer,
        option_order: sentenceWordOptionOrder(options, words)
      }
    });
  }, [answer, blankTokenIndex, index, options, sentence, words]);

  function chooseSentenceBlankOption(option: string) {
    if (!sentence) return;
    const selectedWord = words.find((word) => normalizeToken(word.eng) === normalizeToken(option));
    const correct = normalizeToken(option) === normalizeToken(answer);
    setSelected(option);
    recordLearnEvent(context, {
      action: "option_select",
      item_type: "sentence",
      item_idx: sentenceItemIdx(sentence),
      chunk_index: blankTokenIndex >= 0 ? blankTokenIndex : undefined,
      extra: {
        selected_word_idx: wordItemIdx(selectedWord),
        selected_text: option
      }
    });
    recordLearnEvent(context, {
      action: "submit",
      item_type: "sentence",
      item_idx: sentenceItemIdx(sentence),
      chunk_index: blankTokenIndex >= 0 ? blankTokenIndex : undefined,
      correct: boolCorrect(correct),
      attempts: 1,
      extra: {
        answer_text: answer,
        selected_word_idx: wordItemIdx(selectedWord),
        selected_text: option,
        blank_index: blankTokenIndex,
        option_order: sentenceWordOptionOrder(options, words)
      }
    });

    if (feedbackTimerRef.current !== undefined) window.clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = window.setTimeout(() => {
      if (correct && index < sentences.length - 1) {
        setIndex((value) => Math.min(sentences.length - 1, value + 1));
      } else if (!correct) {
        setSelected(undefined);
      }
    }, correct ? 900 : 720);
  }

  return (
    <ActivityFrame context={context} actionLabel={label} loading={isSentenceResourceLoading} className="figma-renewal-frame">
      <div className={`figma-renewal-shell sentence-blank-renewal-shell${usesVideoBackground ? ` stbl02-video-sentence-blank-shell${videoUnavailable ? " is-video-background-unavailable" : ""}` : ""}`}>
        {usesVideoBackground ? (
          <>
            <VideoActivityBackground className="stbl02-background-video" onUnavailable={() => setVideoUnavailable(true)} url={stbl02VideoUrl} />
            <span aria-hidden="true" className="stbl02-background-scrim" />
          </>
        ) : null}
        {usesVideoBackground ? (
          <VideoActivityProgress currentIndex={index} total={sentences.length} />
        ) : null}
        <ActivityQuestionNavigation current={index} total={sentences.length} onChange={setIndex} variant={usesVideoBackground ? "video" : "standard"} />
        <div className="sentence-renewal-panel">
          {usesVideoBackground ? null : <RenewalCounter current={sentences.length === 0 ? 0 : index + 1} total={sentences.length} className="sentence-renewal-counter" />}
          <RenewalSoundButton
            src={sentence?.audioUrl}
            label={`Play sentence ${index + 1}`}
            className="sentence-renewal-sound-button"
            icon="sound"
            onPlay={() =>
              recordLearnEvent(context, {
                action: "audio_play",
                item_type: "sentence",
                item_idx: sentenceItemIdx(sentence),
                audio_replays: 1,
                extra: { question_index: index + 1 }
              })
            }
          />
          <div className="sentence-renewal-question" aria-label="Sentence with blank">
            {parsed.tokens.length > 0 ? (
              <p>
                {sentencePrefix ? <span>{sentencePrefix}</span> : null}
                <span className={selected ? (isCorrect ? "renewal-sentence-blank is-correct" : "renewal-sentence-blank is-wrong") : "renewal-sentence-blank"}>
                  {selected || ""}
                </span>
                {sentenceSuffix ? <span className={/^[?.!,]/.test(sentenceSuffix) ? "is-punctuation" : ""}>{sentenceSuffix}</span> : null}
              </p>
            ) : isSentenceResourceLoading ? null : <span>No sentence data.</span>}
          </div>
          <UniformAutoFitTextGroup className="sentence-renewal-options" maximumSize={32} minimumSize={5}>
            {options.map((option) => (
              <button
                className={[
                  "renewal-option-button",
                  selected === option ? "is-selected" : "",
                  selected === option && isCorrect ? "is-correct" : "",
                  selected === option && !isCorrect ? "is-wrong" : ""
                ].filter(Boolean).join(" ")}
                disabled={!answer || selected !== undefined}
                key={option}
                onClick={() => chooseSentenceBlankOption(option)}
                type="button"
              >
                <AutoFitSentenceBlankOption text={option} />
              </button>
            ))}
          </UniformAutoFitTextGroup>
          {selected ? (
            <p className={isCorrect ? "renewal-feedback is-correct" : "renewal-feedback is-wrong"} role="status">
              {isCorrect ? "Correct" : `Answer: ${answer}`}
            </p>
          ) : null}
        </div>
      </div>
    </ActivityFrame>
  );
}

export function SentenceUnscrambleActivity({
  context,
  label = "Sentence Unscramble",
  prototypeData
}: {
  context: ActivityRendererContext;
  label?: string;
  prototypeData?: PrototypeActivityData;
}) {
  const sentenceResource = useSentencesState(context);
  const loadedSentences = sentenceResource.sentences;
  const sentences = prototypeData?.sentences ?? loadedSentences;
  const isSentenceResourceLoading = !prototypeData && sentenceResource.status === "loading";
  const [index, setIndex] = useState(0);
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([]);
  const [videoUnavailable, setVideoUnavailable] = useState(false);
  const feedbackTimerRef = useRef<number | undefined>(undefined);
  const activityCode = normalizeActivityCode(context.activity?.activityCode);
  const usesVideoBackground = activityCode === MetaOnActivityCode.VideoUnscramble;
  const stsc02VideoPaths = usePackagePathList(context, `${dayBase(context)}/stsc02/video/`);
  const dayVideoPaths = usePackagePathList(context, `${dayBase(context)}/video/`);
  const stsc02VideoPath = useMemo(
    () => [...stsc02VideoPaths, ...dayVideoPaths].find((path) => /\.(?:mp4|webm|m4v|mov)$/i.test(path)),
    [stsc02VideoPaths, dayVideoPaths]
  );
  const stsc02VideoUrl = usePackageUrl(context, stsc02VideoPath);
  const sentence = sentences[index];
  const parsed = parseSentenceTokens(sentence);
  const completeAnswerTokens = parsed.tokens.filter((token) => !isPunctuationToken(token));
  const answerTokens = completeAnswerTokens.slice(0, MAX_UNSCRAMBLE_ACTIVE_TOKENS);
  const answerBank = useMemo(() => scrambleSentenceTokens(answerTokens), [answerTokens.join("|")]);
  const selectedTokens = selectedIndexes.map((tokenIndex) => answerBank[tokenIndex]);
  const fullSentenceTokens = useMemo(
    () => tokenizeSentence(sentence?.eng || formatSentence(parsed.tokens)),
    [parsed.tokens.join("|"), sentence?.eng]
  );
  const displayModel = useMemo(
    () => buildUnscrambleDisplayModel(fullSentenceTokens, answerTokens, completeAnswerTokens),
    [answerTokens.join("|"), completeAnswerTokens.join("|"), fullSentenceTokens.join("|")]
  );
  const isComplete = selectedTokens.length === answerTokens.length && answerTokens.length > 0;
  const isCorrect = isComplete && normalizeSentence(selectedTokens.join(" ")) === normalizeSentence(answerTokens.join(" "));
  const questionViewKeyRef = useRef("");

  useEffect(() => {
    if (feedbackTimerRef.current !== undefined) window.clearTimeout(feedbackTimerRef.current);
    setSelectedIndexes([]);
    if (index >= sentences.length) setIndex(0);
  }, [index, sentences.length]);

  useEffect(
    () => () => {
      if (feedbackTimerRef.current !== undefined) window.clearTimeout(feedbackTimerRef.current);
    },
    []
  );

  useEffect(() => {
    setVideoUnavailable(!stsc02VideoUrl);
  }, [stsc02VideoUrl]);

  useEffect(() => {
    if (!sentence || answerTokens.length === 0) return;
    const viewKey = `${sentenceItemIdx(sentence) ?? sentence.index}:${index}:${answerBank.join("|")}`;
    if (questionViewKeyRef.current === viewKey) return;
    questionViewKeyRef.current = viewKey;
    recordLearnEvent(context, {
      action: "question_view",
      item_type: "sentence",
      item_idx: sentenceItemIdx(sentence),
      extra: {
        token_count: answerTokens.length,
        total_token_count: completeAnswerTokens.length,
        prefilled_token_count: Math.max(0, completeAnswerTokens.length - answerTokens.length),
        token_order: answerBank
      }
    });
  }, [answerBank, answerTokens.length, completeAnswerTokens.length, index, sentence]);

  function chooseUnscrambleToken(token: string, tokenIndex: number) {
    if (!sentence || selectedIndexes.includes(tokenIndex)) return;
    const nextSelectedIndexes = [...selectedIndexes, tokenIndex];
    const nextSelectedTokens = nextSelectedIndexes.map((selectedIndex) => answerBank[selectedIndex]);
    const complete = nextSelectedTokens.length === answerTokens.length && answerTokens.length > 0;
    const correct = complete && normalizeSentence(nextSelectedTokens.join(" ")) === normalizeSentence(answerTokens.join(" "));

    setSelectedIndexes(nextSelectedIndexes);
    recordLearnEvent(context, {
      action: "token_select",
      item_type: "sentence",
      item_idx: sentenceItemIdx(sentence),
      chunk_index: nextSelectedTokens.length - 1,
      extra: {
        token,
        source_index: tokenIndex,
        target_index: nextSelectedTokens.length - 1
      }
    });

    if (complete) {
      recordLearnEvent(context, {
        action: "submit",
        item_type: "sentence",
        item_idx: sentenceItemIdx(sentence),
        correct: boolCorrect(correct),
        attempts: 1,
        extra: {
          selected_tokens: nextSelectedTokens,
          answer_tokens: answerTokens,
          full_answer_tokens: completeAnswerTokens,
          token_order: answerBank
        }
      });
      if (feedbackTimerRef.current !== undefined) window.clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = window.setTimeout(() => {
        if (correct && index < sentences.length - 1) {
          setIndex((value) => Math.min(sentences.length - 1, value + 1));
        } else if (!correct) {
          setSelectedIndexes([]);
        }
      }, correct ? 1000 : 850);
    }
  }

  return (
    <ActivityFrame context={context} actionLabel={label} loading={isSentenceResourceLoading} className="figma-renewal-frame">
      <div className={`figma-renewal-shell unscramble-renewal-shell${usesVideoBackground ? ` stsc02-video-unscramble-shell${videoUnavailable ? " is-video-background-unavailable" : ""}` : ""}`}>
        {usesVideoBackground ? (
          <>
            <VideoActivityBackground className="stsc02-background-video" onUnavailable={() => setVideoUnavailable(true)} url={stsc02VideoUrl} />
            <span aria-hidden="true" className="stsc02-background-scrim" />
          </>
        ) : null}
        {usesVideoBackground ? (
          <VideoActivityProgress currentIndex={index} total={sentences.length} />
        ) : null}
        <ActivityQuestionNavigation current={index} total={sentences.length} onChange={setIndex} variant={usesVideoBackground ? "video" : "standard"} />
        <div className="sentence-renewal-panel unscramble-renewal-panel">
          {usesVideoBackground ? null : <RenewalCounter current={sentences.length === 0 ? 0 : index + 1} total={sentences.length} className="sentence-renewal-counter" />}
          <RenewalSoundButton
            src={sentence?.audioUrl}
            label={`Play sentence ${index + 1}`}
            className="sentence-renewal-sound-button"
            icon="sound"
            onPlay={() =>
              recordLearnEvent(context, {
                action: "audio_play",
                item_type: "sentence",
                item_idx: sentenceItemIdx(sentence),
                audio_replays: 1,
                extra: { question_index: index + 1 }
              })
            }
          />
          <div className="unscramble-renewal-workspace">
            <div className="unscramble-renewal-sentence" aria-label="Built sentence">
              {displayModel.map((item, itemIndex) => {
                if (item.kind === "static") {
                  return <span className={item.punctuation ? "is-punctuation" : ""} key={`static:${itemIndex}`}>{item.text}</span>;
                }
                const selectedToken = selectedTokens[item.answerIndex];
                const expectedToken = answerTokens[item.answerIndex] || "";
                const slotStyle = usesVideoBackground
                  ? ({ "--stsc02-slot-width": `${Math.max(115, expectedToken.length * 14 + 64)}px` } as CSSProperties)
                  : undefined;
                return (
                  <span className={selectedToken ? "unscramble-renewal-slot is-filled" : "unscramble-renewal-slot"} key={`slot:${item.answerIndex}`} style={slotStyle}>
                    {selectedToken || ""}
                  </span>
                );
              })}
            </div>
            <UniformAutoFitTextGroup className="unscramble-renewal-bank" maximumSize={26} minimumSize={5}>
              {answerBank.map((token, tokenIndex) => (
                <button
                  className="renewal-option-button"
                  key={`${token}:${tokenIndex}`}
                  type="button"
                  disabled={selectedIndexes.includes(tokenIndex)}
                  onClick={() => chooseUnscrambleToken(token, tokenIndex)}
                >
                  <UniformAutoFitText className="unscramble-renewal-option-text" text={token} />
                </button>
              ))}
            </UniformAutoFitTextGroup>
          </div>
          {isComplete ? (
            <p className={isCorrect ? "renewal-feedback is-correct" : "renewal-feedback is-wrong"} role="status">
              {isCorrect ? "Correct" : `Target: ${formatSentence(answerTokens)}`}
            </p>
          ) : null}
        </div>
      </div>
    </ActivityFrame>
  );
}

export function ContextClozeRaceActivity({
  context,
  label = "Context Cloze Race",
  prototypeData
}: {
  context: ActivityRendererContext;
  label?: string;
  prototypeData?: PrototypeActivityData;
}) {
  const wordResource = useWordsState(context);
  const sentenceResource = useSentencesState(context);
  const loadedWords = wordResource.words;
  const loadedSentences = sentenceResource.sentences;
  const words = prototypeData?.words ?? loadedWords;
  const sentences = prototypeData?.sentences ?? loadedSentences;
  const isSentenceResourceLoading = !prototypeData && (sentenceResource.status === "loading" || wordResource.status === "loading");
  const [shuffleSeed] = useState(createShuffleSeed);
  const questions = useMemo(() => buildContextClozeQuestions(sentences, words, shuffleSeed), [sentences, shuffleSeed, words]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string>();
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const question = questions[index];
  const isCorrect = Boolean(selected && question && normalizeToken(selected) === normalizeToken(question.answer));
  const isExpired = timeLeft <= 0 && !selected;

  useEffect(() => {
    if (index >= questions.length) setIndex(0);
  }, [index, questions.length]);

  useEffect(() => {
    setSelected(undefined);
    setTimeLeft(30);
  }, [index, question?.answer]);

  useEffect(() => {
    if (!question || selected || timeLeft <= 0) return undefined;
    const timer = window.setInterval(() => {
      setTimeLeft((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [question, selected, timeLeft]);

  function choose(option: string) {
    if (!question || selected || isExpired) return;
    const correct = normalizeToken(option) === normalizeToken(question.answer);
    setSelected(option);
    if (correct) {
      setScore((value) => value + 100 + streak * 25 + timeLeft);
      setStreak((value) => value + 1);
    } else {
      setStreak(0);
    }
  }

  return (
    <ActivityFrame context={context} actionLabel={label} loading={isSentenceResourceLoading}>
      <ActivityQuestionNavigation
        current={index}
        total={questions.length}
        onChange={setIndex}
        disableNext={!selected && !isExpired}
      />
      <div className="prototype-game-shell cloze-race-shell">
        <header className="prototype-game-header">
          <span className="prototype-game-icon"><Flag size={24} /></span>
          <div>
            <strong>{label}</strong>
            <span>문맥을 읽고 빠르게 빈칸에 맞는 단어를 고르세요.</span>
          </div>
          <div className="prototype-score-board">
            <ActivityTimerBadge seconds={timeLeft} className="prototype-activity-timer" />
            <strong>{score}</strong>
          </div>
        </header>

        {question ? (
          <>
            <div className="cloze-track" aria-label="Race progress">
              <span style={{ width: `${Math.max(8, (timeLeft / 30) * 100)}%` }} />
            </div>
            <div className="prototype-sentence-card" aria-label="Context cloze sentence">
              {question.tokens.map((token, tokenIndex) =>
                tokenIndex === question.blankTokenIndex ? (
                  <span className={selected ? "prototype-blank filled" : "prototype-blank"} key={`${token}:${tokenIndex}`}>
                    {selected || "____"}
                  </span>
                ) : (
                  <span key={`${token}:${tokenIndex}`}>{token}</span>
                )
              )}
            </div>
            <div className="prototype-option-grid">
              {question.options.map((option) => (
                <button
                  className={selected === option ? (isCorrect ? "correct" : "wrong") : ""}
                  disabled={Boolean(selected) || isExpired}
                  key={option}
                  onClick={() => choose(option)}
                  type="button"
                >
                  {option}
                </button>
              ))}
            </div>
            <div className="prototype-feedback-row">
              <span>Streak {streak}</span>
              {selected ? <strong className={isCorrect ? "success-text" : "error-text"}>{isCorrect ? "Correct" : `Answer: ${question.answer}`}</strong> : null}
              {isExpired ? <strong className="error-text">Time over: {question.answer}</strong> : null}
            </div>
          </>
        ) : (
          <ResourceMissing label="sentence or word data" />
        )}
      </div>
    </ActivityFrame>
  );
}

export function SentenceRepairActivity({
  context,
  label = "Sentence Repair",
  prototypeData
}: {
  context: ActivityRendererContext;
  label?: string;
  prototypeData?: PrototypeActivityData;
}) {
  const sentenceResource = useSentencesState(context);
  const loadedSentences = sentenceResource.sentences;
  const sentences = prototypeData?.sentences ?? loadedSentences;
  const isSentenceResourceLoading = !prototypeData && sentenceResource.status === "loading";
  const questions = useMemo(() => sentences.map(buildSentenceRepairQuestion).filter(Boolean) as SentenceRepairQuestion[], [sentences]);
  const [index, setIndex] = useState(0);
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([]);
  const question = questions[index];
  const selectedTokens = selectedIndexes.map((tokenIndex) => question?.bank[tokenIndex]).filter(Boolean) as string[];
  const isComplete = Boolean(question && selectedTokens.length === question.answerTokens.length);
  const isCorrect = Boolean(question && isComplete && normalizeSentence(selectedTokens.join(" ")) === normalizeSentence(question.answerTokens.join(" ")));

  useEffect(() => {
    setSelectedIndexes([]);
    if (index >= questions.length) setIndex(0);
  }, [index, questions.length]);

  return (
    <ActivityFrame context={context} actionLabel={label} loading={isSentenceResourceLoading}>
      <ActivityQuestionNavigation current={index} total={questions.length} onChange={setIndex} disableNext={!isComplete} />
      <div className="prototype-game-shell sentence-repair-shell">
        <header className="prototype-game-header">
          <span className="prototype-game-icon"><Wrench size={24} /></span>
          <div>
            <strong>{label}</strong>
            <span>고장난 문장을 보고 올바른 문장으로 수리하세요.</span>
          </div>
        </header>

        {question ? (
          <>
            <div className="repair-broken-card" aria-label="Broken sentence">
              <span>Broken</span>
              <strong>{formatSentence(question.brokenTokens)}</strong>
            </div>
            <div className="sentence-line prototype-built-line" aria-label="Repaired sentence">
              {buildSentenceDisplay(question.tokens, selectedTokens)}
            </div>
            <div className="word-bank prototype-token-bank">
              {question.bank.map((token, tokenIndex) => (
                <button
                  disabled={selectedIndexes.includes(tokenIndex)}
                  key={`${token}:${tokenIndex}`}
                  onClick={() => setSelectedIndexes((current) => [...current, tokenIndex])}
                  type="button"
                >
                  {token}
                </button>
              ))}
            </div>
            <div className="prototype-feedback-row">
              {isComplete ? (
                <strong className={isCorrect ? "success-text" : "error-text"}>
                  {isCorrect ? "Repair complete" : `Target: ${formatSentence(question.answerTokens)}`}
                </strong>
              ) : (
                <span>{selectedTokens.length} / {question.answerTokens.length}</span>
              )}
              <button type="button" onClick={() => setSelectedIndexes([])} disabled={selectedIndexes.length === 0}>
                Reset
              </button>
            </div>
          </>
        ) : (
          <ResourceMissing label="sentence data" />
        )}
      </div>
    </ActivityFrame>
  );
}

export function DictationLadderActivity({
  context,
  label = "Dictation Ladder",
  prototypeData
}: {
  context: ActivityRendererContext;
  label?: string;
  prototypeData?: PrototypeActivityData;
}) {
  const sentenceResource = useSentencesState(context);
  const loadedSentences = sentenceResource.sentences;
  const sentences = prototypeData?.sentences ?? loadedSentences;
  const isSentenceResourceLoading = !prototypeData && sentenceResource.status === "loading";
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState("");
  const [checked, setChecked] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const sentence = sentences[index];
  const expected = sentence?.eng || "";
  const isCorrect = checked && normalizeDictation(value) === normalizeDictation(expected);
  const progress = sentences.length > 0 ? ((index + (isCorrect ? 1 : 0)) / sentences.length) * 100 : 0;

  useEffect(() => {
    setValue("");
    setChecked(false);
    setHintOpen(false);
    if (index >= sentences.length) setIndex(0);
  }, [index, sentences.length]);

  return (
    <ActivityFrame context={context} actionLabel={label} loading={isSentenceResourceLoading}>
      <ActivityQuestionNavigation current={index} total={sentences.length} onChange={setIndex} disableNext={!isCorrect} />
      <div className="prototype-game-shell dictation-ladder-shell">
        <header className="prototype-game-header">
          <span className="prototype-game-icon"><Keyboard size={24} /></span>
          <div>
            <strong>{label}</strong>
            <span>문장을 듣고 입력하면서 사다리를 올라가세요.</span>
          </div>
          <div className="prototype-score-board">
            <span>Step</span>
            <strong>{sentences.length === 0 ? 0 : index + 1}/{sentences.length}</strong>
          </div>
        </header>

        {sentence ? (
          <>
            <div className="dictation-ladder" aria-label="Dictation progress">
              <span style={{ height: `${Math.max(8, progress)}%` }} />
              <Trophy size={30} />
            </div>
            <div className="dictation-panel">
              {sentence.audioUrl ? <audio ref={audioRef} src={sentence.audioUrl} preload="metadata" /> : null}
              <div className="inline-actions">
                <button
                  className="activity-image-listen-button"
                  type="button"
                  aria-label="Listen"
                  onClick={() => void audioRef.current?.play().catch(() => undefined)}
                  disabled={!sentence.audioUrl}
                >
                  <ActivityListeningImage />
                </button>
                <button
                  className="activity-image-hint-button"
                  type="button"
                  aria-label="Hint"
                  aria-pressed={hintOpen}
                  onClick={() => setHintOpen((value) => !value)}
                >
                  <ActivityHintImage />
                </button>
              </div>
              {hintOpen || !sentence.audioUrl ? <p className="dictation-hint">{buildDictationHint(expected)}</p> : null}
              <textarea
                aria-label="Dictation answer"
                value={value}
                onChange={(event) => {
                  setValue(event.target.value);
                  setChecked(false);
                }}
                placeholder="Type the full sentence"
              />
              {checked ? (
                <p className={isCorrect ? "success-text" : "error-text"}>{isCorrect ? "Step complete" : `Target: ${expected}`}</p>
              ) : (
                <p className="muted">{expected.split(/\s+/).filter(Boolean).length} words</p>
              )}
            </div>
            <div className="prototype-feedback-row">
              <button type="button" onClick={() => setChecked(true)} disabled={value.trim().length === 0}>
                Check
              </button>
              <button type="button" onClick={() => setValue("")} disabled={value.length === 0}>
                Clear
              </button>
            </div>
          </>
        ) : (
          <ResourceMissing label="sentence data" />
        )}
      </div>
    </ActivityFrame>
  );
}

export function GrammarTransformActivity({
  context,
  label = "Grammar Transform",
  prototypeData
}: {
  context: ActivityRendererContext;
  label?: string;
  prototypeData?: PrototypeActivityData;
}) {
  const sentenceResource = useSentencesState(context);
  const loadedSentences = sentenceResource.sentences;
  const sentences = prototypeData?.sentences ?? loadedSentences;
  const isSentenceResourceLoading = !prototypeData && sentenceResource.status === "loading";
  const questions = useMemo(() => buildGrammarTransformQuestions(sentences), [sentences]);
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState("");
  const [checked, setChecked] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const question = questions[index];
  const isCorrect = checked && question ? normalizeDictation(value) === normalizeDictation(question.target) : false;

  useEffect(() => {
    setValue("");
    setChecked(false);
    setHintOpen(false);
    if (index >= questions.length) setIndex(0);
  }, [index, questions.length]);

  return (
    <ActivityFrame context={context} actionLabel={label} loading={isSentenceResourceLoading}>
      <ActivityQuestionNavigation current={index} total={questions.length} onChange={setIndex} disableNext={!isCorrect} />
      <div className="prototype-game-shell grammar-transform-shell">
        <header className="prototype-game-header">
          <span className="prototype-game-icon"><BookOpen size={24} /></span>
          <div>
            <strong>{label}</strong>
            <span>문장 구조를 바꿔 쓰며 문법 패턴을 연습하세요.</span>
          </div>
          <div className="prototype-score-board">
            <span>Mission</span>
            <strong>{questions.length === 0 ? 0 : index + 1}/{questions.length}</strong>
          </div>
        </header>

        {question ? (
          <>
            <div className="transform-card">
              <span>{question.prompt}</span>
              <strong>{question.source}</strong>
              {hintOpen ? <p>{question.helper}</p> : null}
            </div>
            <div className="dictation-panel transform-answer-panel">
              <div className="inline-actions">
                <button
                  className="activity-image-hint-button"
                  type="button"
                  aria-label="Hint"
                  aria-pressed={hintOpen}
                  onClick={() => setHintOpen((value) => !value)}
                >
                  <ActivityHintImage />
                </button>
              </div>
              <textarea
                aria-label="Grammar transform answer"
                value={value}
                onChange={(event) => {
                  setValue(event.target.value);
                  setChecked(false);
                }}
                placeholder="Rewrite the sentence"
              />
              {checked ? (
                <p className={isCorrect ? "success-text" : "error-text"}>{isCorrect ? "Transform complete" : `Target: ${question.target}`}</p>
              ) : (
                <p className="muted">Keep the same meaning and change only the grammar pattern.</p>
              )}
            </div>
            <div className="prototype-feedback-row">
              <button type="button" onClick={() => setChecked(true)} disabled={value.trim().length === 0}>
                Check
              </button>
              <button type="button" onClick={() => setValue(question.target)}>
                Show target
              </button>
            </div>
          </>
        ) : (
          <ResourceMissing label="sentence data" />
        )}
      </div>
    </ActivityFrame>
  );
}

export function ParaphraseMatchActivity({
  context,
  label = "Paraphrase Match",
  prototypeData
}: {
  context: ActivityRendererContext;
  label?: string;
  prototypeData?: PrototypeActivityData;
}) {
  const sentenceResource = useSentencesState(context);
  const loadedSentences = sentenceResource.sentences;
  const sentences = prototypeData?.sentences ?? loadedSentences;
  const isSentenceResourceLoading = !prototypeData && sentenceResource.status === "loading";
  const [shuffleSeed] = useState(createShuffleSeed);
  const questions = useMemo(() => buildParaphraseMatchQuestions(sentences, shuffleSeed), [sentences, shuffleSeed]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string>();
  const [score, setScore] = useState(0);
  const question = questions[index];
  const isCorrect = Boolean(question && selected && normalizeSentence(selected) === normalizeSentence(question.answer));

  useEffect(() => {
    setSelected(undefined);
    if (index >= questions.length) setIndex(0);
  }, [index, questions.length]);

  function choose(option: string) {
    if (selected) return;
    setSelected(option);
    if (question && normalizeSentence(option) === normalizeSentence(question.answer)) {
      setScore((value) => value + 100);
    }
  }

  return (
    <ActivityFrame context={context} actionLabel={label} loading={isSentenceResourceLoading}>
      <ActivityQuestionNavigation current={index} total={questions.length} onChange={setIndex} disableNext={!selected} />
      <div className="prototype-game-shell paraphrase-match-shell">
        <header className="prototype-game-header">
          <span className="prototype-game-icon"><Star size={24} /></span>
          <div>
            <strong>{label}</strong>
            <span>원문과 의미가 같은 문장을 고르세요.</span>
          </div>
          <div className="prototype-score-board">
            <span>Score</span>
            <strong>{score}</strong>
          </div>
        </header>

        {question ? (
          <>
            <div className="prototype-sentence-card paraphrase-source-card" aria-label="Paraphrase source sentence">
              <span>{question.prompt}</span>
            </div>
            <div className="prototype-option-grid paraphrase-option-grid">
              {question.options.map((option) => {
                const optionCorrect = normalizeSentence(option) === normalizeSentence(question.answer);
                const stateClass = selected === option ? (optionCorrect ? "correct" : "wrong") : "";
                return (
                  <button className={stateClass} disabled={Boolean(selected)} key={option} onClick={() => choose(option)} type="button">
                    {option}
                  </button>
                );
              })}
            </div>
            <div className="prototype-feedback-row">
              <span>{index + 1} / {questions.length}</span>
              {selected ? <strong className={isCorrect ? "success-text" : "error-text"}>{isCorrect ? "Meaning matched" : `Answer: ${question.answer}`}</strong> : null}
            </div>
          </>
        ) : (
          <ResourceMissing label="sentence data" />
        )}
      </div>
    </ActivityFrame>
  );
}

export function SequencingActivity({ context }: { context: ActivityRendererContext }) {
  const base = dayBase(context);
  const folder = paramFolder(context.activity);
  const infoState = usePackageJsonState<ReadMatchInfo>(context, `${base}/reading_1501/${folder}/info_read_match.json`);
  const info = infoState.data;
  const pathState = usePackagePathListState(context, `${base}/reading_1501/${folder}/img/`);
  const paths = pathState.paths;
  const imagePaths = useMemo(() => paths.filter((path) => /\.png$/i.test(path)).sort(), [paths]);
  const imageUrlState = usePackageUrlsState(context, imagePaths);
  const urls = imageUrlState.urls;
  const tokens = info?.page?.[0]?.answers?.map((answer) => answer.text || "").filter(Boolean) || [];
  const [selected, setSelected] = useState<string[]>([]);
  const imageUrls = Object.values(urls);
  const imagesDecoded = useDecodedImageUrls(imageUrls);
  const isResourceLoading = isCachedResourceLoading(context, infoState, pathState, imageUrlState) || !imagesDecoded;
  const normalizedSelected = selected.join(" ").replace(/\s+([?.!,])/g, "$1");
  const target = tokens.join(" ").replace(/\s+([?.!,])/g, "$1");

  return (
    <ActivityFrame context={context} actionLabel="Sequencing" loading={isResourceLoading}>
      <div className="sequence-shell">
        {imageUrls.length > 0 ? (
          <div className="sequence-images">
            {imageUrls.map((url, index) => (
              <img src={url} alt={`Sequence ${index + 1}`} key={url} />
            ))}
          </div>
        ) : null}
        <div className="sentence-target">{selected.join(" ") || "Tap words in order"}</div>
        <div className="word-bank">
          {tokens.map((token, index) => (
            <button key={`${token}:${index}`} type="button" onClick={() => setSelected((current) => [...current, token])}>
              {token}
            </button>
          ))}
        </div>
        {selected.length === tokens.length ? (
          <p className={normalizedSelected === target ? "success-text" : "error-text"}>
            {normalizedSelected === target ? "Correct" : `Target: ${target}`}
          </p>
        ) : null}
        <button type="button" onClick={() => setSelected([])}>
          Reset
        </button>
      </div>
    </ActivityFrame>
  );
}

export function WriteWordActivity({ context }: { context: ActivityRendererContext }) {
  const wordResource = useWordsState(context);
  const words = wordResource.words;
  const isWordResourceLoading = wordResource.status === "loading";
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState("");
  const word = words[index];
  const isCorrect = value.trim().toLowerCase() === word?.eng.toLowerCase();

  useEffect(() => {
    setValue("");
  }, [index]);

  return (
    <ActivityFrame context={context} actionLabel="Write Word" loading={isWordResourceLoading}>
      <ActivityQuestionNavigation current={index} total={words.length} onChange={setIndex} />
      <div className="write-word-shell">
        {word?.imageUrl ? <img src={word.imageUrl} alt={word.eng} /> : <ResourceMissing label="word image" />}
        {word?.audioUrl ? <audio src={word.audioUrl} controls /> : null}
        <input value={value} onChange={(event) => setValue(event.target.value)} placeholder="Type the word" />
        {value ? <p className={isCorrect ? "success-text" : "muted"}>{isCorrect ? "Correct" : word?.eng.length ? `${word.eng.length} letters` : ""}</p> : null}
      </div>
    </ActivityFrame>
  );
}

export function SpellingActivity({ context, label = "Spelling" }: { context: ActivityRendererContext; label?: string }) {
  const wordResource = useWordsState(context);
  const words = wordResource.words;
  const isWordResourceLoading = wordResource.status === "loading";
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState("");
  const [checked, setChecked] = useState(false);
  const word = words[index];
  const expected = word?.eng || "";
  const normalizedValue = value.trim().toLowerCase();
  const isCorrect = normalizedValue.length > 0 && normalizedValue === expected.toLowerCase();

  useEffect(() => {
    setValue("");
    setChecked(false);
    if (index >= words.length) setIndex(0);
  }, [index, words.length]);

  return (
    <ActivityFrame context={context} actionLabel={label} loading={isWordResourceLoading}>
      <ActivityQuestionNavigation current={index} total={words.length} onChange={setIndex} />
      <div className="spelling-shell">
        <div className="spelling-prompt">
          {word?.imageUrl ? <img src={word.imageUrl} alt={word.eng} /> : <ResourceMissing label="word image" />}
          <div>
            <strong>{word?.mean || "Spell the word"}</strong>
            {word?.audioUrl ? <audio src={word.audioUrl} controls /> : null}
            <div className="letter-slots" aria-label="Letter count">
              {expected.split("").map((letter, letterIndex) => (
                <span key={`${letter}:${letterIndex}`}>{value[letterIndex] || ""}</span>
              ))}
            </div>
          </div>
        </div>
        <input
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setChecked(false);
          }}
          placeholder="Type the word"
        />
        {checked ? (
          <p className={isCorrect ? "success-text" : "error-text"}>{isCorrect ? "Correct" : `Answer: ${expected}`}</p>
        ) : expected ? (
          <p className="muted">{expected.length} letters</p>
        ) : isWordResourceLoading ? null : (
          <p className="muted">No word data.</p>
        )}
        <div className="inline-actions">
          <button type="button" onClick={() => setChecked(true)} disabled={!word || value.trim().length === 0}>
            Check
          </button>
        </div>
      </div>
    </ActivityFrame>
  );
}

export function SpellingFishActivity({ context, label = "Spelling Fish" }: { context: ActivityRendererContext; label?: string }) {
  const wordResource = useWordsState(context);
  const words = wordResource.words;
  const isWordResourceLoading = wordResource.status === "loading";
  const gameWords = useMemo(() => words.slice(0, Math.min(3, words.length)), [words]);
  const wordsSignature = buildWordsSignature(gameWords);
  const [index, setIndex] = useState(0);
  const [questionSeed, setQuestionSeed] = useState(createShuffleSeed);
  const [fishPos, setFishPos] = useState<PercentPoint>({ x: 18, y: 68 });
  const [fishDirection, setFishDirection] = useState<"left" | "right">("right");
  const [filledLetters, setFilledLetters] = useState<string[]>([]);
  const [bubbles, setBubbles] = useState<UnderSeaBubble[]>([]);
  const [status, setStatus] = useState<"playing" | "correct" | "retry" | "complete">("playing");
  const boardRef = useRef<HTMLDivElement | null>(null);
  const activePointerId = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wordAudioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const lastAudioRequestAt = useRef(Number.NEGATIVE_INFINITY);
  const advanceTimer = useRef<number | undefined>();
  const word = gameWords[index];
  const backgroundPan = clamp((fishPos.x - 50) * 0.42, -18, 18);
  const scenePan = clamp(-backgroundPan * 0.75, -14, 14);
  const visibleBubbles = useMemo(() => bubbles.map((bubble) => ({ ...bubble, x: bubble.x + scenePan })), [bubbles, scenePan]);
  const question = useMemo(
    () => buildUnderSeaQuestion(word, mixSeed(questionSeed, `${word?.index ?? 0}:${word?.eng ?? ""}`)),
    [questionSeed, word?.eng, word?.index]
  );

  useEffect(() => {
    setIndex(0);
  }, [wordsSignature]);

  useEffect(() => {
    window.clearTimeout(advanceTimer.current);
    setFishPos({ x: 18, y: 68 });
    setFishDirection("right");
    setFilledLetters([]);
    setBubbles(question.bubbles);
    setStatus("playing");
  }, [question]);

  useEffect(() => {
    return () => {
      window.clearTimeout(advanceTimer.current);
      audioRef.current?.pause();
      wordAudioPlayerRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    wordAudioPlayerRef.current?.pause();
    wordAudioPlayerRef.current = word?.audioUrl ? new Audio(word.audioUrl) : null;
    if (wordAudioPlayerRef.current) {
      wordAudioPlayerRef.current.preload = "auto";
    }
  }, [word?.audioUrl]);

  function playWordAudio(event?: { stopPropagation: () => void; preventDefault?: () => void }) {
    event?.stopPropagation();
    event?.preventDefault?.();

    if (!word?.audioUrl) return;

    const now = Date.now();
    if (now - lastAudioRequestAt.current < 150) return;
    lastAudioRequestAt.current = now;

    const audio = wordAudioPlayerRef.current || audioRef.current;
    if (!audio) return;
    if (audio.src !== word.audioUrl) {
      audio.src = word.audioUrl;
    }
    audio.pause();
    audio.currentTime = 0;
    audio.play().catch(() => undefined);
  }

  function restartQuestion(event?: { stopPropagation: () => void }) {
    event?.stopPropagation();
    window.clearTimeout(advanceTimer.current);
    setFilledLetters([]);
    setBubbles(question.bubbles);
    setStatus("playing");
    setFishPos({ x: 18, y: 68 });
    setFishDirection("right");
    setQuestionSeed(createShuffleSeed());
  }

  function goNextWord(event?: { stopPropagation: () => void }) {
    event?.stopPropagation();
    window.clearTimeout(advanceTimer.current);
    setStatus("playing");
    setQuestionSeed(createShuffleSeed());
    setIndex((current) => Math.min(gameWords.length - 1, current + 1));
  }

  function handleBubbleEat(bubble: UnderSeaBubble) {
    if (status !== "playing" || filledLetters.length >= question.blankIndexes.length) return;

    const nextFilled = [...filledLetters, bubble.letter.toLowerCase()];
    setBubbles((current) => current.filter((item) => item.id !== bubble.id));
    setFilledLetters(nextFilled);

    if (nextFilled.length !== question.blankIndexes.length) return;

    const completed = fillUnderSeaLetters(question.letters, question.blankIndexes, nextFilled).join("").toLowerCase();
    const expected = normalizeWord(word?.eng || "");

    if (completed === expected) {
      if (index >= gameWords.length - 1) {
        setStatus("complete");
      } else {
        setStatus("correct");
        advanceTimer.current = window.setTimeout(goNextWord, 900);
      }
    } else {
      setStatus("retry");
    }
  }

  function handleFishMove(event: ReactPointerEvent<HTMLDivElement>) {
    const nextPos = getPointerPercent(event, boardRef.current);
    if (!nextPos) return;

    if (Math.abs(nextPos.x - fishPos.x) > 0.8) {
      setFishDirection(nextPos.x < fishPos.x ? "left" : "right");
    }
    setFishPos(nextPos);

    if (status !== "playing") return;
    const hit = findBubbleHit(nextPos, visibleBubbles);
    if (hit) handleBubbleEat(hit);
  }

  if (!word) {
    return (
      <ActivityFrame context={context} actionLabel={label} loading={isWordResourceLoading}>
        <ResourceMissing label="word list" />
      </ActivityFrame>
    );
  }

  return (
    <ActivityFrame context={context} actionLabel={label} loading={isWordResourceLoading}>
      <ActivityQuestionNavigation current={index} total={gameWords.length} onChange={setIndex} />
      <div className="undersea-shell">
        <div
          aria-label="Spelling Fish game board"
          className="undersea-board"
          style={{ "--undersea-pan": `${backgroundPan}%` } as CSSProperties}
          onPointerDown={(event) => {
            activePointerId.current = event.pointerId;
            event.currentTarget.setPointerCapture(event.pointerId);
            handleFishMove(event);
          }}
          onPointerMove={(event) => {
            if (activePointerId.current === event.pointerId) handleFishMove(event);
          }}
          onPointerUp={(event) => {
            if (activePointerId.current === event.pointerId) activePointerId.current = null;
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
          }}
          ref={boardRef}
          role="application"
        >
          <div className="undersea-current-word" aria-label={`Spelling target for ${word.eng}`}>
            {question.letters.map((letter, letterIndex) => {
              const blankPosition = question.blankIndexes.indexOf(letterIndex);
              const filled = blankPosition >= 0 ? filledLetters[blankPosition] : undefined;
              return (
                <span
                  className={blankPosition >= 0 ? (filled ? "filled blank" : "blank") : ""}
                  key={`${letter}:${letterIndex}`}
                >
                  {blankPosition >= 0 ? filled || "" : letter}
                </span>
              );
            })}
          </div>

          <div className="undersea-hint-card">
            <button
              type="button"
              className="undersea-image-button"
              onClick={playWordAudio}
              onMouseDown={playWordAudio}
              onPointerDown={playWordAudio}
              aria-label="Play word sound"
            >
              {word.imageUrl ? <img className="undersea-word-image" src={word.imageUrl} alt={word.eng} /> : <ResourceMissing label="word image" />}
              <span className="undersea-sound-badge">
                <img src={`${UNDERSEA_ASSET_BASE}/speaker.png`} alt="" />
              </span>
            </button>
            {word.audioUrl ? <audio ref={audioRef} src={word.audioUrl} preload="auto" /> : null}
          </div>

          {visibleBubbles.map((bubble) => (
            <button
              aria-label={`Letter bubble ${bubble.letter}`}
              className={`undersea-bubble tone-${bubble.tone}`}
              key={bubble.id}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                handleBubbleEat(bubble);
              }}
              style={{ left: `${bubble.x}%`, top: `${bubble.y}%` }}
              type="button"
            >
              {bubble.letter}
            </button>
          ))}

          <div
            className="undersea-fish"
            style={
              {
                left: `${fishPos.x}%`,
                top: `${fishPos.y}%`,
                "--undersea-fish-facing": fishDirection === "left" ? "-1" : "1"
              } as CSSProperties
            }
            aria-hidden="true"
          >
            <img src={`${UNDERSEA_ASSET_BASE}/fish2.png`} alt="" />
          </div>

          <div className="undersea-status-panel" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
            <span>
              {index + 1} / {gameWords.length}
            </span>
            {status === "correct" ? <strong className="success-text">Correct</strong> : null}
            {status === "complete" ? <strong className="success-text">Complete</strong> : null}
            {status === "retry" ? <strong className="error-text">Try again</strong> : null}
            <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={restartQuestion}>
              <RotateCcw size={16} />
              Retry
            </button>
          </div>
        </div>
      </div>
    </ActivityFrame>
  );
}

export function ListenRecordActivity({ context }: { context: ActivityRendererContext }) {
  const wordResource = useWordsState(context);
  const words = wordResource.words;
  const isWordResourceLoading = wordResource.status === "loading";
  const [index, setIndex] = useState(0);
  const word = words[index];

  return (
    <ActivityFrame context={context} actionLabel="Listen & Record" loading={isWordResourceLoading}>
      <RecordPanel
        context={context}
        eventItemType="word"
        eventItemIdx={wordItemIdx(word)}
        eventItemLabel={word?.eng}
        expectedText={word?.eng}
        mediaUrl={word?.audioUrl}
        title={word?.eng || context.activity?.title || "Record"}
        detail={word?.mean || word?.sentence || "Listen to the package audio and record your voice."}
      />
      <div className="inline-actions">
        <button className="activity-question-edge-nav previous image-page-control" aria-label="Previous word" type="button" onClick={() => setIndex((value) => Math.max(0, value - 1))} disabled={index === 0}>
          <ActivityPageArrowImage direction="prev" />
        </button>
        <span>
          {words.length === 0 ? 0 : index + 1} / {words.length}
        </span>
        <button className="activity-question-edge-nav next image-page-control" aria-label="Next word" type="button" onClick={() => setIndex((value) => Math.min(words.length - 1, value + 1))} disabled={index >= words.length - 1}>
          <ActivityPageArrowImage direction="next" />
        </button>
      </div>
    </ActivityFrame>
  );
}

export function SentenceRecordActivity({
  context,
  prototypeData
}: {
  context: ActivityRendererContext;
  prototypeData?: PrototypeActivityData;
}) {
  const sentenceResource = useSentencesState(context);
  const packageSentences = sentenceResource.sentences;
  const sentences = prototypeData?.sentences || packageSentences;
  const isSentenceResourceLoading = !prototypeData && sentenceResource.status === "loading";
  const [index, setIndex] = useState(0);
  const [videoUnavailable, setVideoUnavailable] = useState(false);
  const activityCode = normalizeActivityCode(context.activity?.activityCode);
  const usesVideoBackground = activityCode === MetaOnActivityCode.VideoSentenceRecord;
  const strc02VideoPaths = usePackagePathList(context, `${dayBase(context)}/strc02/video/`);
  const dayVideoPaths = usePackagePathList(context, `${dayBase(context)}/video/`);
  const strc02VideoPath = useMemo(
    () => [...strc02VideoPaths, ...dayVideoPaths].find((path) => /\.(?:mp4|webm|m4v|mov)$/i.test(path)),
    [strc02VideoPaths, dayVideoPaths]
  );
  const strc02VideoUrl = usePackageUrl(context, strc02VideoPath);
  const safeIndex = Math.min(index, Math.max(sentences.length - 1, 0));
  const sentence = sentences[safeIndex];

  useEffect(() => {
    if (index >= sentences.length && sentences.length > 0) setIndex(0);
  }, [index, sentences.length]);

  useEffect(() => {
    setVideoUnavailable(usesVideoBackground && !strc02VideoUrl);
  }, [strc02VideoUrl, usesVideoBackground]);

  if (!sentence) {
    return (
      <ActivityFrame context={context} actionLabel="Sentence Record" loading={isSentenceResourceLoading} className="figma-renewal-frame">
        <div className="figma-renewal-shell sentence-record-renewal-shell">
          <div className="sentence-record-renewal-panel is-empty">
            <ResourceMissing label="sentence data" />
          </div>
        </div>
      </ActivityFrame>
    );
  }

  return (
    <SentenceRecordRenewalPanel
      context={context}
      current={safeIndex}
      key={`${sentenceItemIdx(sentence) ?? sentence.index}:${safeIndex}`}
      loading={isSentenceResourceLoading}
      onChange={setIndex}
      sentence={sentence}
      total={sentences.length}
      usesVideoBackground={usesVideoBackground}
      videoUnavailable={videoUnavailable}
      videoUrl={strc02VideoUrl}
      onVideoUnavailable={() => setVideoUnavailable(true)}
    />
  );
}

type SentenceRecordMode = "native" | "record-ready" | "recording" | "review";

function SentenceRecordRenewalPanel({
  context,
  current,
  loading = false,
  onChange,
  sentence,
  total,
  usesVideoBackground = false,
  videoUnavailable = false,
  videoUrl,
  onVideoUnavailable
}: {
  context: ActivityRendererContext;
  current: number;
  loading?: boolean;
  onChange: (nextIndex: number) => void;
  sentence: LoadedSentence;
  total: number;
  usesVideoBackground?: boolean;
  videoUnavailable?: boolean;
  videoUrl?: string;
  onVideoUnavailable?: () => void;
}) {
  const recorder = useActivityRecording({
    context,
    eventItemType: "sentence",
    eventItemIdx: sentenceItemIdx(sentence),
    eventItemLabel: sentence.eng,
    expectedText: sentence.eng
  });
  const nativeAudioRef = useRef<HTMLAudioElement>(null);
  const recordingAudioRef = useRef<HTMLAudioElement>(null);
  const sentenceKey = `${sentence.sentenceIdx ?? sentence.index}:${sentence.eng}`;
  const [phase, setPhase] = useState<"native" | "record" | "review">(sentence.audioUrl ? "native" : "record");
  const [nativeOfferedFor, setNativeOfferedFor] = useState<string | null>(sentence.audioUrl ? sentenceKey : null);
  const [nativeProgress, setNativeProgress] = useState(0);
  const [recordProgress, setRecordProgress] = useState(0);
  const [reviewProgress, setReviewProgress] = useState(0);
  const [isNativePlaying, setIsNativePlaying] = useState(false);
  const [isReviewPlaying, setIsReviewPlaying] = useState(false);

  const mode: SentenceRecordMode = recorder.isRecording
    ? "recording"
    : recorder.recordingUrl
      ? "review"
      : phase === "native" && sentence.audioUrl
        ? "native"
        : "record-ready";
  const progress = mode === "native"
    ? nativeProgress
    : mode === "recording"
      ? recordProgress
      : mode === "review"
        ? reviewProgress
        : 0;
  const recorderError = !["Ready", "Recording...", "Recording saved locally"].includes(recorder.status)
    ? recorder.status
    : "";

  useEffect(() => {
    nativeAudioRef.current?.pause();
    recordingAudioRef.current?.pause();
    setPhase(sentence.audioUrl ? "native" : "record");
    setNativeOfferedFor(sentence.audioUrl ? sentenceKey : null);
    setNativeProgress(0);
    setRecordProgress(0);
    setReviewProgress(0);
    setIsNativePlaying(false);
    setIsReviewPlaying(false);
  }, [sentenceKey]);

  useEffect(() => {
    if (!sentence.audioUrl || nativeOfferedFor === sentenceKey) return;
    setNativeOfferedFor(sentenceKey);
    setPhase("native");
  }, [nativeOfferedFor, sentence.audioUrl, sentenceKey]);

  useEffect(() => {
    recordLearnEvent(context, {
      action: "question_view",
      item_type: "sentence",
      item_idx: sentenceItemIdx(sentence),
      extra: {
        question_index: current + 1,
        sentence: sentence.eng,
        blank_index: parseSentenceTokens(sentence).blankTokenIndex
      }
    });
  }, [context, current, sentence]);

  useEffect(() => {
    if (!recorder.isRecording) return undefined;
    const startedAt = Date.now();
    setRecordProgress(8);
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setRecordProgress(Math.min(94, 8 + (elapsed / 12_000) * 86));
    }, 120);
    return () => window.clearInterval(timer);
  }, [recorder.isRecording]);

  async function toggleNativeVoice() {
    const audio = nativeAudioRef.current;
    if (!audio) {
      setPhase("record");
      return;
    }
    if (!audio.paused) {
      audio.pause();
      setIsNativePlaying(false);
      return;
    }
    if (Number.isFinite(audio.duration) && audio.currentTime >= audio.duration) audio.currentTime = 0;
    setIsNativePlaying(true);
    try {
      await audio.play();
      recordLearnEvent(context, {
        action: "audio_play",
        item_type: "sentence",
        item_idx: sentenceItemIdx(sentence),
        audio_replays: 1,
        extra: { question_index: current + 1, source: "native_voice" }
      });
    } catch {
      setIsNativePlaying(false);
    }
  }

  async function toggleRecordedVoice() {
    const audio = recordingAudioRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      setIsReviewPlaying(false);
      return;
    }
    if (Number.isFinite(audio.duration) && audio.currentTime >= audio.duration) audio.currentTime = 0;
    setIsReviewPlaying(true);
    try {
      await audio.play();
    } catch {
      setIsReviewPlaying(false);
    }
  }

  async function handleMainControl() {
    if (mode === "native") {
      await toggleNativeVoice();
      return;
    }
    if (mode === "review") {
      await toggleRecordedVoice();
      return;
    }

    const result = await recorder.toggleRecording();
    if (result === "started") {
      setPhase("record");
      setReviewProgress(0);
    } else if (result === "stopped") {
      setPhase("review");
      setRecordProgress(100);
      setReviewProgress(0);
    }
  }

  const controlLabel = mode === "native"
    ? isNativePlaying ? "Pause native voice" : "Play native voice"
    : mode === "record-ready"
      ? "Start recording"
      : mode === "recording"
        ? "Stop recording"
        : isReviewPlaying ? "Pause my recording" : "Play my recording";
  const statusLabel = mode === "native"
    ? "Native Voice"
    : mode === "record-ready"
      ? "Your Voice"
      : mode === "recording"
        ? "Recording...."
        : "";

  return (
    <ActivityFrame context={context} actionLabel="Sentence Record" loading={loading} className="figma-renewal-frame">
      <div className={`figma-renewal-shell sentence-record-renewal-shell${usesVideoBackground ? ` strc02-video-sentence-record-shell${videoUnavailable ? " is-video-background-unavailable" : ""}` : ""}`}>
        {usesVideoBackground ? (
          <>
            <VideoActivityBackground className="strc02-background-video" onUnavailable={onVideoUnavailable || (() => undefined)} url={videoUrl} />
            <span aria-hidden="true" className="strc02-background-scrim" />
            <VideoActivityProgress currentIndex={current} total={total} />
          </>
        ) : null}
        <ActivityQuestionNavigation
          current={current}
          disableNext={recorder.isRecording}
          disablePrev={recorder.isRecording}
          onChange={onChange}
          total={total}
          variant={usesVideoBackground ? "video" : "standard"}
        />
        <div className="sentence-record-renewal-panel">
          <div className="sentence-record-meta" aria-label="Activity settings">
            <span><Gauge aria-hidden="true" />Speed: Normal</span>
            <span><BarChart3 aria-hidden="true" />Difficulty: Normal</span>
          </div>
          {usesVideoBackground ? null : <RenewalCounter className="sentence-record-counter" current={current + 1} total={total} />}
          <SentenceRecordPrompt sentence={sentence} />
          <div className={`sentence-record-media is-${mode}`}>
            {statusLabel ? <span className="sentence-record-status-label">{statusLabel}</span> : null}
            <span className={`sentence-record-step-check${recorder.recordingUrl ? " is-complete" : ""}`} aria-hidden="true">
              <Check />
            </span>
            <div className="sentence-record-track">
              <span className="sentence-record-progress" style={{ width: `${Math.max(8, progress)}%` }} />
              {mode === "recording" ? (
                <span className="sentence-record-waveform" aria-hidden="true">
                  {READ_RECORD_WAVEFORM.slice(0, 34).map((height, barIndex) => (
                    <i key={`${height}:${barIndex}`} style={{ "--bar-height": `${height}%`, "--bar-index": barIndex } as CSSProperties} />
                  ))}
                </span>
              ) : null}
              <button
                aria-label={controlLabel}
                className={`sentence-record-main-control${isNativePlaying || isReviewPlaying ? " is-playing" : ""}`}
                onClick={() => void handleMainControl()}
                type="button"
              >
                {mode === "native" ? <ActivityListeningImage /> : null}
                {mode === "record-ready" || mode === "recording" ? <Mic aria-hidden="true" /> : null}
                {mode === "review" && isReviewPlaying ? <Pause aria-hidden="true" fill="currentColor" /> : null}
                {mode === "review" && !isReviewPlaying ? <Play aria-hidden="true" fill="currentColor" /> : null}
              </button>
            </div>
            {recorderError ? <p className="sentence-record-error" role="status">{recorderError}</p> : null}
          </div>
          {sentence.audioUrl ? (
            <audio
              onEnded={() => {
                setIsNativePlaying(false);
                setNativeProgress(100);
                setPhase("record");
              }}
              onPause={() => setIsNativePlaying(false)}
              onTimeUpdate={(event) => setNativeProgress(mediaProgress(event.currentTarget))}
              preload="metadata"
              ref={nativeAudioRef}
              src={sentence.audioUrl}
            />
          ) : null}
          {recorder.recordingUrl ? (
            <audio
              onEnded={() => {
                setIsReviewPlaying(false);
                setReviewProgress(100);
              }}
              onPause={() => setIsReviewPlaying(false)}
              onTimeUpdate={(event) => setReviewProgress(mediaProgress(event.currentTarget))}
              preload="metadata"
              ref={recordingAudioRef}
              src={recorder.recordingUrl}
            />
          ) : null}
        </div>
      </div>
    </ActivityFrame>
  );
}

function SentenceRecordPrompt({ sentence }: { sentence: LoadedSentence }) {
  const promptRef = useRef<HTMLDivElement>(null);
  const [isWrapped, setIsWrapped] = useState(false);
  const parsed = useMemo(() => parseSentenceTokens(sentence), [sentence]);
  const hasBlank = parsed.blankTokenIndex >= 0;
  const prefix = hasBlank ? formatSentence(parsed.tokens.slice(0, parsed.blankTokenIndex)) : sentence.eng;
  const suffix = hasBlank ? formatSentence(parsed.tokens.slice(parsed.blankTokenIndex + 1)) : "";

  useLayoutEffect(() => {
    const element = promptRef.current;
    if (!element) return undefined;
    let animationFrame = 0;
    const updateWrappedState = () => {
      const styles = window.getComputedStyle(element);
      const lineHeight = Number.parseFloat(styles.lineHeight) || 52;
      const minimumHeight = Number.parseFloat(styles.minHeight) || 0;
      const blankHeight = element.querySelector<HTMLElement>(".sentence-record-blank")?.getBoundingClientRect().height || 0;
      const singleLineHeight = Math.max(lineHeight, minimumHeight, blankHeight);
      const wrapped = element.scrollHeight > singleLineHeight + 2;
      setIsWrapped((current) => current === wrapped ? current : wrapped);
    };
    const scheduleUpdate = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(updateWrappedState);
    };
    updateWrappedState();
    scheduleUpdate();
    const resizeObserver = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(scheduleUpdate);
    resizeObserver?.observe(element);
    const panel = element.closest<HTMLElement>(".sentence-record-renewal-panel");
    if (panel) resizeObserver?.observe(panel);
    window.addEventListener("resize", scheduleUpdate);
    void document.fonts?.ready.then(scheduleUpdate);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [prefix, suffix]);

  return (
    <div
      className={`sentence-record-prompt${isWrapped ? " is-wrapped" : ""}`}
      ref={promptRef}
      style={{ "--sentence-record-blank-length": Math.max(3, parsed.blankToken.length) } as CSSProperties}
    >
      <span>{prefix}</span>
      {hasBlank ? <>{" "}<span className="sentence-record-blank" aria-label="Missing word" /></> : null}
      {suffix ? <>{/^[.,!?]/.test(suffix) ? null : " "}<span>{suffix}</span></> : null}
    </div>
  );
}

export function PendingActivity({ context }: { context: ActivityRendererContext }) {
  const definition = getActTypeDefinition(context.activity?.actType);

  return (
    <ActivityFrame context={context} actionLabel="Pending">
      <div className="pending-panel">
        <RotateCcw size={42} />
        <div>
          <h3>{definition?.label || "Renderer not ported yet"}</h3>
          <p>
            Act code <code>{context.activity?.activityCode || context.activity?.actType || "unknown"}</code>
            {definition?.unityName ? <> maps to Unity <code>{definition.unityName}</code>.</> : " is preserved from the Unity package."}
          </p>
          {definition ? <p className="muted">Port status: {definition.status}. {definition.webStrategy}</p> : null}
        </div>
      </div>
    </ActivityFrame>
  );
}

function WordCard({ word }: { word: LoadedWord }) {
  return (
    <article className="word-card">
      {word.imageUrl ? <img src={word.imageUrl} alt={word.eng} /> : <ResourceMissing label="word image" />}
      <div>
        <strong>{word.eng}</strong>
        <span>{word.wordClass}</span>
        <p>{word.mean}</p>
      </div>
      {word.audioUrl ? (
        <audio src={word.audioUrl} controls />
      ) : (
        <button type="button" disabled>
          <Volume2 size={16} /> No audio
        </button>
      )}
    </article>
  );
}

function useActivityRecording({
  context,
  eventItemType = "recording",
  eventItemIdx = null,
  eventItemLabel,
  expectedText
}: {
  context?: ActivityRendererContext;
  eventItemType?: LearnEventInput["item_type"];
  eventItemIdx?: number | null;
  eventItemLabel?: string;
  expectedText?: string;
}) {
  const [status, setStatus] = useState("Ready");
  const [recordingUrl, setRecordingUrl] = useState<string>();
  const [isRecording, setIsRecording] = useState(false);
  const recordingStartedAtRef = useRef<number>();
  const recordingUrlRef = useRef<string>();
  const isRecordingRef = useRef(false);

  async function toggleRecording() {
    try {
      if (browserRecorderPort.isRecording()) {
        const blob = await browserRecorderPort.stop();
        isRecordingRef.current = false;
        setIsRecording(false);
        const timeMs = recordingStartedAtRef.current ? Date.now() - recordingStartedAtRef.current : undefined;
        recordingStartedAtRef.current = undefined;
        if (blob) {
          if (recordingUrlRef.current) URL.revokeObjectURL(recordingUrlRef.current);
          const nextRecordingUrl = URL.createObjectURL(blob);
          recordingUrlRef.current = nextRecordingUrl;
          setRecordingUrl(nextRecordingUrl);
          setStatus("Recording saved locally");
          let recordingUpload: unknown;
          let recordingUploadError: string | undefined;
          if (context?.studyLogIdx) {
            try {
              const audioBase64 = await blobToDataUrl(blob);
              recordingUpload = await uploadLearnRecording({
                log_idx: context.studyLogIdx,
                item_type: recordingUploadItemType(eventItemType),
                ...(eventItemIdx != null ? { item_idx: eventItemIdx } : {}),
                audio_base64: audioBase64,
                content_type: blob.type || "audio/webm",
                duration_ms: timeMs
              });
            } catch (error) {
              recordingUploadError = error instanceof Error ? error.message : "Recording upload failed";
            }
          }
          let recognitionResult: unknown;
          let recognitionError: string | undefined;
          try {
            recognitionResult = await bffRecognitionPort.recognizeSpeech(blob, expectedText);
          } catch (error) {
            recognitionError = error instanceof Error ? error.message : "Recognition proxy unavailable";
            setStatus(recognitionError);
          }
          if (!recognitionError) setStatus("Recording saved locally");
          if (context) {
            recordLearnEvent(context, {
              action: "record_stop",
              item_type: eventItemType,
              item_idx: eventItemIdx,
              extra: {
                text: eventItemLabel || expectedText,
                expected_text: expectedText,
                duration_ms: timeMs,
                content_type: blob.type,
                blob_size: blob.size,
                s3_key: recordingS3Key(recordingUpload),
                recording_upload: recordingUploadSummary(recordingUpload),
                recording_upload_error: recordingUploadError,
                recognition_result: recognitionResult,
                recognition_error: recognitionError
              }
            });
          }
        }
        return "stopped" as const;
      }

      await browserRecorderPort.start();
      isRecordingRef.current = true;
      setIsRecording(true);
      recordingStartedAtRef.current = Date.now();
      setStatus("Recording...");
      if (context) {
        recordLearnEvent(context, {
          action: "record_start",
          item_type: eventItemType,
          item_idx: eventItemIdx,
          extra: {
            text: eventItemLabel || expectedText,
            expected_text: expectedText
          }
        });
      }
      return "started" as const;
    } catch (error) {
      isRecordingRef.current = false;
      setIsRecording(false);
      setStatus(error instanceof Error ? error.message : "Microphone permission failed");
      return "failed" as const;
    }
  }

  useEffect(() => {
    return () => {
      if (recordingUrlRef.current) URL.revokeObjectURL(recordingUrlRef.current);
      if (isRecordingRef.current && browserRecorderPort.isRecording()) {
        void browserRecorderPort.stop().catch(() => undefined);
      }
    };
  }, []);

  return { isRecording, recordingUrl, status, toggleRecording };
}

function mediaProgress(media: HTMLMediaElement): number {
  if (!Number.isFinite(media.duration) || media.duration <= 0) return 0;
  return Math.max(0, Math.min(100, (media.currentTime / media.duration) * 100));
}

function RecordPanel({
  context,
  eventItemType = "recording",
  eventItemIdx = null,
  eventItemLabel,
  title,
  detail,
  mediaUrl,
  expectedText
}: {
  context?: ActivityRendererContext;
  eventItemType?: LearnEventInput["item_type"];
  eventItemIdx?: number | null;
  eventItemLabel?: string;
  title: string;
  detail: string;
  mediaUrl?: string;
  expectedText?: string;
}) {
  const recorder = useActivityRecording({ context, eventItemType, eventItemIdx, eventItemLabel, expectedText });

  return (
    <div className="record-shell package-record">
      <button className="round-media-button record" onClick={() => void recorder.toggleRecording()} aria-label="Toggle recording" type="button">
        <Mic size={36} />
      </button>
      <div>
        <h3>{title}</h3>
        <p>{detail}</p>
        {mediaUrl ? <audio src={mediaUrl} controls /> : null}
        <p className="muted">{recorder.status}</p>
        {recorder.recordingUrl ? <audio src={recorder.recordingUrl} controls /> : null}
      </div>
    </div>
  );
}

function useActivityRecorder(expectedText?: string) {
  const [status, setStatus] = useState("Ready");
  const [recordingUrl, setRecordingUrl] = useState<string>();
  const [isRecording, setIsRecording] = useState(false);

  async function toggleRecording() {
    try {
      if (browserRecorderPort.isRecording()) {
        const blob = await browserRecorderPort.stop();
        setIsRecording(false);
        if (blob) {
          if (recordingUrl) URL.revokeObjectURL(recordingUrl);
          const nextUrl = URL.createObjectURL(blob);
          setRecordingUrl(nextUrl);
          setStatus("Recording saved locally");
          try {
            await bffRecognitionPort.recognizeSpeech(blob, expectedText);
          } catch (error) {
            setStatus(error instanceof Error ? error.message : "Recognition proxy unavailable");
          }
        }
        return;
      }

      await browserRecorderPort.start();
      setIsRecording(true);
      setStatus("Recording...");
    } catch (error) {
      setIsRecording(false);
      setStatus(error instanceof Error ? error.message : "Microphone permission failed");
    }
  }

  useEffect(() => {
    return () => {
      if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    };
  }, [recordingUrl]);

  return { status, recordingUrl, isRecording, toggleRecording };
}

function selectReadingPageWords(words: LoadedWord[], pageIndex: number): LoadedWord[] {
  if (words.length <= 3) return words;
  const start = (pageIndex * 3) % words.length;
  const selected = words.slice(start, start + 3);
  return selected.length === 3 ? selected : [...selected, ...words.slice(0, 3 - selected.length)];
}

function ResourceMissing({ label }: { label: string }) {
  return (
    <div className="resource-missing">
      <ImageOff size={34} />
      <span>Missing {label}</span>
    </div>
  );
}

function useReadingAssets(context: ActivityRendererContext) {
  const base = dayBase(context);
  const folder = paramFolder(context.activity);
  const readingPrefix = `${base}/reading/${folder}/`;
  const readingPathState = usePackagePathListState(context, readingPrefix);
  const readingPaths = readingPathState.paths;
  const infoState = usePackageJsonState<StoryInfo>(context, `${base}/story/info_story.json`);
  const info = infoState.data;
  const scripts = info?.story?.scripts || [];
  const storyPathState = usePackagePathListState(context, `${base}/story/`);
  const storyPaths = storyPathState.paths;
  const readingImagePaths = useMemo(
    () => readingPaths.filter((path) => /\/img\/img_\d+\.png$/i.test(path)).sort(naturalPathCompare),
    [readingPaths]
  );
  const readingAudioPaths = useMemo(
    () => readingPaths.filter((path) => /\/snd\/snd_\d+_\d+\.mp3$/i.test(path)).sort(naturalPathCompare),
    [readingPaths]
  );
  const storyImagePaths = useMemo(
    () =>
      scripts.length > 0
        ? scripts.map((script, index) => `${base}/story/page/img_page_${twoDigit(Number(script.Page || index + 1))}.png`)
        : storyPaths.filter((path) => /\/page\/img_page_\d+\.png$/i.test(path)).sort(naturalPathCompare),
    [base, scripts, storyPaths]
  );
  const storyAudioPaths = useMemo(
    () =>
      scripts.length > 0
        ? scripts.map((_, index) => `${base}/story/snd/snd_script_${twoDigit(index + 1)}.mp3`)
        : storyPaths.filter((path) => /\/snd\/snd_script_\d+\.mp3$/i.test(path)).sort(naturalPathCompare),
    [base, scripts, storyPaths]
  );
  const imagePaths = readingImagePaths.length > 0 ? readingImagePaths : storyImagePaths;
  const audioPaths = readingImagePaths.length > 0 ? readingAudioPaths : storyAudioPaths;
  const imageState = usePackageUrlsState(context, imagePaths);
  const audioState = usePackageUrlsState(context, audioPaths);
  const imageMap = imageState.urls;
  const audioMap = audioState.urls;
  const imagesDecoded = useDecodedImageUrls(Object.values(imageMap));
  const isLoading = isCachedResourceLoading(context, readingPathState, infoState, storyPathState, imageState, audioState) || !imagesDecoded;

  const pages: LoadedReadingPage[] = imagePaths.map((imagePath, index) => {
    const pageAudioPaths =
      readingImagePaths.length > 0
        ? readingAudioPaths.filter((path) => readingAudioPage(path) === index + 1)
        : [storyAudioPaths[index]].filter(Boolean);

    return {
      index,
      imagePath,
      imageUrl: imageMap[imagePath],
      audioUrls: pageAudioPaths.map((path) => audioMap[path]).filter(Boolean),
      script: scripts[index]
    };
  });

  return {
    status: isLoading ? "loading" : imagePaths.length > 0 ? "ready" : "empty",
    pages,
    sourcePath: readingImagePaths.length > 0 ? readingPrefix : imagePaths.length > 0 ? `${base}/story/` : undefined
  };
}

function useListenEbookAssets(context: ActivityRendererContext): LoadedListenEbook {
  const base = dayBase(context);
  const folder = paramFolder(context.activity);
  const ebookBase = `${base}/ebook`;
  const readingPrefix = `${base}/reading/${folder}/`;
  const key = context.packageMeta?.key;
  const knownCaptionPages = useMemo(() => knownListenCaptionPages(context.packageMeta?.bookId), [context.packageMeta?.bookId]);
  const canonicalState = usePackageJsonState<CanonicalListenEbook>(context, `${ebookBase}/book.json`);
  const infoState = usePackageJsonState<ListenEbookInfo>(context, `${base}/listening/${folder}/info_listen_ebook.json`);
  const sentenceInfo = usePackageJson<SentenceInfo>(context, `${base}/sentence/info_sentence.json`);
  const bookTitle = packageBookTitle(context.packageMeta);
  const sentenceTexts = useMemo(() => sentenceInfoToCaptionTexts(sentenceInfo), [sentenceInfo]);
  const canonicalBook = canonicalState.data;
  const info = infoState.data;
  const readingPathState = usePackagePathListState(context, readingPrefix);
  const readingPaths = readingPathState.paths;
  const sourcePages = useMemo<ListenEbookPageInfo[]>(() => {
    const canonicalPages = canonicalListenEbookPages(canonicalBook, ebookBase);
    if (canonicalPages.length > 0) return canonicalPages;

    const readingImagePaths = readingPaths.filter((path) => /\/img\/img_\d+\.png$/i.test(path)).sort(naturalPathCompare);
    const readingAudioPaths = readingPaths.filter((path) => /\/snd\/snd_\d+_\d+\.mp3$/i.test(path)).sort(naturalPathCompare);
    const infoPages = info?.pages || [];
    const infoImagePaths = (info?.pages || []).map((page) => page.imagePath).filter(Boolean) as string[];
    const pageImagePaths = infoImagePaths.length > 0 ? infoImagePaths : readingImagePaths;
    const infoPageByIndex = new Map(infoPages.map((page, fallbackIndex) => [page.pageIndex ?? fallbackIndex, page]));

    if (pageImagePaths.length > 0 && readingAudioPaths.length > 0) {
      const readingAudioCounts = pageImagePaths.map((_, index) =>
        readingAudioPaths.filter((path) => readingAudioPage(path) === index + 1).length
      );
      const fallbackCaptionPages = buildFallbackListenCaptionPages(
        bookTitle,
        sentenceTexts,
        pageImagePaths.length,
        readingAudioCounts,
        knownCaptionPages
      );
      return pageImagePaths.map((imagePath, index) => {
        const pageNumber = index + 1;
        const audioPaths = readingAudioPaths.filter((path) => readingAudioPage(path) === pageNumber);
        const infoPage = infoPageByIndex.get(index);
        const infoAudioPaths = infoPage?.audioPaths || [];
        const infoMatchesReadingAudio =
          audioPaths.length > 0 &&
          infoAudioPaths.length === audioPaths.length &&
          infoAudioPaths.every((path, audioIndex) => path === audioPaths[audioIndex]);
        const fallbackCaptions = buildListenCaptionCues(index, audioPaths.length, fallbackCaptionPages[index] || []);
        return {
          pageIndex: index,
          imagePath,
          audioPaths,
          captionPaths: infoMatchesReadingAudio ? infoPage?.captionPaths || [] : [],
          captions: infoMatchesReadingAudio && infoPage?.captions?.length ? infoPage.captions : fallbackCaptions
        };
      });
    }

    if (info?.pages?.length) return info.pages;

    const readingAudioCounts = readingImagePaths.map((_, index) =>
      readingAudioPaths.filter((path) => readingAudioPage(path) === index + 1).length
    );
    const fallbackCaptionPages = buildFallbackListenCaptionPages(
      bookTitle,
      sentenceTexts,
      readingImagePaths.length,
      readingAudioCounts,
      knownCaptionPages
    );

    return readingImagePaths.map((imagePath, index) => {
      const pageNumber = index + 1;
      const audioPaths = readingAudioPaths.filter((path) => readingAudioPage(path) === pageNumber);
      return {
        pageIndex: index,
        imagePath,
        audioPaths,
        captionPaths: [],
        captions: buildListenCaptionCues(index, audioPaths.length, fallbackCaptionPages[index] || [])
      };
    });
  }, [bookTitle, canonicalBook, ebookBase, info, knownCaptionPages, readingPaths, sentenceTexts]);
  const imagePaths = useMemo(() => sourcePages.map((page) => page.imagePath).filter(Boolean) as string[], [sourcePages]);
  const audioPaths = useMemo(() => sourcePages.flatMap((page) => page.audioPaths || []), [sourcePages]);
  const imageState = usePackageUrlsState(context, imagePaths);
  const audioState = usePackageUrlsState(context, audioPaths);
  const imageMap = imageState.urls;
  const audioMap = audioState.urls;
  const imagesDecoded = useDecodedImageUrls(Object.values(imageMap));
  const [parsedCaptionCues, setParsedCaptionCues] = useState<Record<string, ListenCaptionCue[]>>({});

  useEffect(() => {
    let active = true;
    setParsedCaptionCues({});
    if (!key || sourcePages.length === 0) return undefined;

    const jobs = sourcePages.flatMap((page, pageIndex) =>
      (page.captionPaths || []).map(async (captionPath) => {
        const blob = await indexedDbStorage.getFileBlob(key, captionPath);
        const text = blob ? await readBlobText(blob) : undefined;
        if (!text) return [captionPath, []] as const;
        const cues = parseCaptionCues(text, captionPath, { pageIndex, audioIndex: 0 });
        return [captionPath, cues] as const;
      })
    );

    if (jobs.length === 0) return undefined;
    Promise.all(jobs)
      .then((entries) => {
        if (active) setParsedCaptionCues(Object.fromEntries(entries));
      })
      .catch(() => {
        if (active) setParsedCaptionCues({});
      });

    return () => {
      active = false;
    };
  }, [key, sourcePages]);

  const pages = useMemo(
    () =>
      sourcePages.map((page, fallbackIndex) => {
        const pageIndex = page.pageIndex ?? fallbackIndex;
        const captionFileCues = (page.captionPaths || []).flatMap((path) => parsedCaptionCues[path] || []);
        const captions = captionFileCues.length > 0 ? captionFileCues : page.captions || [];
        return {
          pageIndex,
          bookPage: page.bookPage,
          pdfPage: page.pdfPage,
          imagePath: page.imagePath,
          imageUrl: page.imagePath ? imageMap[page.imagePath] : undefined,
          audioPaths: page.audioPaths || [],
          audioUrls: (page.audioPaths || []).map((path) => audioMap[path]).filter(Boolean),
          captionPaths: page.captionPaths || [],
          captions: captions.map((cue) => ({
            ...cue,
            pageIndex: cue.pageIndex ?? pageIndex
          })),
          imgW: page.imgW,
          imgH: page.imgH,
          label: page.label,
          words: page.words
        };
      }),
    [audioMap, imageMap, parsedCaptionCues, sourcePages]
  );

  return {
    checked:
      canonicalState.checked &&
      (canonicalBook ? true : infoState.checked && readingPathState.checked) &&
      imageState.checked &&
      audioState.checked &&
      imagesDecoded,
    pages,
    fallbackVideoPaths: info?.fallbackVideoPaths || []
  };
}

function canonicalListenEbookPages(book: CanonicalListenEbook | undefined, ebookBase: string): ListenEbookPageInfo[] {
  const pages = Array.isArray(book?.pages) ? book.pages : [];
  return pages
    .map((page, index) => {
      const imagePath = resolveEbookVirtualPath(ebookBase, firstString(page.img, page.image, page.imagePath, page.page));
      const audioPaths = firstStringArray(page.audioPaths, page.audio, page.audios)
        .map((path) => resolveEbookVirtualPath(ebookBase, path))
        .filter(Boolean);
      const captions = normalizeCanonicalCaptions(page.captions || page.cues || [], index);
      return {
        pageIndex: Number.isFinite(Number(page.pageIndex)) ? Number(page.pageIndex) : index,
        bookPage: page.bookPage ?? page.pageNo ?? index + 1,
        pdfPage: page.pdfPage,
        imagePath,
        audioPaths,
        captionPaths: [],
        captions,
        imgW: Number(page.imgW || page.width || 0) || undefined,
        imgH: Number(page.imgH || page.height || 0) || undefined,
        label: page.label,
        words: normalizeCanonicalListenWords(page.words)
      };
    })
    .filter((page) => page.imagePath || page.audioPaths.length > 0);
}

function normalizeCanonicalListenWords(words: CanonicalListenEbookWord[] | undefined): ListenViewerWord[] {
  return (words || [])
    .map((word) => {
      const text = firstString(word.w, word.text);
      const t0 = word.t0 == null ? null : Number(word.t0);
      const t1 = word.t1 == null ? null : Number(word.t1);
      return {
        w: text,
        x: Number(word.x || 0),
        y: Number(word.y || 0),
        bw: Number(word.bw || 0),
        bh: Number(word.bh || 0),
        t0: Number.isFinite(t0) ? t0 : null,
        t1: Number.isFinite(t1) ? t1 : null,
        body: word.body !== false,
        read: word.read !== false
      };
    })
    .filter((word) => Boolean(word.w));
}

function resolveEbookVirtualPath(ebookBase: string, path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized) return "";
  if (/^https?:\/\//i.test(normalized)) return normalized;
  if (/^Lessons\//i.test(normalized)) return normalized;
  if (normalized.toLowerCase().startsWith(`${ebookBase.toLowerCase()}/`)) return normalized;
  if (normalized.toLowerCase().startsWith("ebook/")) return `${ebookBase}/${normalized.slice("ebook/".length)}`;
  return `${ebookBase}/${normalized}`;
}

function normalizeCanonicalCaptions(captions: ListenCaptionCue[], pageIndex: number): ListenCaptionCue[] {
  return (captions || [])
    .filter((cue) => cue && cue.text)
    .map((cue) => ({
      ...cue,
      pageIndex: cue.pageIndex ?? pageIndex,
      audioIndex: cue.audioIndex ?? 0,
      startMs: Number(cue.startMs || 0),
      endMs: Number(cue.endMs || 3600000)
    }));
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function firstStringArray(...values: unknown[]): string[] {
  for (const value of values) {
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
    if (typeof value === "string" && value.trim()) return [value.trim()];
  }
  return [];
}

function useWords(context: ActivityRendererContext): LoadedWord[] {
  return useWordsState(context).words;
}

type WordResourceState = {
  words: LoadedWord[];
  status: "loading" | "ready" | "empty" | "error";
};

function useWordsState(context: ActivityRendererContext): WordResourceState {
  const base = dayBase(context);
  const infoState = usePackageJsonState<WordInfo>(context, `${base}/word/info_word.json`);
  const pathState = usePackagePathListState(context, `${base}/word/`);
  const info = infoState.data;
  const paths = pathState.paths;
  const selectedIndexes = context.activity?.useWordList;
  const sourceWords = info?.word || [];
  const indexes = selectedIndexes && selectedIndexes.length > 0 ? selectedIndexes : sourceWords.map((_, index) => index);

  const wordRecords = indexes
    .map((wordIndex) => {
      const word = sourceWords[wordIndex];
      if (!word) return undefined;
      const imagePath = findExistingPath(paths, [
        `${base}/word/img/${word.Eng}.png`,
        `${base}/word/img/word_${twoDigit(wordIndex + 1)}.png`
      ]);
      const audioPath = findExistingPath(paths, [
        `${base}/word/snd/snd_${word.Eng}.mp3`,
        `${base}/word/snd/snd_word_${twoDigit(wordIndex + 1)}.mp3`
      ]);
      return {
        index: wordIndex,
        wordIdx: numberOrUndefined(word.Word_Idx ?? word.word_idx ?? word.wordIdx),
        eng: word.Eng || "",
        mean: word.Mean || "",
        sentence: word.Sentence || "",
        wordClass: word.WordClass || "",
        imagePath,
        audioPath
      };
    })
    .filter(Boolean) as Array<LoadedWord & { imagePath?: string; audioPath?: string }>;

  const imageState = usePackageUrlsState(
    context,
    wordRecords.map((word) => word.imagePath).filter(Boolean) as string[]
  );
  const audioState = usePackageUrlsState(
    context,
    wordRecords.map((word) => word.audioPath).filter(Boolean) as string[]
  );
  const imageUrlSignature = Object.values(imageState.urls).join("|");
  const [imagesDecoded, setImagesDecoded] = useState(false);

  useEffect(() => {
    let active = true;
    setImagesDecoded(false);
    if (!imageState.checked) return undefined;

    const imageUrls = Object.values(imageState.urls);
    if (imageUrls.length === 0 || typeof Image === "undefined") {
      setImagesDecoded(true);
      return undefined;
    }

    void Promise.all(imageUrls.map((url) => decodeImage(url))).finally(() => {
      if (active) setImagesDecoded(true);
    });

    return () => {
      active = false;
    };
  }, [imageState.checked, imageUrlSignature]);

  const checked = infoState.checked && pathState.checked && imageState.checked && audioState.checked && imagesDecoded;
  const hasLoadError = infoState.error || pathState.error || imageState.error || audioState.error;
  const status: WordResourceState["status"] = !checked
    ? "loading"
    : wordRecords.length === 0
      ? hasLoadError ? "error" : "empty"
      : "ready";

  return {
    status,
    words: wordRecords.map((word) => ({
      index: word.index,
      wordIdx: word.wordIdx,
      eng: word.eng,
      mean: word.mean,
      sentence: word.sentence,
      wordClass: word.wordClass,
      imagePath: word.imagePath,
      imageUrl: word.imagePath ? imageState.urls[word.imagePath] : undefined,
      audioPath: word.audioPath,
      audioUrl: word.audioPath ? audioState.urls[word.audioPath] : undefined
    }))
  };
}

function decodeImage(url: string): Promise<void> {
  if (typeof Image === "undefined") return Promise.resolve();
  const image = new Image();
  image.src = url;
  if (typeof image.decode !== "function") return Promise.resolve();
  return image.decode().catch(() => undefined);
}

/**
 * The resource URL exists before the browser has decoded the bitmap. Keep the
 * shared activity loader present until the visible image can be painted.
 */
function useDecodedImageUrls(urls: Array<string | undefined>): boolean {
  const signature = useMemo(
    () => Array.from(new Set(urls.filter((url): url is string => Boolean(url)))).join("|"),
    [urls.join("|")]
  );
  const [decodedSignature, setDecodedSignature] = useState<string>();

  useEffect(() => {
    let active = true;
    if (!signature || typeof Image === "undefined") {
      setDecodedSignature(signature);
      return undefined;
    }

    setDecodedSignature(undefined);
    void Promise.all(signature.split("|").map((url) => decodeImage(url))).finally(() => {
      if (active) setDecodedSignature(signature);
    });

    return () => {
      active = false;
    };
  }, [signature]);

  return !signature || decodedSignature === signature;
}

function isCachedResourceLoading(
  context: ActivityRendererContext,
  ...states: Array<{ checked: boolean } | undefined>
): boolean {
  return Boolean(context.packageMeta?.key) && states.some((state) => state != null && !state.checked);
}

function useSentences(context: ActivityRendererContext): LoadedSentence[] {
  return useSentencesState(context).sentences;
}

type SentenceResourceState = {
  sentences: LoadedSentence[];
  status: "loading" | "ready" | "empty" | "error";
};

function useSentencesState(context: ActivityRendererContext): SentenceResourceState {
  const base = dayBase(context);
  const infoState = usePackageJsonState<SentenceInfo>(context, `${base}/sentence/info_sentence.json`);
  const pathState = usePackagePathListState(context, `${base}/sentence/snd/`);
  const info = infoState.data;
  const paths = pathState.paths;
  const sentences = info?.sentence || [];
  const audioPaths = sentences.map((_, index) => findExistingPath(paths, [`${base}/sentence/snd/snd_sentence_${twoDigit(index + 1)}.mp3`]));
  const audioState = usePackageUrlsState(context, audioPaths.filter(Boolean) as string[]);
  const checked = infoState.checked && pathState.checked && audioState.checked;
  const hasLoadError = infoState.error || pathState.error || audioState.error;
  const status: SentenceResourceState["status"] = !checked
    ? "loading"
    : sentences.length === 0
      ? hasLoadError ? "error" : "empty"
      : "ready";

  return {
    status,
    sentences: sentences.map((sentence, index) => ({
      index,
      sentenceIdx: numberOrUndefined(sentence.Sentence_Idx ?? sentence.sentence_idx ?? sentence.sentenceIdx),
      eng: sentence.Eng || "",
      mean: sentence.Mean || "",
      slice: sentence.Slice || "",
      blankIndex: sentence.Blank_Index ?? -1,
      audioPath: audioPaths[index] || undefined,
      audioUrl: audioPaths[index] ? audioState.urls[audioPaths[index] as string] : undefined
    }))
  };
}

function usePackageTextList(context: ActivityRendererContext, paths: string[]): Record<string, string> {
  const key = context.packageMeta?.key;
  const stablePaths = useMemo(() => Array.from(new Set(paths.filter(Boolean))).sort(), [paths.join("|")]);
  const [texts, setTexts] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    setTexts({});
    if (!key || stablePaths.length === 0) return undefined;

    Promise.all(
      stablePaths.map(async (path) => {
        const blob = await indexedDbStorage.getFileBlob(key, path);
        return blob ? ([path, await readBlobText(blob)] as const) : undefined;
      })
    )
      .then((entries) => {
        if (!active) return;
        setTexts(Object.fromEntries(entries.filter(Boolean) as Array<readonly [string, string]>));
      })
      .catch(() => {
        if (active) setTexts({});
      });

    return () => {
      active = false;
    };
  }, [key, stablePaths]);

  return texts;
}

function normalizeMovieCaptionCues(cues: MovieCaptionCue[], durationMs: number, useGeneratedTiming = false): MovieCaptionCue[] {
  const sorted = cues
    .filter((cue) => cue.text.trim())
    .map((cue) => ({ ...cue, text: cue.text.replace(/\s+/g, " ").trim() }))
    .sort((left, right) => left.startMs - right.startMs);
  if (sorted.length === 0) return [];

  const hasRealTiming = !useGeneratedTiming && sorted.some((cue) => cue.startMs > 0 || cue.endMs < 59000);
  if (hasRealTiming) return sorted;

  const cueDuration = Math.max(2500, Math.floor((durationMs || sorted.length * 5000) / sorted.length));
  return sorted.map((cue, index) => ({
    ...cue,
    startMs: index * cueDuration,
    endMs: (index + 1) * cueDuration
  }));
}

function findMovieCueIndex(cues: MovieCaptionCue[], currentMs: number): number {
  if (cues.length === 0) return -1;
  const exactIndex = cues.findIndex((cue) => currentMs >= cue.startMs && currentMs < cue.endMs);
  if (exactIndex >= 0) return exactIndex;
  const nextIndex = cues.findIndex((cue) => cue.startMs > currentMs);
  return nextIndex < 0 ? cues.length - 1 : Math.max(0, nextIndex - 1);
}

function movieScriptWindow(cues: MovieCaptionCue[], activeIndex: number): Array<{ cue: MovieCaptionCue; index: number }> {
  if (activeIndex < 0) return cues.slice(0, 3).map((cue, index) => ({ cue, index }));
  const start = Math.max(0, activeIndex - 1);
  return cues.slice(start, start + 3).map((cue, offset) => ({ cue, index: start + offset }));
}

function highlightMovieCue(cue: MovieCaptionCue, currentMs: number, active: boolean): ReactNode {
  if (!active) return cue.text;
  const timedWords = cue.words?.filter((word) => word.text.trim() && word.endMs > word.startMs) || [];
  if (timedWords.length === 0) return <mark>{cue.text}</mark>;

  let wordIndex = 0;
  return cue.text.split(/(\s+)/).map((token, index) => {
    if (!token.trim()) return token;
    const timing = timedWords[wordIndex];
    wordIndex += 1;
    const isActiveWord = Boolean(timing && currentMs >= timing.startMs && currentMs < timing.endMs);
    return isActiveWord ? <mark key={`${token}:${index}`}>{token}</mark> : token;
  });
}

function usePackageJson<T>(context: ActivityRendererContext, path?: string): T | undefined {
  return usePackageJsonState<T>(context, path).data;
}

function usePackageJsonState<T>(context: ActivityRendererContext, path?: string): { data?: T; checked: boolean; error: boolean } {
  const key = context.packageMeta?.key;
  const [data, setData] = useState<T>();
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setData(undefined);
    setChecked(false);
    setError(false);
    if (!key || !path) {
      setChecked(true);
      return undefined;
    }

    indexedDbStorage
      .getFileBlob(key, path)
      .then((blob) => (blob ? readBlobText(blob) : undefined))
      .then((text) => (text ? JSON.parse(text) : undefined))
      .then((json) => {
        if (active) {
          setData(json as T | undefined);
          setChecked(true);
        }
      })
      .catch(() => {
        if (active) {
          setData(undefined);
          setChecked(true);
          setError(true);
        }
      });

    return () => {
      active = false;
    };
  }, [key, path]);

  return { data, checked, error };
}

function usePackagePathList(context: ActivityRendererContext, prefix: string): string[] {
  return usePackagePathListState(context, prefix).paths;
}

function usePackagePathListState(context: ActivityRendererContext, prefix: string): { paths: string[]; checked: boolean; error: boolean } {
  const key = context.packageMeta?.key;
  const storedPaths = context.packageMeta?.filePaths;
  const [paths, setPaths] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setPaths([]);
    setChecked(false);
    setError(false);
    if (!key) {
      setChecked(true);
      return undefined;
    }

    getCachedPackagePaths(key, storedPaths)
      .then((packagePaths) => packagePaths.filter((path) => path.toLowerCase().startsWith(prefix.toLowerCase())))
      .then((nextPaths) => {
        if (active) {
          setPaths(nextPaths);
          setChecked(true);
        }
      })
      .catch(() => {
        if (active) {
          setPaths([]);
          setChecked(true);
          setError(true);
        }
      });

    return () => {
      active = false;
    };
  }, [key, prefix, storedPaths]);

  return { paths, checked, error };
}

async function getCachedPackagePaths(packageKey: string, storedPaths?: string[]): Promise<string[]> {
  if (storedPaths && storedPaths.length > 0) return storedPaths;
  const indexedPaths = await indexedDbStorage.listFilePaths(packageKey);
  if (Array.isArray(indexedPaths)) return indexedPaths;

  // Older injected storage ports used by integration shells only expose the
  // original listFiles API. Production IndexedDB always takes the indexed path.
  const files = await indexedDbStorage.listFiles(packageKey);
  return files.map((file) => file.path);
}

function usePackageUrl(context: ActivityRendererContext, path?: string): string | undefined {
  const urls = usePackageUrls(context, path ? [path] : []);
  return path ? urls[path] : undefined;
}

function usePackageUrls(context: ActivityRendererContext, paths: string[]): Record<string, string> {
  return usePackageUrlsState(context, paths).urls;
}

function usePackageUrlsState(
  context: ActivityRendererContext,
  paths: string[]
): { urls: Record<string, string>; checked: boolean; error: boolean } {
  const key = context.packageMeta?.key;
  const mediaCachePaths = context.packageMeta?.mediaCachePaths || [];
  const uniquePaths = useMemo(() => Array.from(new Set(paths.filter(Boolean))), [paths.join("|")]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState(false);
  const videoMediaServiceWorkerControlled = useVideoMediaServiceWorkerControlled();

  useEffect(() => {
    let active = true;
    setUrls({});
    setChecked(false);
    setError(false);
    if (!key || uniquePaths.length === 0) {
      setChecked(true);
      return undefined;
    }

    Promise.all(
      uniquePaths.map(async (path) => {
        if (
          key &&
          mediaCachePaths.includes(path) &&
          videoMediaServiceWorkerControlled &&
          await hasCachedVideoMedia(key, path)
        ) {
          return [path, videoMediaCacheUrl(key, path)] as const;
        }

        const blob = await indexedDbStorage.getFileBlob(key, path);
        if (!blob) return undefined;
        return [path, getCachedObjectUrl(key, path, blob)] as const;
      })
    )
      .then((entries) => {
        const nextUrls = Object.fromEntries(entries.filter(Boolean) as Array<readonly [string, string]>);
        if (active) {
          setUrls(nextUrls);
          setChecked(true);
        }
      })
      .catch(() => {
        if (active) {
          setUrls({});
          setChecked(true);
          setError(true);
        }
      });

    return () => {
      active = false;
    };
  }, [key, mediaCachePaths.join("|"), uniquePaths, videoMediaServiceWorkerControlled]);

  return { urls, checked, error };
}

const MAX_CACHED_OBJECT_URLS = 48;
const cachedObjectUrls = new Map<string, { blob: Blob; url: string }>();

function getCachedObjectUrl(packageKey: string, path: string, blob: Blob): string {
  const key = `${packageKey}::${path}`;
  const existing = cachedObjectUrls.get(key);
  if (existing?.blob === blob) {
    cachedObjectUrls.delete(key);
    cachedObjectUrls.set(key, existing);
    return existing.url;
  }

  if (existing) {
    URL.revokeObjectURL(existing.url);
    cachedObjectUrls.delete(key);
  }

  const entry = { blob, url: URL.createObjectURL(blob) };
  cachedObjectUrls.set(key, entry);
  while (cachedObjectUrls.size > MAX_CACHED_OBJECT_URLS) {
    const oldest = cachedObjectUrls.entries().next().value as [string, { blob: Blob; url: string }] | undefined;
    if (!oldest) break;
    cachedObjectUrls.delete(oldest[0]);
    URL.revokeObjectURL(oldest[1].url);
  }
  return entry.url;
}

function useVideoMediaServiceWorkerControlled(): boolean {
  const [isControlled, setIsControlled] = useState(isVideoMediaServiceWorkerControlling);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return undefined;
    const update = () => setIsControlled(isVideoMediaServiceWorkerControlling());
    navigator.serviceWorker.addEventListener("controllerchange", update);
    update();
    return () => navigator.serviceWorker.removeEventListener("controllerchange", update);
  }, []);

  return isControlled;
}

function normalizeListenCueTiming(cues: ListenCaptionCue[], durationMs: number): ListenCaptionCue[] {
  if (cues.length <= 1 || durationMs <= 0) return cues;
  const maxEndMs = Math.max(...cues.map((cue) => cue.endMs));
  const generatedWideWindow = cues.every((cue) => cue.endMs - cue.startMs >= 59000) && maxEndMs > durationMs * 2;
  if (!generatedWideWindow) return cues;

  return cues.map((cue, index) => ({
    ...cue,
    startMs: Math.floor((durationMs * index) / cues.length),
    endMs: index === cues.length - 1 ? durationMs + 1 : Math.floor((durationMs * (index + 1)) / cues.length)
  }));
}

function buildListenCaptionCues(pageIndex: number, audioCount: number, captionTexts: string[]): ListenCaptionCue[] {
  const cleanTexts = captionTexts.map((text) => text.trim()).filter(Boolean);
  if (cleanTexts.length === 0 || audioCount === 0) return [];

  if (audioCount === 1 && cleanTexts.length > 1) {
    return cleanTexts.map((text, index) => ({
      pageIndex,
      audioIndex: 0,
      startMs: index * 60000,
      endMs: (index + 1) * 60000,
      text
    }));
  }

  return Array.from({ length: audioCount }, (_, audioIndex) => ({
    pageIndex,
    audioIndex,
    startMs: 0,
    endMs: 3600000,
    text: cleanTexts[Math.min(audioIndex, cleanTexts.length - 1)]
  }));
}

function knownListenCaptionPages(bookId?: string): string[][] {
  const normalized = (bookId || "").trim().toUpperCase();
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
  bookTitle: string,
  sentenceTexts: string[],
  pageCount: number,
  audioCounts: number[],
  knownCaptionPages: string[][]
): string[][] {
  if (knownCaptionPages.some((page) => page.length > 0)) return knownCaptionPages;

  const cleanSentenceTexts = sentenceTexts.map((text) => text.trim()).filter(Boolean);
  const result = Array.from({ length: pageCount }, () => [] as string[]);
  if (cleanSentenceTexts.length === 0 || pageCount === 0) return result;

  const titleText = bookTitle.trim();
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

function sentenceInfoToCaptionTexts(info?: SentenceInfo): string[] {
  return (info?.sentence || [])
    .flatMap((sentence) => splitCaptionText(stringFromUnknown(sentence.Eng) || stringFromUnknown(sentence.Slice)))
    .filter(Boolean);
}

function packageBookTitle(packageMeta?: ActivityRendererContext["packageMeta"]): string {
  const manifest = packageMeta?.manifest as { book?: { title?: unknown; bookName?: unknown; bookCode?: unknown; bookId?: unknown } } | undefined;
  return (
    stringFromUnknown(manifest?.book?.title) ||
    stringFromUnknown(manifest?.book?.bookName) ||
    stringFromUnknown(manifest?.book?.bookCode) ||
    stringFromUnknown(packageMeta?.bookId)
  ).trim();
}

function splitCaptionText(value: string): string[] {
  const normalized = value.replace(/\[[^\]]*\]/g, "").replace(/\//g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const matches = normalized.match(/[^.!?。！？]+[.!?。！？]+|[^.!?。！？]+$/g) || [normalized];
  return matches.map((item) => item.trim()).filter(Boolean);
}

function stringFromUnknown(value: unknown): string {
  return value == null ? "" : String(value);
}

function readBlobText(blob: Blob): Promise<string> {
  if (typeof blob.text === "function") return blob.text();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Failed to read blob text."));
    reader.readAsText(blob);
  });
}

function dayBase(context: ActivityRendererContext): string {
  return `Lessons/L${context.day?.lesson ?? 1}/D${context.day?.day ?? 1}`;
}

function paramIndex(activity?: Activity): number {
  const parsed = Number(activity?.params?.[0] ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function paramFolder(activity?: Activity): string {
  return twoDigit(paramIndex(activity) + 1);
}

function twoDigit(value: number): string {
  return value.toString().padStart(2, "0");
}

function naturalPathCompare(left: string, right: string): number {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

function readingAudioPage(path: string): number | undefined {
  const match = path.match(/\/snd\/snd_(\d+)_\d+\.mp3$/i);
  return match ? Number(match[1]) : undefined;
}

function findExistingPath(paths: string[], candidates: string[]): string | undefined {
  const lowerPathMap = new Map(paths.map((path) => [path.toLowerCase(), path]));
  for (const candidate of candidates) {
    const match = lowerPathMap.get(candidate.toLowerCase());
    if (match) return match;
  }
  return undefined;
}

function splitSentence(value?: string): string[] {
  if (!value) return [];
  if (value.includes("/")) return value.split("/").map((item) => item.trim()).filter(Boolean);
  return value.split(/\s+/).filter(Boolean);
}

function parseSentenceTokens(sentence?: LoadedSentence): { tokens: string[]; blankTokenIndex: number; blankToken: string } {
  if (!sentence) return { tokens: [], blankTokenIndex: -1, blankToken: "" };

  const source = sentence.slice || sentence.eng;
  const rawParts = source.includes("/") ? source.split("/") : source.match(/\[[^\]]+\](?:[.!?])?|[A-Za-z0-9']+|[.,!?]/g) || [];
  const indexedTokens: Array<{ text: string; rawIndex: number; markedBlank: boolean }> = [];
  let sentenceEndPunctuation = "";

  rawParts.forEach((rawText, rawIndex) => {
    const text = rawText.trim();
    if (!text) return;

    const bracketMatch = text.match(/^\[([\s\S]*?)\]\s*([.!?])?$/);
    if (bracketMatch) {
      let blankText = bracketMatch[1].replace(/\//g, " ").replace(/\s+/g, " ").trim();
      let punctuation = bracketMatch[2] || "";
      const innerPunctuation = blankText.match(/([.!?])$/);
      if (innerPunctuation) {
        if (!punctuation) punctuation = innerPunctuation[1];
        blankText = blankText.slice(0, -1).trimEnd();
      }
      if (blankText) indexedTokens.push({ text: blankText, rawIndex, markedBlank: true });
      if (punctuation) sentenceEndPunctuation = punctuation;
      return;
    }

    const markedBlank = /^\s*\[/.test(text) || /\]\s*[.!?]?$/.test(text);
    let cleanedText = text.replace(/^\[\s*/, "");
    const closingBracket = cleanedText.match(/^([\s\S]*?)\]\s*([.!?])?$/);
    if (closingBracket) {
      cleanedText = closingBracket[1].trim();
      if (closingBracket[2]) sentenceEndPunctuation = closingBracket[2];
    }
    if (cleanedText) indexedTokens.push({ text: cleanedText, rawIndex, markedBlank });
  });

  if (sentenceEndPunctuation && indexedTokens[indexedTokens.length - 1]?.text !== sentenceEndPunctuation) {
    indexedTokens.push({ text: sentenceEndPunctuation, rawIndex: rawParts.length, markedBlank: false });
  }

  const tokens = indexedTokens.map((item) => item.text);
  const markedBlankIndex = indexedTokens.findIndex((item) => item.markedBlank);
  let blankTokenIndex = markedBlankIndex >= 0
    ? markedBlankIndex
    : indexedTokens.findIndex((item) => item.rawIndex === sentence.blankIndex);

  if (blankTokenIndex < 0 && sentence.blankIndex >= 0 && sentence.blankIndex < indexedTokens.length) {
    blankTokenIndex = sentence.blankIndex;
  }

  if (blankTokenIndex < 0 && sentence.blankIndex > 0 && sentence.blankIndex - 1 < indexedTokens.length) {
    blankTokenIndex = sentence.blankIndex - 1;
  }

  return {
    tokens,
    blankTokenIndex,
    blankToken: blankTokenIndex >= 0 ? tokens[blankTokenIndex] : ""
  };
}

function tokenizeSentence(value: string): string[] {
  return value.match(/[A-Za-z0-9']+|[.,!?]/g) || [];
}

function buildContextClozeQuestions(sentences: LoadedSentence[], words: LoadedWord[], seed = 0): ContextClozeQuestion[] {
  return sentences
    .map((sentence, index) => {
      const parsed = parseSentenceTokens(sentence);
      if (parsed.tokens.length === 0) return undefined;
      const resolved = resolveClozeAnswer(parsed, words);
      if (!resolved.answer) return undefined;
      const options = buildSentenceBlankOptions(resolved.answer, words, mixSeed(seed, `${index}:${resolved.answer}`));
      return {
        sentence,
        tokens: parsed.tokens,
        blankTokenIndex: resolved.blankTokenIndex,
        answer: resolved.answer,
        options
      };
    })
    .filter(Boolean) as ContextClozeQuestion[];
}

function resolveClozeAnswer(
  parsed: { tokens: string[]; blankTokenIndex: number; blankToken: string },
  words: LoadedWord[]
): { blankTokenIndex: number; answer: string } {
  if (parsed.blankToken && !isPunctuationToken(parsed.blankToken)) {
    return { blankTokenIndex: parsed.blankTokenIndex, answer: parsed.blankToken };
  }

  const normalizedWordMap = new Map(words.map((word) => [normalizeToken(word.eng), word.eng]));
  const wordTokenIndex = parsed.tokens.findIndex((token) => normalizedWordMap.has(normalizeToken(token)));
  if (wordTokenIndex >= 0) {
    return {
      blankTokenIndex: wordTokenIndex,
      answer: normalizedWordMap.get(normalizeToken(parsed.tokens[wordTokenIndex])) || parsed.tokens[wordTokenIndex]
    };
  }

  const fallbackIndex = parsed.tokens.findIndex((token) => !isPunctuationToken(token) && normalizeToken(token).length > 2);
  return {
    blankTokenIndex: fallbackIndex,
    answer: fallbackIndex >= 0 ? parsed.tokens[fallbackIndex] : ""
  };
}

function buildSentenceRepairQuestion(sentence: LoadedSentence): SentenceRepairQuestion | undefined {
  const parsed = parseSentenceTokens(sentence);
  const answerTokens = parsed.tokens.filter((token) => !isPunctuationToken(token));
  if (answerTokens.length < 3) return undefined;
  const brokenTokens = breakSentenceTokens(parsed.tokens);
  const bank = brokenTokens.filter((token) => !isPunctuationToken(token));
  return {
    sentence,
    tokens: parsed.tokens,
    answerTokens,
    brokenTokens,
    bank
  };
}

function breakSentenceTokens(tokens: string[]): string[] {
  const result = [...tokens];
  const indexes = result.map((token, index) => ({ token, index })).filter((item) => !isPunctuationToken(item.token));
  if (indexes.length < 2) return result;
  const first = indexes.length > 4 ? indexes[1].index : indexes[0].index;
  const second = indexes.length > 4 ? indexes[3].index : indexes[1].index;
  [result[first], result[second]] = [result[second], result[first]];
  return result;
}

function normalizeDictation(value: string): string {
  return value.replace(/[^a-z0-9']+/gi, " ").trim().replace(/\s+/g, " ").toLowerCase();
}

function buildDictationHint(sentence: string): string {
  const tokens = tokenizeSentence(sentence).filter((token) => !isPunctuationToken(token));
  if (tokens.length === 0) return "No sentence hint.";
  return tokens.map((token) => `${token[0] || ""}${"_".repeat(Math.max(1, token.length - 1))}`).join(" ");
}

function buildGrammarTransformQuestions(sentences: LoadedSentence[]): GrammarTransformQuestion[] {
  return sentences.map(buildGrammarTransformQuestion).filter(Boolean) as GrammarTransformQuestion[];
}

function buildGrammarTransformQuestion(sentence: LoadedSentence): GrammarTransformQuestion | undefined {
  const source = formatSentence(tokenizeSentence(sentence.eng || sentence.slice));
  if (!source) return undefined;
  const lower = source.toLowerCase();

  if (/\bwas called\b/i.test(source)) {
    return {
      sentence,
      prompt: "Change past passive to present passive.",
      source,
      target: source.replace(/\bwas called\b/i, "is called"),
      helper: "'was called'를 현재 일반 사실 표현인 'is called'로 바꿉니다."
    };
  }

  if (/\bwas given\b/i.test(source)) {
    return {
      sentence,
      prompt: "Change past passive to present passive.",
      source,
      target: source.replace(/\bwas given\b/i, "is given"),
      helper: "'was given'을 현재 수동태 'is given'으로 바꿉니다."
    };
  }

  if (/\bhad\b/i.test(source)) {
    return {
      sentence,
      prompt: "Change past simple to present simple.",
      source,
      target: source.replace(/\bhad\b/i, "has"),
      helper: "과거 동사 'had'를 현재형 'has'로 바꿉니다."
    };
  }

  if (lower.startsWith("the ")) {
    return {
      sentence,
      prompt: "Make a question with the same main idea.",
      source,
      target: `What ${source.replace(/[.?!]$/, "").toLowerCase()}?`,
      helper: "문장의 핵심 정보를 묻는 What question으로 바꿉니다."
    };
  }

  return {
    sentence,
    prompt: "Rewrite as a negative sentence.",
    source,
    target: `It is not true that ${source.replace(/[.?!]$/, "").toLowerCase()}.`,
    helper: "원문 앞에 'It is not true that'을 붙여 부정문으로 바꿉니다."
  };
}

function buildParaphraseMatchQuestions(sentences: LoadedSentence[], seed = 0): ParaphraseMatchQuestion[] {
  const candidates = sentences
    .map((sentence) => {
      const answer = buildParaphrase(sentence.eng);
      if (!answer) return undefined;
      return { sentence, prompt: formatSentence(tokenizeSentence(sentence.eng)), answer };
    })
    .filter(Boolean) as Array<{ sentence: LoadedSentence; prompt: string; answer: string }>;

  return candidates.map((candidate, index) => {
    const distractors = candidates
      .filter((item) => item.sentence.index !== candidate.sentence.index)
      .map((item) => item.answer)
      .slice(0, 3);
    const options = shuffleAvoidingSameOrder(
      [candidate.answer, ...distractors, ...buildGenericParaphraseDistractors(candidate.prompt)].slice(0, 4),
      mixSeed(seed, `${index}:${candidate.answer}`),
      normalizeSentence
    );
    return {
      sentence: candidate.sentence,
      prompt: candidate.prompt,
      answer: candidate.answer,
      options
    };
  });
}

function buildParaphrase(sentence: string): string {
  const source = formatSentence(tokenizeSentence(sentence));
  if (!source) return "";

  if (/\bwas called a mummy\b/i.test(source)) {
    return "People called the preserved body a mummy.";
  }

  if (/\bhad a great culture\b/i.test(source)) {
    return "Ancient Egyptians had an impressive culture.";
  }

  if (/\bwas given a fancy burial\b/i.test(source)) {
    return "The king received an elaborate burial.";
  }

  if (/\bwas called\b/i.test(source)) {
    return source.replace(/\bwas called\b/i, "was known as");
  }

  if (/\bgreat\b/i.test(source)) {
    return source.replace(/\bgreat\b/i, "impressive");
  }

  if (/\bfancy\b/i.test(source)) {
    return source.replace(/\bfancy\b/i, "elaborate");
  }

  return `In other words, ${source.replace(/[.?!]$/, "").toLowerCase()}.`;
}

function buildGenericParaphraseDistractors(prompt: string): string[] {
  const base = prompt.replace(/[.?!]$/, "");
  return [
    `${base} happened much later.`,
    `${base} was not important.`,
    `People forgot about ${base.toLowerCase()}.`
  ];
}

function buildSentenceBlankOptions(answer: string, words: LoadedWord[], seed = 0, preferredOptions: string[] = []): string[] {
  if (!answer) return [];
  const seen = new Set<string>();
  const options: string[] = [];

  for (const option of [answer, ...preferredOptions, ...words.map((word) => word.eng)]) {
    const key = normalizeToken(option);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    options.push(option);
    if (options.length >= 4) break;
  }

  return shuffleAvoidingSameOrder(options, seed, (option) => normalizeToken(option));
}

function scrambleSentenceTokens(tokens: string[]): string[] {
  if (tokens.length <= 1) return tokens;
  if (tokens.length === 2) return [...tokens].reverse();

  const reordered = tokens
    .map((token, index) => ({ token, sortKey: (index * 7 + 3) % tokens.length }))
    .sort((left, right) => left.sortKey - right.sortKey)
    .map((item) => item.token);
  return reordered.every((token, index) => token === tokens[index]) ? [...tokens].reverse() : reordered;
}

function buildSentenceDisplay(tokens: string[], selectedTokens: string[]): ReactNode[] {
  let selectedIndex = 0;
  return tokens.map((token, tokenIndex) => {
    if (isPunctuationToken(token)) {
      return (
        <span className="sentence-punctuation" key={`${token}:${tokenIndex}`}>
          {token}
        </span>
      );
    }

    const selectedToken = selectedTokens[selectedIndex];
    selectedIndex += 1;
    return (
      <span className={selectedToken ? "sentence-token filled" : "sentence-token"} key={`${token}:${tokenIndex}`}>
        {selectedToken || "____"}
      </span>
    );
  });
}

function formatSentence(tokens: string[]): string {
  return tokens.join(" ").replace(/\s+([?.!,])/g, "$1");
}

function normalizeSentence(value: string): string {
  return formatSentence(value.split(/\s+/).filter(Boolean)).toLowerCase();
}

function normalizeToken(value: string): string {
  return value.replace(/[^a-z0-9']/gi, "").toLowerCase();
}

function isPunctuationToken(value: string): boolean {
  return /^[?.!,]$/.test(value);
}

function resolveVocaQuizMode(activity: Activity | undefined, current: number, seed: number): VocaQuizMode {
  const raw = activity?.raw && typeof activity.raw === "object" ? (activity.raw as Record<string, unknown>) : {};
  const explicitValue = firstString(raw.quiz_type, raw.quizType, raw.question_type, raw.questionType, raw.mode).toLowerCase();
  const explicitNumber = Number(raw.quiz_type ?? raw.quizType ?? raw.question_type ?? raw.questionType);
  const modes: readonly VocaQuizMode[] = ["text-image", "image-text", "sound-text", "sound-image"];

  if (Number.isInteger(explicitNumber) && explicitNumber >= 0 && explicitNumber < modes.length) {
    return modes[explicitNumber];
  }

  const normalizedExplicit = explicitValue.replace(/[_\s]+/g, "-");
  const explicitMode = modes.find((mode) => normalizedExplicit.includes(mode));
  if (explicitMode) return explicitMode;

  const showWordText = raw.isShowWordText ?? raw.is_show_word_text ?? raw.showWordText;
  if (showWordText === false || showWordText === 0 || String(showWordText).toLowerCase() === "false") {
    return "sound-image";
  }

  return modes[mixSeed(seed, `${activity?.id || activity?.actIdx || "quiz"}:${current}`) % modes.length];
}

function isMetaOnWordQuiz(activity: Activity | undefined): boolean {
  return normalizeActivityCode(activity?.activityCode || activity?.id) === MetaOnActivityCode.WordQuiz;
}

function buildUnscrambleDisplayModel(
  fullTokens: string[],
  answerTokens: string[],
  completeAnswerTokens: string[] = answerTokens
): UnscrambleDisplayItem[] {
  if (answerTokens.length === 0) {
    return fullTokens.map((text) => ({ kind: "static", text, punctuation: isPunctuationToken(text) }));
  }

  const wordEntries = fullTokens
    .map((text, fullIndex) => ({ text, fullIndex }))
    .filter((entry) => !isPunctuationToken(entry.text));
  const normalizedAnswerGroups = completeAnswerTokens.map((answer) => {
    const group = tokenizeSentence(answer).filter((token) => !isPunctuationToken(token)).map(normalizeToken).filter(Boolean);
    return group.length > 0 ? group : [normalizeToken(answer)].filter(Boolean);
  });
  const normalizedAnswers = normalizedAnswerGroups.flat();
  let sequenceStart = -1;

  for (let start = 0; start <= wordEntries.length - normalizedAnswers.length; start += 1) {
    const matches = normalizedAnswers.every((answer, answerIndex) => normalizeToken(wordEntries[start + answerIndex].text) === answer);
    if (matches) {
      sequenceStart = start;
      break;
    }
  }

  if (sequenceStart < 0) {
    sequenceStart = 0;
  }

  const answerIndexByFullIndex = new Map<number, number>();
  const consumedFullIndexes = new Set<number>();
  let wordOffset = sequenceStart;
  normalizedAnswerGroups.forEach((group, answerIndex) => {
    const groupEntries = wordEntries.slice(wordOffset, wordOffset + group.length);
    if (answerIndex < answerTokens.length) {
      if (groupEntries[0]) answerIndexByFullIndex.set(groupEntries[0].fullIndex, answerIndex);
      groupEntries.slice(1).forEach((entry) => consumedFullIndexes.add(entry.fullIndex));
    }
    wordOffset += group.length;
  });

  return fullTokens.flatMap((text, fullIndex) => {
    if (consumedFullIndexes.has(fullIndex)) return [];
    const answerIndex = answerIndexByFullIndex.get(fullIndex);
    return answerIndex === undefined
      ? { kind: "static", text, punctuation: isPunctuationToken(text) }
      : { kind: "slot", answerIndex };
  });
}

function buildWordOptions(words: LoadedWord[], current: number, seed = 0): LoadedWord[] {
  if (words.length === 0) return [];
  const seen = new Set<string>();
  const options: LoadedWord[] = [];

  for (let offset = 0; offset < words.length && options.length < 4; offset += 1) {
    const word = words[(current + offset) % words.length];
    const key = word.eng.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      options.push(word);
    }
  }

  return shuffleAvoidingSameOrder(options, seed, wordOptionKey);
}

function buildWordSearchOptions(words: LoadedWord[], current: number, seed = 0): LoadedWord[] {
  const target = words[current];
  if (!target) return [];

  const seen = new Set([normalizeToken(target.eng)]);
  const options = [target];
  for (let offset = 1; offset < words.length && options.length < 3; offset += 1) {
    const candidate = words[(current + offset) % words.length];
    const key = normalizeToken(candidate.eng);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    options.push(candidate);
  }

  return shuffleAvoidingSameOrder(options, seed, wordOptionKey);
}

function buildWordBlankQuestion(word?: LoadedWord, seed = 0): WordBlankQuestion {
  const letters = Array.from(word?.eng || "");
  const candidates = letters
    .map((letter, index) => ({ letter, index }))
    .filter((item) => /^[A-Za-z]$/.test(item.letter));

  if (candidates.length === 0) {
    return { letters, blankIndex: -1, answer: "", options: [] };
  }

  const random = seededRandom(seed);
  const blank = candidates[Math.floor(random() * candidates.length)];
  const answer = blank.letter.toLowerCase();
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  const options = [answer];

  while (options.length < 4) {
    const option = alphabet[Math.floor(random() * alphabet.length)];
    if (!options.includes(option)) {
      options.push(option);
    }
  }

  return {
    letters,
    blankIndex: blank.index,
    answer,
    options: shuffleAvoidingSameOrder(options, mixSeed(seed, "word-blank-options"), (option) => option)
  };
}

function buildUnderSeaQuestion(word?: LoadedWord, seed = 0): UnderSeaQuestion {
  const letters = Array.from(normalizeWord(word?.eng || ""));
  const candidates = letters
    .map((letter, index) => ({ letter, index }))
    .filter((item) => /^[a-z]$/i.test(item.letter));

  if (candidates.length === 0) {
    return { letters, blankIndexes: [], bubbles: [] };
  }

  const random = seededRandom(seed);
  const blankCount = Math.min(3, candidates.length);
  const blankIndexes = shuffleWithSeed(candidates, mixSeed(seed, "undersea-blanks"))
    .slice(0, blankCount)
    .map((item) => item.index)
    .sort((left, right) => left - right);
  const answerLetters = blankIndexes.map((index) => letters[index].toLowerCase());
  const bubbleLetters = [...answerLetters];
  const alphabet = "abcdefghijklmnopqrstuvwxyz";

  while (bubbleLetters.length < blankCount + 2) {
    const option = alphabet[Math.floor(random() * alphabet.length)];
    if (!bubbleLetters.includes(option)) bubbleLetters.push(option);
  }

  const positions = [
    { x: 72, y: 28 },
    { x: 46, y: 34 },
    { x: 82, y: 58 },
    { x: 58, y: 72 },
    { x: 28, y: 48 }
  ];

  return {
    letters,
    blankIndexes,
    bubbles: shuffleWithSeed(bubbleLetters, mixSeed(seed, "undersea-bubbles")).map((letter, index) => ({
      id: `${letter}:${index}:${seed}`,
      letter,
      x: positions[index % positions.length].x,
      y: positions[index % positions.length].y,
      tone: (index % 5) + 1
    }))
  };
}

function fillUnderSeaLetters(letters: string[], blankIndexes: number[], filledLetters: string[]): string[] {
  const result = [...letters];
  blankIndexes.forEach((letterIndex, fillIndex) => {
    result[letterIndex] = filledLetters[fillIndex] || "";
  });
  return result;
}

function getPointerPercent(event: ReactPointerEvent<HTMLElement>, element: HTMLElement | null): PercentPoint | undefined {
  if (!element) return undefined;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return undefined;

  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;

  return {
    x: clamp(x, 6, 94),
    y: clamp(y, 12, 88)
  };
}

function findBubbleHit(point: PercentPoint, bubbles: UnderSeaBubble[]): UnderSeaBubble | undefined {
  return bubbles.find((bubble) => {
    const xDistance = (point.x - bubble.x) * 1.32;
    const yDistance = point.y - bubble.y;
    return Math.hypot(xDistance, yDistance) <= 9.8;
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function buildWordsSignature(words: LoadedWord[]): string {
  return words.map(wordOptionKey).join("|");
}

function wordOptionKey(word: LoadedWord): string {
  return `${word.index}:${word.eng.toLowerCase()}`;
}

function wordItemIdx(word?: LoadedWord): number | null {
  return numberOrUndefined(word?.wordIdx) ?? null;
}

function sentenceItemIdx(sentence?: LoadedSentence): number | null {
  return numberOrUndefined(sentence?.sentenceIdx) ?? null;
}

function boolCorrect(value: boolean): 0 | 1 {
  return value ? 1 : 0;
}

function wordOptionOrder(words: LoadedWord[]): Array<{ word_idx: number | null; text: string }> {
  return words.map((word) => ({
    word_idx: wordItemIdx(word),
    text: word.eng
  }));
}

function sentenceWordOptionOrder(options: string[], words: LoadedWord[]): Array<{ word_idx: number | null; text: string }> {
  return options.map((option) => ({
    word_idx: wordItemIdx(words.find((word) => normalizeToken(word.eng) === normalizeToken(option))),
    text: option
  }));
}

function recordingUploadItemType(itemType: LearnEventInput["item_type"]): "sentence" | "word" | "free" {
  if (itemType === "sentence" || itemType === "word") return itemType;
  return "free";
}

function recordingS3Key(payload: unknown): string | undefined {
  const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const nested = record.data && typeof record.data === "object" ? (record.data as Record<string, unknown>) : {};
  return stringOrUndefined(record.s3_key) || stringOrUndefined(record.s3Key) || stringOrUndefined(nested.s3_key) || stringOrUndefined(nested.s3Key);
}

function recordingUploadSummary(payload: unknown): Record<string, unknown> | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const record = payload as Record<string, unknown>;
  const nested = record.data && typeof record.data === "object" ? (record.data as Record<string, unknown>) : {};
  const summary = {
    rec_idx: numberOrUndefined(record.rec_idx ?? record.recIdx ?? nested.rec_idx ?? nested.recIdx),
    s3_key: recordingS3Key(payload),
    content_type: stringOrUndefined(record.content_type ?? record.contentType ?? nested.content_type ?? nested.contentType),
    duration_ms: numberOrUndefined(record.duration_ms ?? record.durationMs ?? nested.duration_ms ?? nested.durationMs)
  };
  const entries = Object.entries(summary).filter(([, value]) => value != null);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error || new Error("Failed to read recording blob"));
    reader.readAsDataURL(blob);
  });
}

function numberOrUndefined(value: unknown): number | undefined {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function createShuffleSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}

function mixSeed(seed: number, value: string): number {
  return (seed ^ stableStringHash(value)) >>> 0;
}

function stableStringHash(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function shuffleWithSeed<T>(items: T[], seed: number): T[] {
  const result = [...items];
  const random = seededRandom(seed);

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}

function shuffleAvoidingSameOrder<T>(items: T[], seed: number, keyForItem: (item: T) => string): T[] {
  if (items.length <= 1) return items;

  const shuffled = shuffleWithSeed(items, seed);
  const isSameOrder = shuffled.every((item, index) => keyForItem(item) === keyForItem(items[index]));

  return isSameOrder ? [...shuffled.slice(1), shuffled[0]] : shuffled;
}

function scrambleWord(value: string): string[] {
  const letters = value.split("");
  if (letters.length <= 2) return letters;

  const scrambled = letters
    .map((letter, index) => ({ letter, sortKey: (index * 7 + 3) % letters.length }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .map((item) => item.letter);

  return scrambled.join("").toLowerCase() === value.toLowerCase() ? letters.reverse() : scrambled;
}

function normalizeWord(value: string): string {
  return value.replace(/[^a-z]/gi, "").toLowerCase();
}

export function rendererNameForActType(actType?: ActType): string {
  return getActTypeLabel(actType);
}

export function iconForSupportedActType(actType?: ActType): ReactNode {
  if (!actType) return null;
  if ([ActType.VocaQuiz, ActType.VocaQuizSpace, ActType.Reading2, ActType.Reading5].includes(actType)) return <Check size={18} />;
  if ([ActType.ListenRecord, ActType.ListenRecordSpace, ActType.SentenceShadowing].includes(actType)) return <Mic size={18} />;
  if (actType === ActType.Listening) return <BookOpen size={18} />;
  if (actType === ActType.MoviePlay) return <Volume2 size={18} />;
  return null;
}
