import { useState } from "react";
import {
  ContextClozeRaceActivity,
  DictationLadderActivity,
  GrammarTransformActivity,
  ParaphraseMatchActivity,
  SentenceRepairActivity,
  type PrototypeActivityData
} from "../components/activities/PackageActivities";
import { ActType, type ActivityRendererContext } from "../types/metaonTypes";

const prototypeData: PrototypeActivityData = {
  words: [
    { index: 0, eng: "mummy", mean: "미라", sentence: "The preserved body was called a mummy.", wordClass: "noun" },
    { index: 1, eng: "culture", mean: "문화", sentence: "Ancient Egyptians had a great culture.", wordClass: "noun" },
    { index: 2, eng: "burial", mean: "매장", sentence: "The king was given a fancy burial.", wordClass: "noun" },
    { index: 3, eng: "preserved", mean: "보존된", sentence: "The preserved body was called a mummy.", wordClass: "adjective" }
  ],
  sentences: [
    {
      index: 0,
      eng: "The preserved body was called a mummy.",
      mean: "보존된 시신은 미라라고 불렸다.",
      slice: "The/preserved/body/was/called/a/mummy/.",
      blankIndex: 6
    },
    {
      index: 1,
      eng: "Ancient Egyptians had a great culture.",
      mean: "고대 이집트인들은 위대한 문화를 가지고 있었다.",
      slice: "Ancient/Egyptians/had/a/great/culture/.",
      blankIndex: 5
    },
    {
      index: 2,
      eng: "The king was given a fancy burial.",
      mean: "그 왕은 화려한 매장을 받았다.",
      slice: "The/king/was/given/a/fancy/burial/.",
      blankIndex: 6
    }
  ]
};

const prototypeContext: ActivityRendererContext = {
  packageMeta: {
    key: "prototype:activity-lab",
    source: "metaon3-resources",
    bookIdx: 0,
    bookId: "PROTO",
    seriesGroup: 0,
    seriesIdx: 0,
    downloadedAt: new Date(0).toISOString(),
    totalFiles: 0,
    totalBytes: 0,
    lessonDays: []
  },
  day: {
    id: "prototype-day",
    dayIdx: 0,
    lesson: 1,
    day: 1,
    title: "Prototype Day",
    activities: []
  },
  activity: {
    id: "prototype-activity",
    actIdx: 0,
    dayIdx: 0,
    actType: ActType.SentenceCheck,
    title: "Prototype",
    actNum: 0,
    category: "sentence",
    params: ["0"]
  }
};

const prototypes = [
  {
    id: "cloze",
    title: "Context Cloze Race",
    description: "문맥 속 빈칸에 들어갈 단어를 제한 시간 안에 선택합니다."
  },
  {
    id: "repair",
    title: "Sentence Repair",
    description: "섞이거나 고장난 문장을 보고 올바른 문장 순서로 복구합니다."
  },
  {
    id: "dictation",
    title: "Dictation Ladder",
    description: "문장을 듣거나 힌트를 보고 받아쓰며 단계별로 올라갑니다."
  },
  {
    id: "grammar",
    title: "Grammar Transform",
    description: "문장을 같은 의미의 다른 문법 패턴으로 변환합니다."
  },
  {
    id: "paraphrase",
    title: "Paraphrase Match",
    description: "원문과 의미가 같은 문장을 빠르게 선택합니다."
  }
] as const;

type PrototypeId = (typeof prototypes)[number]["id"];

export function ActivityPrototypePage() {
  const [selected, setSelected] = useState<PrototypeId>("cloze");

  return (
    <div className="prototype-lab">
      <header className="prototype-lab-header">
        <div>
          <span className="hub-detail-label">Prototype</span>
          <h1>Word / Sentence Activity Lab</h1>
          <p>기존 word, sentence 데이터를 더 게임성 있는 학습 활동으로 바꾸는 1차 프로토타입입니다.</p>
        </div>
      </header>

      <div className="prototype-lab-tabs" role="tablist" aria-label="Prototype activities">
        {prototypes.map((prototype) => (
          <button
            aria-selected={selected === prototype.id}
            className={selected === prototype.id ? "active" : ""}
            data-testid={`prototype-tab-${prototype.id}`}
            key={prototype.id}
            onClick={() => setSelected(prototype.id)}
            role="tab"
            type="button"
          >
            <strong>{prototype.title}</strong>
            <span>{prototype.description}</span>
          </button>
        ))}
      </div>

      <section className="prototype-lab-stage">
        {selected === "cloze" ? <ContextClozeRaceActivity context={prototypeContext} prototypeData={prototypeData} /> : null}
        {selected === "repair" ? <SentenceRepairActivity context={prototypeContext} prototypeData={prototypeData} /> : null}
        {selected === "dictation" ? <DictationLadderActivity context={prototypeContext} prototypeData={prototypeData} /> : null}
        {selected === "grammar" ? <GrammarTransformActivity context={prototypeContext} prototypeData={prototypeData} /> : null}
        {selected === "paraphrase" ? <ParaphraseMatchActivity context={prototypeContext} prototypeData={prototypeData} /> : null}
      </section>
    </div>
  );
}
