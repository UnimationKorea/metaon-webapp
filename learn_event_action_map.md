# LearnEvent Action 목록

## 기준

- 대상: `POST /api/learn/events`
- 기준 코드: `src/components/activities/PackageActivities.tsx`, `src/features/quickCheck/`, `src/pages/ActivityPage.tsx`
- 작성일: 2026-08-12
- 아래 action은 클라이언트 renderer가 기록하는 값이다. 실제 서버 전송은 Activity 완료 시점에 event 묶음을 고정한 뒤 한 번만 이뤄진다. 미완료 Activity의 event는 전송하거나 outbox에 보관하지 않는다.

## 공통 Lifecycle Action

| 적용 대상 | action | 의미 |
| --- | --- | --- |
| 일반 Activity | `activity_complete` | Activity 완료 처리. 완료 점수, 정답 수, 전체 문항 수를 함께 기록할 수 있음 |

> `QCHK01`, `NPCQHK01`, `NPCQHK02`는 LearnEvent 규약의 공통 전송 제외 대상이다. 해당 Activity renderer 내부에 남아 있는 `record()` 호출이 IndexedDB outbox로 전달되지 않도록 별도 차단이 필요하다.

## 신규 Activity 코드별 Action

| Activity code | Activity | action | 의미 |
| --- | --- | --- | --- |
| `EBOOK01` | Listen & Read - Reading 모드 | `page_view` | 페이지 열람 |
| `EBOOK01` | Listen & Read - Reading 모드 | `page_next` | 다음 페이지 이동 |
| `EBOOK01` | Listen & Read - Reading 모드 | `page_prev` | 이전 페이지 이동 |
| `EBOOK01` | Listen & Read - Reading 모드 | `audio_play` | 페이지 또는 단어 음원 재생 |
| `EBOOK01` | Listen & Read - Reading 모드 | `record_start` | 문장 녹음 시작 |
| `EBOOK01` | Listen & Read - Reading 모드 | `record_stop` | 문장 녹음 종료 |
| `EBOOK01` | Listen & Read - E-book/Listening 모드 | `page_view` | E-book 페이지 열람 |
| `EBOOK01` | Listen & Read - E-book/Listening 모드 | `page_next` | 다음 페이지 이동 |
| `EBOOK01` | Listen & Read - E-book/Listening 모드 | `page_prev` | 이전 페이지 이동 |
| `EBOOK01` | Listen & Read - E-book/Listening 모드 | `audio_play` | 현재 페이지 음원 재생 |
| `EBOOK01` | Listen & Read - E-book/Listening 모드 | `audio_pause` | 현재 페이지 음원 일시정지 |
| `EBOOK01` | Listen & Read - E-book/Listening 모드 | `audio_replay` | 현재 페이지 음원 다시 재생 |
| `EBOOK01` | Listen & Read - E-book/Listening 모드 | `caption_active` | 현재 자막 cue 활성화 |
| `EBOOK01` | Listen & Read - E-book/Listening 모드 | `activity_complete` | 마지막 페이지까지 음원 재생 완료 |
| `WDCA01`, `WDCA02` | Word Card | `card_view` | 단어 카드 표시 |
| `WDCA01`, `WDCA02` | Word Card | `audio_play` | 단어 음원 재생 |
| `WDCA01`, `WDCA02` | Word Card | `card_flip` | 카드 앞뒤 뒤집기 |
| `WDCA01`, `WDCA02` | Word Card | `more_info_toggle` | MORE INFO 토글 변경 |
| `WDQU01`, `WDQU03` | Word Quiz | `question_view` | 문제 표시 |
| `WDQU01`, `WDQU03` | Word Quiz | `option_select` | 선택지 선택 |
| `WDQU01`, `WDQU03` | Word Quiz | `answer_scored` | 정답 제출 및 정오답 판정 |
| `WDQU01`, `WDQU03` | Word Quiz | `audio_play` | 문제 또는 단어 음원 재생 |
| `WDQU02` | Word Search형 Quiz | `question_view` | 문제 표시 |
| `WDQU02` | Word Search형 Quiz | `option_select` | 선택지 선택 |
| `WDQU02` | Word Search형 Quiz | `answer_scored` | 정답 제출 및 정오답 판정 |
| `WDQU02` | Word Search형 Quiz | `audio_play` | 문제 또는 단어 음원 재생 |
| `WDBL01`, `WDBL02` | Word Blank | `question_view` | 문제 표시 |
| `WDBL01`, `WDBL02` | Word Blank | `letter_select` | 철자 선택 |
| `WDBL01`, `WDBL02` | Word Blank | `answer_scored` | 정답 제출 및 정오답 판정 |
| `WDBL01`, `WDBL02` | Word Blank | `audio_play` | 단어 음원 재생 |
| `WDPL01` | Matching Game | `board_view` | 매칭 보드 표시 |
| `WDPL01` | Matching Game | `answer_scored` | 이미지와 단어의 매칭 시도. 정오답 포함 |
| `WDPL01` | Matching Game | `pair_match` | 정답 매칭 완료 상태 |
| `WDPL02` | Memory Card | `board_view` | 라운드 보드 표시 |
| `WDPL02` | Memory Card | `card_open` | 카드 한 장 열기 |
| `WDPL02` | Memory Card | `answer_scored` | 두 카드 비교 시도. 정오답 포함 |
| `WDPL02` | Memory Card | `pair_match` | 정답 카드 쌍 완성 |
| `WDPL02` | Memory Card | `hint_open` | 힌트 사용 |
| `WDPL02` | Memory Card | `round_complete` | 마지막 라운드 전 라운드 완료 |
| `WDPL02` | Memory Card | `round_timeout` | 제한 시간 종료 |
| `WDPL02` | Memory Card | `activity_restart` | 처음부터 다시 시작 |
| `WDPL02` | Memory Card | `activity_complete` | 마지막 라운드 완료 |
| `STBL01`, `STBL02` | Sentence Blank | `question_view` | 문장 문제 표시 |
| `STBL01`, `STBL02` | Sentence Blank | `option_select` | 빈칸 선택지 선택 |
| `STBL01`, `STBL02` | Sentence Blank | `answer_scored` | 정답 제출 및 정오답 판정 |
| `STBL01`, `STBL02` | Sentence Blank | `audio_play` | 문장 음원 재생 |
| `STSC01`, `STSC02` | Sentence Unscramble | `question_view` | 문장 순서 문제 표시 |
| `STSC01`, `STSC02` | Sentence Unscramble | `token_select` | 단어 토큰 선택 |
| `STSC01`, `STSC02` | Sentence Unscramble | `answer_scored` | 문장 순서 정답 제출 및 정오답 판정 |
| `STSC01`, `STSC02` | Sentence Unscramble | `audio_play` | 문장 음원 재생 |
| `STRC01`, `STRC02` | Sentence Record | `question_view` | 녹음 문장 문제 표시 |
| `STRC01`, `STRC02` | Sentence Record | `audio_play` | 원어민 문장 음원 재생 |
| `STRC01`, `STRC02` | Sentence Record | `record_start` | 녹음 시작 |
| `STRC01`, `STRC02` | Sentence Record | `record_stop` | 녹음 종료. 녹음 파일 업로드 및 인식 결과를 extra에 포함 가능 |
| `WDWR02` | Write Word | `question_view` | 단어 쓰기 문제 표시 |
| `WDWR02` | Write Word | `audio_play` | 단어 음원 재생 |
| `WDWR01`, `WDWR02` | Write Word | `answer_scored` | 키보드 또는 필기 인식 결과의 정오답 판정 |
| `MOVIE01` | Movie | `movie_mode_select` | Movie, Script, Movie+Script 모드 선택 |
| `MOVIE01` | Movie | `video_view`, `video_play`, `video_pause`, `video_complete` | Movie 또는 Script 재생 상태 |

