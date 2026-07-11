# 신규 Activity 복수 Skill 매핑

## 목적

MetaOn3 신규 Activity code 기준으로 각 Activity가 어떤 학습 skill과 연결되는지 정리한다.

각 Activity는 하나의 skill에만 종속되지 않는다. 대부분의 Activity는 대표 skill, 보조 skill, 문항 단위 세부 skill이 함께 작동한다. 이 문서는 `learn_event` 기반 분석, `user_skill` 집계, 개인화 추천, 맞춤 복습 UI를 설계할 때 Activity별 skill 해석 기준으로 사용한다.

## 기본 원칙

### 1. Activity는 여러 skill과 연관된다

예를 들어 `STBL01` Sentence Blank는 기본적으로 문장 형태를 다루므로 `sentence_form`과 연결된다. 하지만 빈칸이 전치사이면 `preposition`, 관사이면 `article`, 시제 변화이면 `tense`와도 연결된다.

따라서 Activity 단위 skill과 문항/item 단위 skill을 분리해야 한다.

### 2. 대표 skill과 보조 skill을 구분한다

분석과 개인화에서 혼란을 줄이기 위해 다음 구조를 권장한다.

```json
{
  "activity_code": "WDQU01",
  "primary_skill_tag": "vocab",
  "related_skill_tags": ["collocation", "reading_comp"],
  "item_skill_tag": "vocab"
}
```

- `primary_skill_tag`: Activity의 대표 학습 목적
- `related_skill_tags`: Activity 수행에 함께 관여하는 보조 skill
- `item_skill_tag`: 실제 문항, 단어, 문장, blank, quiz item의 세부 skill

### 3. 점수 집계는 가중치를 둘 수 있다

하나의 Activity 결과를 여러 skill에 동일하게 반영하면 분석이 흐려질 수 있다. 따라서 기본 집계는 대표 skill에 더 높은 가중치를 주고, 보조 skill에는 낮은 가중치를 주는 방식을 권장한다.

예시:

```json
{
  "activity_code": "WDQU01",
  "skill_weights": {
    "vocab": 0.7,
    "collocation": 0.2,
    "reading_comp": 0.1
  }
}
```

## Skill 기준

첨부된 skill 목록의 `tag` 값을 기준으로 한다.

| tag | domain | name |
|---|---|---|
| `vocab` | 어휘 | 어휘 일반 |
| `collocation` | 어휘 | 언어·용법 |
| `spelling` | 철자 | 철자 |
| `phonics` | 철자 | 파닉스·디코딩 |
| `reading_fluency` | 읽기 | 읽기 유창성 |
| `reading_comp` | 읽기 | 독해 이해 |
| `listening_comp` | 듣기 | 듣기 이해 |
| `speaking_fluency` | 말하기 | 말하기 유창성 |
| `pronunciation` | 말하기 | 발음 |
| `sentence_form` | 문장문법 | 문장 형태 일반 |
| `word_order` | 문장문법 | 어순 |
| `main_idea` | 읽기 | 주제 파악 |
| `detail_comp` | 읽기 | 세부내용 이해 |
| `inference` | 읽기 | 추론 |
| `preposition` | 문장문법 | 전치사 |
| `article` | 문장문법 | 관사 |
| `pronoun` | 문장문법 | 대명사 |
| `tense` | 문장문법 | 시제 |
| `conjunction` | 문장문법 | 접속사·문장결합 |
| `sv_agreement` | 문장문법 | 주어-동사 수일치 |
| `punctuation` | 문장문법 | 구두점·대소문자 |

## 신규 Activity별 복수 Skill 매핑

