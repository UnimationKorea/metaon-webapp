# MetaOn LearnEvent 설계 - 신규 Activity Code 기준

## 1. 목적

신규 Activity code 체계(`EBOOK01`, `WDCA01`, `WDQU01`, `WDBL01`, `WDPL01`, `WDPL02`, `STBL01`, `STSC01`, `STRC01`, `QCHK01`)를 기준으로 학습자의 실제 행동을 append-only 이벤트로 저장한다.

이벤트는 단순 완료 여부가 아니라 “어떤 단어/문장/페이지에서 무엇을 했고, 맞았는지, 얼마나 걸렸는지, 몇 번 다시 들었는지”를 남기는 것을 목표로 한다. 이후 `learnAttempt`, `userWordMastery`, `userSkill`, `userProfile`은 이 원천 이벤트에서 파생한다.

## 2. 신규 Activity Code 매핑

| Activity code | 활동명 | 기존 렌더러 기준 | 주요 데이터 |
|---|---|---|---|
| `EBOOK01` | Listen & Read | `Listening`/`Reading` | page, reading audio, caption, sentence |
| `WDCA01` | Word Card | `FlashCardSpace` | word, word image, word audio |
| `WDQU01` | Word Quiz | `VocaQuizSpace` | word, distractor word choices |
| `WDBL01` | Word Blank | `VocaCheckSpace` | word, blank letter/chunk choices |
| `WDPL01` | Matching Game | `MatchingGame` | word image + word text pair |
| `WDPL02` | Memory Card | `MemoryGame` | word image + word text pair |
| `STBL01` | Sentence Blank | `SentenceCheckSpace` | sentence, blank token, word distractors |
| `STSC01` | Unscramble | `SentenceUnscrambleSpace` | sentence tokens |
| `STRC01` | Sentence Record | `SentenceShadowingSpace` | sentence audio, learner recording |
| `QCHK01` | Quick Check | `QuickCheck` | quick check quiz item |

## 3. 원천 이벤트 테이블

권장 테이블명은 `learn_event`다. insert-only로 저장하고 update/delete 하지 않는다.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | string uuid | 이벤트 고유 ID |
| `user_id` | string | 로그인 ID 또는 사용자 PK |
| `user_idx` | number | MetaOn3 사용자 PK |
| `session_id` | string | BFF/MetaOn 세션 ID |
| `client_event_id` | string | 오프라인 재전송 중복 제거용 클라이언트 UUID |
| `ts` | datetime | 클라이언트 발생 시각 |
| `server_ts` | datetime | 서버 수신 시각 |
| `book_id` | string | book code, 예: `GPLaa01` |
| `book_idx` | number | MetaOn3 book PK |
| `lesson_idx` | number | lesson PK |
| `day_idx` | number | day PK |
| `act_idx` | number | activity PK |
| `act_code` | string | 신규 activity code, 예: `WDQU01` |
| `legacy_act_code` | string nullable | 기존 숫자 코드, 예: `1004` |
| `item_type` | string | `word`, `sentence`, `page`, `quick_check`, `activity`, `recording`, `pair` |
| `item_id` | string | 실제 CMS/API PK. word는 `word_idx`, sentence는 `sentence_idx`, page는 `reading_idx` 또는 page key |
| `chunk_index` | number nullable | 페이지 내 문장 순서, 단어 내 글자 위치, 카드 index 등 |
| `action` | string | 아래 Activity별 action |
| `correct` | boolean nullable | 정오답이 있는 action에만 기록 |
| `score` | number nullable | 0-100 또는 Activity 내부 점수 |
| `time_ms` | number nullable | 해당 문항/행동 소요 시간 |
| `attempts` | number nullable | 같은 item 내 제출/시도 횟수 |
| `hints_used` | number nullable | 힌트 사용 수 |
| `audio_replays` | number nullable | 같은 item의 오디오 재생/반복 횟수 |
| `band` | string nullable | 현재 학습 난이도/레벨 밴드 |
| `extra` | json | 선택지 순서, 선택값, 정답, 녹음 길이, view mode 등 Activity별 추가 정보 |

## 4. 공통 이벤트

모든 Activity는 최소 아래 이벤트를 남긴다.

| action | item_type | item_id | 설명 |
|---|---|---|---|
| `activity_start` | `activity` | `act_idx` | Activity 화면 진입 |
| `activity_ready` | `activity` | `act_idx` | 리소스/렌더러 준비 완료 |
| `activity_pause` | `activity` | `act_idx` | 앱 background, route 이탈, 오디오 pause |
| `activity_resume` | `activity` | `act_idx` | 재개 |
| `activity_end` | `activity` | `act_idx` | 완료 또는 종료 |
| `activity_retry` | `activity` | `act_idx` | Retry 버튼 |
| `activity_next` | `activity` | `act_idx` | 다음 item/Activity 이동 |

