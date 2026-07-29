import { useState, type ReactNode } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { activityControlAssets, VideoActivityCheckControl } from "../components/ActivityImageControls";
import { ActivityTopBar } from "../components/ActivityTopBar";
import {
  FlashCardActivity,
  MatchingGameActivity,
  MemoryGameActivity,
  SentenceBlankActivity,
  SentenceRecordActivity,
  SentenceUnscrambleActivity,
  VocaQuizActivity,
  WordBlankActivity,
  WordSearchActivity,
  type PrototypeActivityData
} from "../components/activities/PackageActivities";
import { ActType, type ActivityRendererContext } from "../types/metaonTypes";

const silentAudio = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

const previewWords: NonNullable<PrototypeActivityData["words"]> = [
  { index: 0, wordIdx: 101, eng: "extraordinary", mean: "놀라운", sentence: "The extraordinary bridge carried travelers safely across the wide river for many years.", wordClass: "adjective", imageUrl: "/metaon-assets/covers/sky.png", audioUrl: silentAudio },
  { index: 1, wordIdx: 102, eng: "river", mean: "강", sentence: "A river runs below.", wordClass: "noun", imageUrl: "/metaon-assets/covers/rainy-shop.png", audioUrl: silentAudio },
  { index: 2, wordIdx: 103, eng: "rock", mean: "바위", sentence: "The rock is heavy.", wordClass: "noun", imageUrl: "/metaon-assets/covers/picnic-map.png", audioUrl: silentAudio },
  { index: 3, wordIdx: 104, eng: "wood", mean: "나무", sentence: "Wood floats on water.", wordClass: "noun", imageUrl: "/metaon-assets/covers/animals.png", audioUrl: silentAudio },
  { index: 4, wordIdx: 105, eng: "strong", mean: "튼튼한", sentence: "It is strong.", wordClass: "adjective", imageUrl: "/metaon-assets/mission-banner.png", audioUrl: silentAudio },
  { index: 5, wordIdx: 106, eng: "water", mean: "물", sentence: "Water moves quickly.", wordClass: "noun", imageUrl: "/metaon-assets/hero-themes/hero-undersea.png", audioUrl: silentAudio }
];

const sentenceBlankData: PrototypeActivityData = {
  words: previewWords,
  sentences: [
    {
      index: 0,
      sentenceIdx: 201,
      eng: "Over the log.",
      mean: "통나무 위로 폴짝.",
      slice: "Over/[the log].",
      blankIndex: -1,
      audioUrl: silentAudio
    }
  ]
};

const sentenceUnscrambleData: PrototypeActivityData = {
  words: previewWords,
  sentences: [
    {
      index: 0,
      sentenceIdx: 202,
      eng: "Over the log.",
      mean: "통나무 위로 폴짝.",
      slice: "Over/[the log].",
      blankIndex: -1,
      audioUrl: silentAudio
    }
  ]
};

const sentenceUnscrambleLongData: PrototypeActivityData = {
  words: previewWords,
  sentences: [
    {
      index: 0,
      sentenceIdx: 203,
      eng: "When the storm finally ended the children carefully carried their supplies across the old wooden bridge together.",
      mean: "폭풍이 마침내 끝나자 아이들은 낡은 나무다리를 건너 물품을 조심스럽게 함께 옮겼습니다.",
      slice: "When/the/storm/finally/ended/the/children/carefully/carried/their/supplies/across/the/old/wooden/bridge/together/.",
      blankIndex: 0,
      audioUrl: silentAudio
    }
  ]
};

const sentenceRecordData: PrototypeActivityData = {
  sentences: [
    {
      index: 0,
      sentenceIdx: 204,
      eng: "Let's use rocks to see how strong each bridge is.",
      mean: "돌을 사용해 각각의 다리가 얼마나 튼튼한지 살펴봅시다.",
      slice: "Let's/use/rocks/to/see/how/strong/each/bridge/is/.",
      blankIndex: 6,
      audioUrl: silentAudio
    },
    {
      index: 1,
      sentenceIdx: 205,
      eng: "The wooden bridge stretches across the river.",
      mean: "나무다리가 강을 가로질러 뻗어 있습니다.",
      slice: "The/wooden/bridge/stretches/across/the/river/.",
      blankIndex: 3,
      audioUrl: silentAudio
    }
  ]
};