| Activity code | Activity | 기존 코드 | 대표 skill | 연관 skill | item-level 세분화 가능성 | 판단 근거 |
|---|---|---:|---|---|---|---|
| `EBOOK01` | Listen & Read | `67/66` | `reading_fluency` | `listening_comp`, `reading_comp`, `pronunciation` | page, sentence, caption 단위로 `reading_comp`, `listening_comp` 세분화 | 페이지를 보며 음성을 듣고 따라 읽는 E-book형 활동이다. 읽기 흐름, 듣기 이해, 본문 이해가 함께 작동한다. 따라 읽기/쉐도잉까지 포함되면 발음도 보조 skill로 본다. |
| `WDCA01` | Word Card | `1017` | `vocab` | `pronunciation`, `listening_comp` | word 단위로 `vocab`, audio replay 기준 `pronunciation` 보조 반영 | 단어 이미지, 단어 텍스트, 단어 음성을 노출하는 카드 활동이다. 어휘 노출이 중심이지만, 단어 발음 듣기도 함께 발생한다. |
| `WDQU01` | Word Quiz | `1004` | `vocab` | `collocation`, `reading_comp` | 보기/문장 context가 있으면 `collocation`, `reading_comp` 반영 | 보기 중 알맞은 단어를 선택하는 어휘 인식 활동이다. 문장이나 예문 속에서 단어를 고르는 형태라면 문맥 이해와 언어·용법도 관여한다. |
| `WDBL01` | Word Blank | `1005` | `spelling` | `phonics`, `vocab`, `pronunciation` | blank 위치, 글자 패턴, 음성 힌트 여부에 따라 `phonics`, `pronunciation` 반영 | 단어의 빈 글자 또는 철자를 맞추는 활동이다. 철자 정확도가 중심이며, 소리-철자 대응을 다루면 phonics와 발음 인지도 함께 본다. |
| `WDPL01` | Matching Game | `8` | `vocab` | `collocation`, `reading_comp` | pair item 단위로 단어 의미 연결 정확도 반영 | 이미지와 단어를 의미 기준으로 매칭한다. 어휘 의미 연결이 핵심이며, 이미지/상황 맥락을 읽어야 하는 경우 독해적 판단도 일부 관여한다. |
| `WDPL02` | Memory Card | `15` | `vocab` | `collocation`, `reading_comp` | pair item 단위로 기억 성공/실패, 반복 시도 기록 | 이미지-단어 쌍을 기억해 맞추는 활동이다. 어휘 기억이 중심이지만 의미 연결과 시각 context 이해도 함께 작동한다. |
| `STBL01` | Sentence Blank | `1006` | `sentence_form` | `vocab`, `preposition`, `article`, `pronoun`, `tense`, `conjunction`, `sv_agreement`, `collocation` | blank item 유형에 따라 문법 skill로 세분화 | 문장 빈칸에 알맞은 단어를 넣는 활동이다. 기본은 문장 형태 이해이며, 빈칸의 품사/문법 기능에 따라 전치사, 관사, 대명사, 시제, 접속사, 수일치 등으로 분기한다. |
| `STSC01` | Unscramble | `1007` | `word_order` | `sentence_form`, `tense`, `conjunction`, `punctuation` | token 순서 오류 유형에 따라 `word_order`, `sentence_form`, `punctuation` 반영 | 문장 token을 올바른 순서로 배열한다. 어순이 핵심이며, 문장 구조, 시제 위치, 접속 구조, 마침표/대문자까지 관여할 수 있다. |
| `STRC01` | Sentence Record | `1009` | `speaking_fluency` | `pronunciation`, `listening_comp`, `sentence_form` | sentence 단위 녹음, STT/발음 점수, 반복 녹음 횟수로 세분화 | 문장 음성을 듣고 따라 말해 녹음하는 활동이다. 말하기 유창성이 중심이고, 발음 정확도, 듣고 따라 하는 이해, 문장 형태 재현 능력이 함께 작동한다. |
| `QCHK01` | Quick Check | `65` | `reading_comp` | `main_idea`, `detail_comp`, `inference`, `listening_comp`, `vocab` | quiz item 유형에 따라 주제/세부/추론/듣기/어휘로 세분화 | 이해도 확인 퀴즈다. 기본은 독해 이해로 두되, 문항 유형에 따라 주제 파악, 세부내용 이해, 추론, 듣기 이해, 어휘 이해로 나눈다. |

## 권장 저장 모델

### Activity Skill Definition

Activity 자체의 기본 skill 정의는 고정 테이블로 관리한다.

```json
{
  "activity_code": "STBL01",
  "primary_skill_tag": "sentence_form",
  "related_skill_tags": [
    "vocab",
    "preposition",
    "article",
    "pronoun",
    "tense",
    "conjunction",
    "sv_agreement",
    "collocation"
  ],
  "skill_weights": {
    "sentence_form": 0.5,
    "vocab": 0.2,
    "preposition": 0.05,
    "article": 0.05,
    "pronoun": 0.05,
    "tense": 0.05,
    "conjunction": 0.05,
    "sv_agreement": 0.05
  }
}
```

### Learn Event Item Skill

실제 학습 이벤트는 문항/item 단위 세부 skill을 함께 남길 수 있다.

```json
{
  "log_idx": 24,
  "events": [
    {
      "seq": 3,
      "action": "submit",
      "item_type": "sentence",
      "item_idx": 5521,
      "correct": 0,
      "extra": {
        "activity_code": "STBL01",
        "primary_skill_tag": "sentence_form",
        "item_skill_tag": "preposition",
        "selected_text": "on",
        "answer_text": "under"
      }
    }
  ]
}
```