`activity_end.extra`에는 `end_reason`, `completed`, `total_items`, `answered_items`, `correct_count`, `score`, `duration_ms`를 넣는다.

## 5. Activity별 이벤트 설계

### `EBOOK01` Listen & Read

| action | item_type | item_id | correct | 핵심 extra |
|---|---|---|---|---|
| `page_view` | `page` | `reading_idx` 또는 `page:{page_no}` | null | `page_no`, `view_mode`, `spread_mode` |
| `audio_play` | `page`/`sentence` | `reading_idx` 또는 `sentence_idx` | null | `audio_path`, `audio_index`, `position_ms` |
| `audio_pause` | `page`/`sentence` | 동일 | null | `position_ms` |
| `audio_replay` | `page`/`sentence` | 동일 | null | `replay_count` |
| `caption_active` | `sentence` | `sentence_idx` 또는 synthetic cue id | null | `caption_text`, `page_no`, `audio_index` |
| `page_next` | `page` | 현재 page id | null | `from_page`, `to_page` |
| `page_prev` | `page` | 현재 page id | null | `from_page`, `to_page` |
| `view_mode_change` | `activity` | `act_idx` | null | `from`, `to`, `orientation` |

설계 원칙: `caption_active`는 너무 자주 저장하지 않고 문장 cue가 바뀔 때 1회만 저장한다. 단어 단위 timestamp가 없는 경우 문장 단위만 기록한다.

### `WDCA01` Word Card

| action | item_type | item_id | correct | 핵심 extra |
|---|---|---|---|---|
| `card_view` | `word` | `word_idx` | null | `card_index`, `side:image` |
| `card_flip` | `word` | `word_idx` | null | `from_side`, `to_side`, `flip_count` |
| `audio_play` | `word` | `word_idx` | null | `audio_path`, `replay_count` |
| `known_mark` | `word` | `word_idx` | boolean | `mark:known/unknown` |

현재 UI가 “이미지 클릭 -> 소리 재생 -> 카드 flip” 구조이므로 한 번의 클릭에서 `audio_play`와 `card_flip`을 모두 남긴다.

### `WDQU01` Word Quiz

| action | item_type | item_id | correct | 핵심 extra |
|---|---|---|---|---|
| `question_view` | `word` | `word_idx` | null | `question_index`, `option_order` |
| `audio_play` | `word` | `word_idx` | null | `audio_path`, `replay_count` |
| `option_select` | `word` | `word_idx` | null | `selected_word_idx`, `selected_text` |
| `submit` | `word` | `word_idx` | boolean | `answer_word_idx`, `selected_word_idx`, `option_order` |

랜덤 선택지 배치가 학습결과 해석에 중요하므로 `option_order`를 반드시 저장한다.

### `WDBL01` Word Blank

| action | item_type | item_id | correct | 핵심 extra |
|---|---|---|---|---|
| `question_view` | `word` | `word_idx` | null | `blank_pattern`, `blank_indexes`, `option_order` |
| `letter_select` | `word` | `word_idx` | null | `selected_letter`, `blank_index` |
| `submit` | `word` | `word_idx` | boolean | `answer`, `selected`, `blank_indexes` |
| `hint_use` | `word` | `word_idx` | null | `hint_type` |

글자 단위 분석이 필요하면 `chunk_index`에 blank 위치를 넣는다.

### `WDPL01` Matching Game

| action | item_type | item_id | correct | 핵심 extra |
|---|---|---|---|---|
| `board_view` | `activity` | `act_idx` | null | `left_order`, `right_order` |
| `pair_select` | `pair` | `word_idx` | null | `source_side`, `target_side` |
| `pair_submit` | `pair` | `word_idx` | boolean | `selected_word_idx`, `target_word_idx` |
| `pair_match` | `word` | `word_idx` | true | `attempts_for_pair` |

매칭 게임은 한 번의 선택으로 정오답을 바로 판단할 수 있으면 `pair_submit`으로 통합해도 된다.

### `WDPL02` Memory Card

| action | item_type | item_id | correct | 핵심 extra |
|---|---|---|---|---|
| `board_view` | `activity` | `act_idx` | null | `card_order`, `pair_count` |
| `card_open` | `word` | `word_idx` | null | `card_id`, `card_kind:image/text` |
| `pair_attempt` | `pair` | `word_idx` | boolean | `first_card_id`, `second_card_id` |
| `pair_match` | `word` | `word_idx` | true | `attempts_for_pair` |
| `board_complete` | `activity` | `act_idx` | null | `total_attempts`, `mismatch_count` |