function previewContext(actType: ActType, activityCode: string, raw?: Record<string, unknown>): ActivityRendererContext {
  return {
    day: {
      id: "preview-day",
      dayIdx: 1,
      lesson: 1,
      day: 1,
      title: "Preview",
      activities: []
    },
    activity: {
      id: `preview-${activityCode}`,
      actIdx: 1,
      dayIdx: 1,
      activityCode,
      actType,
      title: activityCode,
      actNum: 0,
      category: activityCode.startsWith("ST") ? "sentence" : "word",
      params: ["0"],
      raw
    }
  };
}

export function ActivityRenewalPreviewPage() {
  const navigate = useNavigate();
  const { kind } = useParams();
  const [previewComplete, setPreviewComplete] = useState(false);
  const isVideoActivity = kind === "video-flashcard" || kind === "video-voca-quiz";

  if (!import.meta.env.DEV) return <Navigate replace to="/" />;

  let activity: ReactNode;
  switch (kind) {
    case "flashcard":
      activity = <FlashCardActivity context={previewContext(ActType.FlashCardSpace, "WDCA01")} label="Word Card" prototypeData={{ words: previewWords }} />;
      break;
    case "video-flashcard":
      activity = <FlashCardActivity context={previewContext(ActType.FlashCardSpace, "WDCA02")} label="Word Card" prototypeData={{ words: previewWords }} />;
      break;
    case "video-voca-quiz":
      activity = <VocaQuizActivity context={previewContext(ActType.VocaQuizSpace, "WDQU03", { quiz_type: 1 })} prototypeData={{ words: previewWords }} />;
      break;
    case "voca-text":
      activity = <VocaQuizActivity context={previewContext(ActType.VocaQuizSpace, "WDQU01", { quiz_type: 1 })} prototypeData={{ words: previewWords }} />;
      break;
    case "voca-image":
      activity = <VocaQuizActivity context={previewContext(ActType.VocaQuizSpace, "WDQU01", { quiz_type: 0 })} prototypeData={{ words: previewWords }} />;
      break;
    case "word-blank":
      activity = <WordBlankActivity context={previewContext(ActType.VocaCheckSpace, "WDBL01")} prototypeData={{ words: previewWords }} />;
      break;
    case "word-search":
      activity = <WordSearchActivity context={previewContext(ActType.WordSearch, "WDQU02")} prototypeData={{ words: previewWords }} />;
      break;
    case "matching":
      activity = <MatchingGameActivity context={previewContext(ActType.MatchingGame, "WDPL01")} prototypeData={{ words: previewWords }} />;
      break;
    case "memory":
      activity = <MemoryGameActivity context={previewContext(ActType.MemoryGame, "WDPL02")} prototypeData={{ words: previewWords }} />;
      break;
    case "sentence-blank":
      activity = <SentenceBlankActivity context={previewContext(ActType.SentenceCheckSpace, "STBL01")} prototypeData={sentenceBlankData} />;
      break;
    case "unscramble":
      activity = <SentenceUnscrambleActivity context={previewContext(ActType.SentenceUnscrambleSpace, "STSC01")} prototypeData={sentenceUnscrambleData} />;
      break;
    case "unscramble-long":
      activity = <SentenceUnscrambleActivity context={previewContext(ActType.SentenceUnscrambleSpace, "STSC01")} prototypeData={sentenceUnscrambleLongData} />;
      break;
    case "sentence-record":
      activity = <SentenceRecordActivity context={previewContext(ActType.SentenceShadowingSpace, "STRC01")} prototypeData={sentenceRecordData} />;
      break;
    default:
      return <Navigate replace to="/activity-preview/voca-text" />;
  }

  return (
    <div className="activity-layout unity-activity-layout">
      <ActivityTopBar
        isFullscreen={false}
        isFirstActivity={false}
        isLastActivity={false}
        onBack={() => navigate("/activity-prototypes", { replace: true })}
        onPrev={() => undefined}
        onNext={() => undefined}
        onToggleFullscreen={() => undefined}
        variant={isVideoActivity ? "video" : "standard"}
      />
      {activity}
      <button
        aria-label="Complete activity"
        aria-pressed={previewComplete}
        className={`hub-activity-complete-button${isVideoActivity ? " video-activity-check" : ""}${previewComplete ? " is-complete" : ""}`}
        onClick={() => setPreviewComplete(true)}
        type="button"
      >
        {isVideoActivity ? (
          <VideoActivityCheckControl />
        ) : (
          <img aria-hidden="true" draggable={false} src={activityControlAssets.check} alt="" />
        )}
      </button>
    </div>
  );
}