서버에서 `activity_code`는 `log_idx`로 도출할 수 있으므로 클라이언트가 반드시 보낼 필요는 없다. 다만 분석 편의를 위해 서버 저장 단계에서 `activity_skill`과 `item_skill`을 join 또는 파생 컬럼으로 붙이는 구조가 좋다.

## 기본 가중치 제안

v1에서는 정교한 문항 metadata가 부족할 수 있으므로 Activity 단위 기본 가중치를 먼저 사용한다.

| Activity code | skill weight 예시 |
|---|---|
| `EBOOK01` | `reading_fluency: 0.45`, `listening_comp: 0.3`, `reading_comp: 0.2`, `pronunciation: 0.05` |
| `WDCA01` | `vocab: 0.75`, `pronunciation: 0.15`, `listening_comp: 0.1` |
| `WDQU01` | `vocab: 0.7`, `collocation: 0.2`, `reading_comp: 0.1` |
| `WDBL01` | `spelling: 0.65`, `phonics: 0.2`, `vocab: 0.1`, `pronunciation: 0.05` |
| `WDPL01` | `vocab: 0.75`, `collocation: 0.15`, `reading_comp: 0.1` |
| `WDPL02` | `vocab: 0.75`, `collocation: 0.15`, `reading_comp: 0.1` |
| `STBL01` | `sentence_form: 0.5`, `vocab: 0.2`, 문항별 grammar skill 합계 `0.3` |
| `STSC01` | `word_order: 0.65`, `sentence_form: 0.25`, `punctuation: 0.1` |
| `STRC01` | `speaking_fluency: 0.45`, `pronunciation: 0.35`, `listening_comp: 0.15`, `sentence_form: 0.05` |
| `QCHK01` | `reading_comp: 0.5`, 문항 유형별 skill 합계 `0.5` |

## item-level 세분화 규칙

### `STBL01` Sentence Blank

| 조건 | item-level skill |
|---|---|
| 정답이 전치사 | `preposition` |
| 정답이 관사 | `article` |
| 정답이 대명사 | `pronoun` |
| 정답이 시제 변화와 관련 | `tense` |
| 정답이 접속사 또는 문장 연결어 | `conjunction` |
| 주어-동사 수일치 문제 | `sv_agreement` |
| 어휘 선택 중심 | `vocab` |
| 어울리는 표현/용법 중심 | `collocation` |

### `STSC01` Unscramble

| 조건 | item-level skill |
|---|---|
| 전체 token 순서 오류 | `word_order` |
| 주어-동사-목적어 구조 오류 | `sentence_form` |
| 접속사 위치 또는 절 연결 오류 | `conjunction` |
| 시제 표현 위치 오류 | `tense` |
| 대문자/마침표 포함 오류 | `punctuation` |

### `QCHK01` Quick Check

| 문항 유형 | item-level skill |
|---|---|
| 중심 내용, 제목, 주제 | `main_idea` |
| 세부 사실 확인 | `detail_comp` |
| 암시, 추론, 이유 파악 | `inference` |
| 듣기 기반 문제 | `listening_comp` |
| 단어 의미 확인 | `vocab` |

### `EBOOK01` Listen & Read

| 이벤트/상황 | item-level skill |
|---|---|
| page view, reading progress | `reading_fluency` |
| audio play, audio replay | `listening_comp` |
| caption active, 문장 follow | `reading_comp` |
| 따라 읽기 또는 음성 녹음이 붙는 경우 | `pronunciation`, `speaking_fluency` |

## v1 적용 기준

1. Activity 단위로 `primary_skill_tag`, `related_skill_tags`, `skill_weights`를 먼저 정의한다.
2. `learn_event` 저장 시에는 기존 이벤트에 item-level skill을 즉시 넣기보다, 서버에서 `log_idx -> activity_code -> skill definition`으로 파생하는 방식을 우선한다.
3. 문항 metadata가 확정되면 `item_skill_tag`를 추가한다.
4. 개인화 추천에서는 대표 skill 약점과 item-level 약점을 함께 사용한다.

예시:

```text
WDBL01 오답 반복
-> spelling 약점
-> phonics 보조 약점
-> Word Blank 또는 Dictation 추천

STSC01 오답 반복
-> word_order 약점
-> Sentence Repair 또는 Unscramble 재추천

EBOOK01 audio_replays 증가
-> listening_comp 약점
-> Listen & Read 재청취 또는 Sentence Record 추천
```