카드 위치 랜덤성이 결과에 영향을 주므로 `card_order`를 저장한다.

### `STBL01` Sentence Blank

| action | item_type | item_id | correct | 핵심 extra |
|---|---|---|---|---|
| `question_view` | `sentence` | `sentence_idx` | null | `blank_token`, `blank_index`, `option_order` |
| `audio_play` | `sentence` | `sentence_idx` | null | `audio_path`, `replay_count` |
| `option_select` | `sentence` | `sentence_idx` | null | `selected_word_idx`, `selected_text` |
| `submit` | `sentence` | `sentence_idx` | boolean | `answer_text`, `selected_text`, `blank_index` |

단어 distractor를 쓰는 경우 `extra.option_order[]`에 `word_idx`와 text를 함께 저장한다.

### `STSC01` Unscramble

| action | item_type | item_id | correct | 핵심 extra |
|---|---|---|---|---|
| `question_view` | `sentence` | `sentence_idx` | null | `token_order`, `token_count` |
| `token_select` | `sentence` | `sentence_idx` | null | `token`, `source_index`, `target_index` |
| `token_remove` | `sentence` | `sentence_idx` | null | `token`, `source_index` |
| `submit` | `sentence` | `sentence_idx` | boolean | `selected_tokens`, `answer_tokens` |

문장 내 token 순서 능력을 분석하기 위해 `token_order`와 최종 `selected_tokens`를 저장한다.

### `STRC01` Sentence Record

| action | item_type | item_id | correct | 핵심 extra |
|---|---|---|---|---|
| `sentence_view` | `sentence` | `sentence_idx` | null | `sentence_text` |
| `audio_play` | `sentence` | `sentence_idx` | null | `audio_path`, `replay_count` |
| `record_start` | `sentence` | `sentence_idx` | null | `recording_attempt` |
| `record_stop` | `recording` | `sentence_idx` | null | `duration_ms`, `blob_size` |
| `record_playback` | `recording` | `sentence_idx` | null | `playback_count` |
| `recognition_result` | `sentence` | `sentence_idx` | nullable | `transcript`, `confidence`, `wer`, `api_status` |
| `submit` | `sentence` | `sentence_idx` | boolean nullable | `score`, `recognition_provider` |

필기/음성 인식 API가 보류 또는 실패해도 `record_start/stop`은 남겨야 한다.

### `QCHK01` Quick Check

| action | item_type | item_id | correct | 핵심 extra |
|---|---|---|---|---|
| `quiz_load` | `activity` | `act_idx` | null | `quiz_count`, `source:api` |
| `question_view` | `quick_check` | `qc_idx` | null | `question_index`, `question_type`, `option_order` |
| `option_select` | `quick_check` | `qc_idx` | null | `selected_option`, `selected_text` |
| `submit` | `quick_check` | `qc_idx` | boolean | `right_answer`, `selected_option` |
| `quiz_accept` | `activity` | `act_idx` | null | `correct_count`, `total_count`, `score`, `api_status` |

기존 `/study/getquickcheckquiz`, `/study/quizaccept` 흐름과 연결한다.

## 6. item_id 규칙

개인화 품질은 `item_id`가 실제 CMS/API PK를 가리키는지에 달려 있다.

| item_type | 우선 item_id | fallback |
|---|---|---|
| `word` | `word_idx` | `word:{book_idx}:{day_idx}:{order}` |
| `sentence` | `sentence_idx` | `sentence:{book_idx}:{day_idx}:{order}` |
| `page` | `reading_idx` | `page:{book_idx}:{day_idx}:{page_no}` |
| `quick_check` | `qc_idx` | `qc:{act_idx}:{question_index}` |
| `activity` | `act_idx` | `activity:{book_idx}:{day_idx}:{act_code}` |
| `recording` | `sentence_idx` + client recording id in `extra` | `recording:{client_event_id}` |
| `pair` | 정답 기준 `word_idx` | `pair:{word_item_id}` |

현재 synthetic JSON 생성 시 `word_idx`, `sentence_idx`, `reading_idx`가 일부 렌더러 데이터에 보존되지 않을 수 있다. LearnEvent 구현 전 `info_word.json`, `info_sentence.json`, `info_listen_ebook.json`에 원본 PK를 포함해야 한다.

## 7. Activity 시도 요약

원천 이벤트와 별도로 `learn_attempt`를 유지한다.

