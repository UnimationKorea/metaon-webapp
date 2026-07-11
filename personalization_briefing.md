# MetaOn 개인화 학습 적용 브리핑

작성일: 2026-07-08

## 1. 핵심 요약

MetaOn의 개인화는 `learn_event`에 저장되는 학습 행동 데이터를 기반으로 구현한다. 단순 완료 여부가 아니라 단어, 문장, 페이지, 퀴즈 item 단위로 정답률, 반복 청취, 시도 횟수, 소요 시간, 힌트 사용, 녹음 결과 등을 분석해 다음 학습을 제안한다.

개인화 Activity는 두 가지 형태로 나누는 것이 적합하다.

| 구분 | 역할 | 예시 |
|---|---|---|
| Book 종속 개인화 | 특정 Book 안에서 약점 item을 보정 | “이 Book 맞춤 복습”, “틀린 단어만 다시 하기” |
| 별도 개인화 Activity | 여러 Book의 누적 약점을 모아 재학습 | “오늘의 맞춤 학습”, “약점 단어 복습” |
| Hybrid 개인화 | Book 완료 후 해당 Book 약점만 재출제 | “GPLaa01 다시 연습” |

권장 도입 순서는 **Book 내부 개인화 먼저 적용** 후, 데이터가 쌓이면 **홈 화면의 누적 개인화 영역**으로 확장하는 방식이다.

## 2. 개인화에 사용할 주요 데이터

`learn_event`는 신규 Activity code 기준으로 저장한다.

| Activity code | 활동명 | 주요 분석 대상 |
|---|---|---|
| `EBOOK01` | Listen & Read | 페이지 체류, 오디오 반복, caption 진행, 문장 이해 |
| `WDCA01` | Word Card | 카드 flip, 오디오 재생, 단어 노출 |
| `WDQU01` | Word Quiz | 단어 선택 정오답, 선택지 반응 |
| `WDBL01` | Word Blank | 철자/글자 단위 약점 |
| `WDPL01` | Matching Game | 이미지-단어 의미 연결 |
| `WDPL02` | Memory Card | 단어 기억, 이미지-텍스트 매칭 |
| `STBL01` | Sentence Blank | 문맥 속 단어 사용 |
| `STSC01` | Unscramble | 문장 어순, syntax |
| `STRC01` | Sentence Record | 말하기, 발음, 녹음 반복 |
| `QCHK01` | Quick Check | 이해도 평가 |

분석에는 다음 이벤트 필드를 주로 사용한다.

| 필드 | 활용 |
|---|---|
| `item_id` | `word_idx`, `sentence_idx`, `reading_idx`, `qc_idx` 단위 약점 추적 |
| `correct` | 정오답 기반 숙련도 계산 |
| `time_ms` | 빠르게 맞혔는지, 오래 고민했는지 판단 |
| `attempts` | 같은 item 반복 시도 횟수 |
| `audio_replays` | 듣기 어려움 또는 발음 확인 필요 여부 |
| `hints_used` | 독립 해결 가능 여부 |
| `extra.option_order` | 랜덤 선택지 배치 분석 |
| `extra.card_order` | Memory/Matching 랜덤 카드 배치 분석 |

## 3. 가능한 개인화 형태

| 개인화 형태 | 판단 기준 | 사용자에게 보이는 방식 |
|---|---|---|
| 단어별 복습 추천 | 단어별 오답, 긴 반응 시간, 반복 시도 | “오늘 복습할 단어 8개” |
| 문장별 약점 보정 | Sentence Blank/Unscramble/Record 실패 | “문장 순서 집중 연습” |
| 듣기 보강 | Listen & Read에서 오디오 반복, 페이지 체류 증가 | “많이 반복해서 들은 페이지 다시 듣기” |
| Activity 순서 조정 | 특정 Activity에서 실패율이 높음 | Word Quiz 전에 Word Card 먼저 제시 |
| 난이도 밴드 조정 | 정답률, 소요 시간, 힌트 사용 | 쉬움/기본/도전 자동 전환 |
| 간격 반복 학습 | 마지막 학습일, 숙련도, 오답 횟수 | 1일/3일/7일 후 복습 |
| 다음 Book 추천 | 완료율, skill 수준, Book 레벨 | “다음에 학습할 책” 추천 |
| 고학년용 Activity 추천 | sentence 숙련도, grammar 약점 | Grammar Transform, Paraphrase Match 제시 |

## 4. Book 종속 Activity와 별도 개인화 Activity

### 4.1 Book 종속 Activity

Book 상세 안에 포함된 정규 Activity 흐름이다.

예시:

- GPLaa01의 `EBOOK01` Listen & Read
- GPLaa01의 `WDCA01` Word Card
- GPLaa01의 `WDQU01` Word Quiz

이 영역에서의 개인화는 **Book 안의 순서, 강조, 재출제 범위**를 조정하는 방식이다.

예:

- GPLaa01에서 `log`, `pot`을 자주 틀림
- 같은 Book의 Word Quiz에서 해당 단어를 우선 재출제
- Listen & Read에서 반복 청취가 많았던 페이지를 다시 제시

### 4.2 별도 개인화 Activity

여러 Book에서 누적된 약점 item을 모아 만드는 별도 학습 세션이다.

예시:

- 오늘의 맞춤 학습
- 약점 단어 복습
- 문장 순서 집중 연습
- 듣기 재훈련
- 스펠링 보강
- 고학년 문법 변환 연습

이 Activity는 특정 Book 하나에 묶이지 않고, 여러 Book의 `word_idx`, `sentence_idx`, `reading_idx`를 조합해 생성할 수 있다.

### 4.3 권장 구조