## Quick Check 계열 Renderer 내부 Action

아래 action은 renderer 내부에 구현되어 있지만, 현 LearnEvent 규약에서는 `QCHK01`, `NPCQHK01`, `NPCQHK02`를 공통 LearnEvent 전송 대상에서 제외한다.

| Activity code | action | 의미 |
| --- | --- | --- |
| `QCHK01` | `answer_scored` | Quick Check 문항 정오답 결과. 공통 LearnEvent 전송에서는 제외 |
| `NPCQHK01`, `NPCQHK02` | `npc_intro` | NPC Activity 초기 진입 |
| `NPCQHK01`, `NPCQHK02` | `scenario_start` | 시나리오 시작 노드 진입 |
| `NPCQHK01`, `NPCQHK02` | `dialogue_view` | NPC 대화 노드 표시 |
| `NPCQHK01`, `NPCQHK02` | `scenario_node_view` | 대화 외 시나리오 노드 표시 |
| `NPCQHK01`, `NPCQHK02` | `branch_taken` | 정오답에 따른 시나리오 분기 선택 |
| `NPCQHK01`, `NPCQHK02` | `question_view` | Quick Check 문제 표시 |
| `NPCQHK01`, `NPCQHK02` | `hint_request` | 힌트 요청 |
| `NPCQHK01`, `NPCQHK02` | `answer_submit` | 답안 제출 |
| `NPCQHK01`, `NPCQHK02` | `answer_scored` | 문항 또는 연결 콘텐츠의 정오답 결과. 공통 LearnEvent 전송에서는 제외 |
| `NPCQHK01`, `NPCQHK02` | `activity_submit` | 전체 Activity 결과 제출 |
| `NPCQHK01`, `NPCQHK02` | `scenario_complete` | 시나리오 종료 노드 도달 |

## 참고 사항

- `answer_scored`는 유일한 정오답 평가 event다. `correct`, `q_no`, `attempts`, `skill`은 반드시 기록하며 `time_ms`, `q_total`, `attempt_max`은 선택이다.
- `pair_match`, `round_complete`, `round_timeout`, `card_flip`, `audio_play` 등은 학습 과정 또는 상태 event다. 정오답 분석의 기준 event와 분리하여 사용한다.
- 동영상형 Activity(`WDCA02`, `WDQU03`, `WDBL02`, `STBL02`, `STSC02`, `STRC02`)는 기본형과 action이 같으며, 동영상 배경의 play/pause는 별도 LearnEvent action으로 전송하지 않는다.