| 컬럼 | 설명 |
|---|---|
| `id` | attempt UUID |
| `user_idx` | 사용자 PK |
| `session_id` | 세션 |
| `book_idx` | Book PK |
| `day_idx` | Day PK |
| `act_idx` | Activity PK |
| `act_code` | 신규 Activity code |
| `started_at` | 시작 시각 |
| `ended_at` | 종료 시각 |
| `duration_ms` | 총 학습 시간 |
| `completed` | 완료 여부 |
| `score` | 0-100 |
| `correct_count` | 정답 수 |
| `total_count` | 전체 문항 수 |
| `wrong_item_ids` | 틀린 item id list |
| `audio_replays` | 총 오디오 반복 |
| `hints_used` | 힌트 총합 |
| `band` | 활동 난이도 밴드 |

`learn_attempt`는 대시보드/이어하기/통계용이고, 개인화 판단은 원천 이벤트에서 다시 계산 가능해야 한다.

## 8. 파생 모델

| 모델 | 입력 이벤트 | 목적 |
|---|---|---|
| `user_word_mastery` | `WDCA01`, `WDQU01`, `WDBL01`, `WDPL01`, `WDPL02` | 단어별 seen/correct/strength/next_review |
| `user_sentence_mastery` | `STBL01`, `STSC01`, `STRC01`, `EBOOK01` caption/audio | 문장별 이해/어순/발화 숙련도 |
| `user_skill` | activity code별 submit/end | `vocabulary`, `spelling`, `grammar_order`, `listening`, `speaking`, `reading` 도메인 점수 |
| `user_profile` | 모든 attempt/event | band, streak, 약점 태그, 추천 전략 |

권장 skill 매핑:

| Activity code | skill domain |
|---|---|
| `EBOOK01` | `reading`, `listening`, `tracking` |
| `WDCA01` | `vocabulary_exposure` |
| `WDQU01` | `vocabulary_recognition` |
| `WDBL01` | `spelling`, `word_form` |
| `WDPL01` | `word_meaning_match` |
| `WDPL02` | `word_memory` |
| `STBL01` | `sentence_context`, `grammar_vocab` |
| `STSC01` | `sentence_order`, `syntax` |
| `STRC01` | `speaking`, `pronunciation` |
| `QCHK01` | `comprehension`, `assessment` |

## 9. 클라이언트 수집 방식

1. Activity 진입 시 `attempt_id`를 생성한다.
2. 모든 이벤트에는 `client_event_id`를 붙인다.
3. 네트워크 실패 시 IndexedDB queue에 저장한다.
4. `/api/learn-events`로 batch 전송한다.
5. 서버는 `client_event_id` 기준 idempotent insert를 수행한다.
6. Activity 종료 시 `learn_attempt` 요약을 같이 전송하거나 서버에서 이벤트 집계로 생성한다.

권장 batch payload:

```json
{
  "attempt": {
    "attempt_id": "uuid",
    "book_idx": 6710,
    "day_idx": 978,
    "act_idx": 12883,
    "act_code": "WDCA01"
  },
  "events": [
    {
      "client_event_id": "uuid",
      "ts": "2026-07-07T10:00:00.000Z",
      "item_type": "word",
      "item_id": "8128",
      "action": "card_flip",
      "correct": null,
      "time_ms": 1200,
      "extra": {
        "from_side": "image",
        "to_side": "word"
      }
    }
  ]
}
```

## 10. 우선 구현 순서

1. `word_idx`, `sentence_idx`, `reading_idx`를 generated package JSON에 보존한다.
2. `LearnEvent` 타입과 `LearnEventRecorder` client port를 만든다.
3. Activity 공통 wrapper에서 `activity_start`, `activity_ready`, `activity_end`를 자동 기록한다.
4. `WDCA01`, `WDQU01`, `WDBL01`부터 item-level submit/card/audio 이벤트를 붙인다.
5. `EBOOK01`의 `page_view`, `audio_play`, `caption_active`를 붙인다.
6. IndexedDB queue와 `/api/learn-events` batch endpoint를 붙인다.
7. `learn_attempt` 요약과 `user_word_mastery` 파생 집계를 서버 또는 배치 작업으로 만든다.

## 11. 구현 시 주의점

- pointer move, drag move 같은 고빈도 이벤트는 원천 로그에 그대로 남기지 않는다. 게임 결과 해석에 필요한 `drop`, `match`, `submit`, `duration` 중심으로 남긴다.
- 랜덤 배치가 있는 Activity는 반드시 `option_order` 또는 `card_order`를 저장한다.
- `correct`는 판단 가능한 순간에만 저장한다. 녹음/인식 실패처럼 평가가 불완전하면 `correct:null`, `extra.api_status`로 남긴다.
- 로그는 학습 화면의 성능을 방해하지 않아야 하므로 batch/queue 방식으로 비동기 전송한다.
- 신규 `act_code`를 canonical key로 사용하고, 기존 숫자 코드는 `legacy_act_code`에 보존한다.