초기에는 Book 종속 개인화로 시작한다. 이유는 데이터 범위가 작고, 학생이 “왜 이 복습이 나왔는지” 이해하기 쉽기 때문이다.

1. Book 정규 Activity 수행
2. `learn_event` 저장
3. 해당 Book 안에서 약점 요약 표시
4. “이 Book 맞춤 복습” 제공
5. 여러 Book 누적 후 홈에 “오늘의 맞춤 학습” 제공

## 5. 홈페이지 개인화 UI

홈페이지는 특정 Book에 들어가기 전의 화면이므로 **전체 누적 개인화**를 보여준다.

권장 영역은 3개다.

| 영역 | 목적 | 예시 |
|---|---|---|
| 이어서 학습 | 중단한 Book/Activity 재개 | “Ancient Egypt 3번째 Activity부터 이어하기” |
| 오늘의 맞춤 복습 | 여러 Book의 약점 item 재출제 | “틀린 단어 8개, 문장 4개 복습” |
| 추천 학습 | 다음 Book 또는 난이도 추천 | “현재 수준에 맞는 다음 Book” |

홈 화면에서는 “오늘의 맞춤 학습”을 가장 큰 카드로 배치하는 것이 좋다.

```text
┌────────────────────────────┐
│ 오늘의 맞춤 학습             │
│ 단어 8개 · 문장 4개 · 듣기 2개 │
│ [맞춤 복습 시작]              │
└────────────────────────────┘
```

카드 클릭 시 별도 개인화 Activity 세션으로 진입한다.

추천 문구 예:

- “최근 자주 틀린 단어를 먼저 복습해요.”
- “문장 순서가 헷갈렸던 문제를 다시 연습해요.”
- “많이 반복해서 들은 페이지를 다시 확인해요.”

## 6. Book 내부 개인화 UI

Book 상세 화면에서는 해당 Book 기준의 약점을 보여준다. 정규 Activity 큐브 흐름을 유지하되, 상단 또는 큐브 근처에 개인화 영역을 추가한다.

권장 구성:

```text
Book Title

[정규 학습 시작] [이 Book 맞춤 복습]

약점 요약
- 단어: 3개 더 연습 필요
- 문장: 어순 2개 오답
- 듣기: 1페이지 반복 청취 많음

Activity 큐브 흐름
EBOOK01 → WDCA01 → WDQU01 → WDBL01 → ...
```

Book 내부 개인화 위치:

| 위치 | UI | 역할 |
|---|---|---|
| Book 상단 | “이 Book 맞춤 복습” 버튼 | 해당 Book의 약점만 모아 재학습 |
| Activity 큐브 | 완료/주의/복습 필요/추천 상태 표시 | 어떤 Activity가 약한지 즉시 파악 |
| Activity 완료 후 | “틀린 것만 다시 하기” 제안 | 즉시 보정 학습 |

Activity 큐브 상태 예:

| 상태 | 표시 |
|---|---|
| 완료 | 초록 테두리 또는 완료 배지 |
| 복습 필요 | 주황 테두리 |
| 추천 | 별표 또는 강조 배경 |
| 미학습 | 기본 상태 |

예:

```text
[EBOOK01 완료] → [WDCA01 복습필요] → [WDQU01 추천] → [WDBL01 대기]
```

## 7. 개인화 추천 로직 예시

초기에는 규칙 기반으로 충분하다.

```text
정답률 85% 이상 + 풀이 시간 짧음
→ 다음 Activity 또는 다음 Day로 진행

정답률 60% 미만 + attempts 2회 이상
→ 같은 item을 더 쉬운 Activity로 복습

audio_replays 3회 이상
→ listening 약점으로 표시하고 EBOOK01/STRC01 추천

STSC01 오답 반복
→ sentence_order 약점으로 표시하고 Sentence Repair 추천

WDBL01 오답 반복
→ spelling 약점으로 표시하고 Word Blank/Dictation 추천
```

## 8. 파생 모델

원천 이벤트를 바로 화면에서 쓰기보다 아래 파생 모델을 만든 뒤 UI에 연결한다.

| 모델 | 역할 |
|---|---|
| `user_word_mastery` | 단어별 숙련도, 다음 복습일 계산 |
| `user_sentence_mastery` | 문장별 이해, 어순, 발화 숙련도 계산 |
| `user_skill` | vocabulary, spelling, listening, speaking 등 영역별 점수 |
| `user_profile` | 전체 난이도 밴드, 약점 태그, 추천 전략 |

## 9. 구현 우선순위

1. `learn_event`에 item-level 로그 저장
2. `word_idx`, `sentence_idx`, `reading_idx`, `qc_idx` 보존
3. Book 내부 “복습 필요” 상태 표시
4. Book 상세에 “이 Book 맞춤 복습” 버튼 추가
5. Activity 완료 후 “틀린 것만 다시 하기” 제공
6. 홈 화면에 “오늘의 맞춤 학습” 카드 추가
7. 여러 Book 누적 약점 기반 별도 개인화 Activity 구성

## 10. 결론

개인화는 Book 안에만 묶는 방식보다, **Book 내부 개인화**와 **홈 기반 누적 개인화**를 함께 가져가는 것이 적합하다.

초기 MVP는 다음 범위가 가장 현실적이다.

- Book 상세에서 해당 Book 약점 요약 표시
- Activity 큐브에 `복습 필요`/`추천` 상태 표시
- “이 Book 맞춤 복습” 버튼 제공
- 이후 홈 화면에 “오늘의 맞춤 학습”으로 확장

이 접근은 기존 정규 학습 흐름을 유지하면서도, `learn_event` 기반 개인화의 효과를 사용자에게 빠르게 보여줄 수 있다.
