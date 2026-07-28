# MetaOn 전체 포인트 정책

작성일: 2026-07-28
대상: `D:\Codex\MetaOn\Assets\Uniplayer` Unity 원본과 `D:\Codex\MetaOn\webapp` 웹앱 현재 구현

## 1. 정책 결론

MetaOn의 포인트 지급, 차감, 중복 지급 방지, 현재 잔액은 **반드시 서버가 최종 결정**한다. Unity와 웹앱은 학습 완료 또는 보상 수령 요청을 보내고, 서버가 반환한 누적 잔액을 화면에 반영하는 클라이언트다.

따라서 다음 원칙을 적용한다.

1. 클라이언트의 정답 판정, 타이머, 로컬 완료 여부는 학습 피드백과 요청 생성에만 사용한다.
2. 포인트 지급 여부와 금액은 `/study/end`, Quick Check 제출, 보상 수령 API 등의 서버 응답만 근거로 한다.
3. `spoint` 또는 `userSPoint`의 전후 차이는 화면 연출용으로만 계산할 수 있으며, 클라이언트가 다시 지급하거나 원장처럼 저장하면 안 된다.
4. 재시도, 새로고침, 여러 기기 접속에서도 중복 포인트가 발생하지 않도록 서버는 요청을 멱등 처리해야 한다.
5. `learn_event`는 학습 분석 이벤트이며 포인트 원장이나 지급 권한이 아니다.

> 문서의 Unity 동작은 소스 코드에서 확인한 사실이고, MetaOn3 서버의 실제 응답 필드·금액·중복 정책은 별도 API 검증이 필요하다. 서버 미확인 항목은 확정 정책으로 해석하지 않는다.

## 2. 포인트와 상태 용어

| 항목 | Unity/API 필드 | 의미 | 처리 원칙 |
|---|---|---|---|
| 스타 포인트 | `PlayerInfo.Point`, `spoint`, `userSPoint`, `userPoint`, `uspoint` | 사용자가 보유한 누적 포인트 잔액 | 서버 반환값으로 교체한다. |
| 레벨 포인트 | `PlayerInfo.LPoint`, `lpoint`, `userLPoint` | 레벨 성장에 쓰이는 누적 포인트 | 서버 반환값으로 교체한다. |
| 레벨 | `PlayerInfo.LLevel`, `llevel` | 현재 학습 레벨 | 레벨 포인트와 함께 서버 반환값으로 갱신한다. |
| 이번 신규 포인트 | `new_point_cnt`, `new_point`, `qPointlist[].point` | 이번 요청으로 새로 지급된 포인트 | 서버가 명시한 값만 표시한다. |
| 기존 획득 상태 | `resultQuizlog`, `qPointlist`, 문항별 `pointState` | 같은 문제에서 이미 포인트를 받은 상태 | UI에 "기획득"으로만 표시하고 재지급하지 않는다. |
| Book 누적 포인트 | `nowbookPoint` | 특정 Book에서 누적한 스타 포인트 | 조회값이며 전체 잔액과 혼동하지 않는다. |
| Day 첫 완료 | `firstClearDay` | 해당 Day를 최초로 모두 완료했는지 나타내는 서버 플래그 | 보상 금액이 아니라 완료 상태다. |
| 스탬프 수령 포인트 | `gainspoint` | 학습현황표 조건 충족 후 실제 수령한 포인트 | 수령 API 성공 응답 후에만 반영한다. |

Unity 로그인 상태는 `spoint`, `lpoint`, `llevel`로 초기화된다. [PlayerInfo.cs](D:/Codex/MetaOn/Assets/Uniplayer/Container/Scripts/Managers/PlayerInfo.cs:62)

## 3. 포인트 발생원 전체 목록

| 발생원 | Unity 요청/상태 | 지급 시점 | 서버가 보장해야 할 것 | 웹앱 상태 |
|---|---|---|---|---|
| 일반 Activity 완료 | `/study/start` -> `/study/end` | Activity 종료 후 | `log_idx/startIdx` 1회 종료, 현재 잔액·레벨·Day 첫 완료 여부 | 시작/종료 프록시와 완료 연출은 있음. 전역 잔액 갱신은 없음. |
| Quick Check | `/study/newquizaccept` 또는 `/study/quizaccept` | 모든 문항 제출 후 | 서버 재채점, 문항별 신규/기획득 상태, 신규 포인트, 현재 잔액 | 구현됨. 두 계약 fallback 지원. |
| Instant Quiz | `/study/setinstantquizpoint` | 정답 문항마다 | 정답·중복 여부에 따른 즉시 지급과 현재 잔액 | 미구현 |
| Book 누적 포인트 | `/study/nowbookpoint` | 조회 | Book 단위 누적값 | 미구현 |
| Day/학습현황 스탬프 | `/study/checktotstamppoint`, `/study/gettotstamppoint` | 조건 확인 후 사용자가 수령 | 수령 가능 금액, 수령 완료 상태, 중복 수령 방지 | 미구현 |
| 패키지 Book 완료 보너스 | `/user/getpkgbonus` | 패키지 조건 달성 후 수령 | 지급 가능 여부, 수령 완료 상태, 현재 잔액 | 미구현 |
| 출석 | `/user/attend` | 당일 출석 처리 | 당일 중복 방지, 출석 횟수, 지급 포인트, 현재 잔액 | 미구현 |
| MyPlanet 아바타 상점 | `/user/buyavatar`, `/user/sellavatar` | 구매 또는 판매 성공 시 | 차감/증가 사유, 거래 원자성, 현재 잔액 | 미구현 |
| MV 좋아요 등 | `/mv/getgainpoint` | 누적 보상 수령 시 | 수령 가능 포인트, 중복 수령 방지, 현재 잔액 | 미구현 |
| `learn_event` | `/learn/events` | 학습 중 append-only 기록 | 분석용 이벤트 저장 | 구현됨. 포인트 지급과 분리. |

Unity API 명세의 경로는 [NetDefines.cs](D:/Codex/MetaOn/Assets/Uniplayer/Container/Scripts/Managers/Network/NetDefines.cs:51)와 [NetworkManager_Request.cs](D:/Codex/MetaOn/Assets/Uniplayer/Container/Scripts/Managers/Network/NetworkManager_Request.cs:473)에서 확인했다.

## 4. Activity 완료 포인트 정책

### 4.1 Unity의 확정된 완료 흐름

1. Activity 진입 전 `LessonManager`가 현재 스타 포인트를 `beforePoint`로 보관한다.
2. `/study/start`를 호출하고 서버가 반환한 `startIdx`를 저장한다.
3. 완료 시 `/study/end`에 `userIdx`와 `startIdx`를 전송한다.
4. Unity는 응답의 `userSPoint`, `userLPoint`, `llevel`로 사용자 상태를 갱신한다.
5. `firstClearDay`와 시작 전후 스타 포인트 차이를 사용해 Day 완료와 Activity 완료 보상 연출을 표시한다.

이 흐름은 [LessonManager.cs](D:/Codex/MetaOn/Assets/Uniplayer/Container/Scripts/Managers/LessonManager.cs:37)와 [LessonManager.cs](D:/Codex/MetaOn/Assets/Uniplayer/Container/Scripts/Managers/LessonManager.cs:101)에 구현되어 있다.

```text
Activity 진입
  -> /study/start
  -> startIdx 보관
  -> 학습 완료
  -> /study/end(startIdx)
  -> userSPoint / userLPoint / llevel / firstClearDay 수신
  -> 사용자 잔액 갱신 및 완료 보상 표시
```

### 4.2 첫 Day 완료의 `+5` 표시

Unity 완료 UI는 `firstClearDay == 1`일 때 Day 완료 팝업에서 `+5`를 먼저 연출하고, 이후 `현재 포인트 - (시작 포인트 + 5)`를 Activity 완료 보상처럼 분리 표시한다. [ActivityUI.cs](D:/Codex/MetaOn/Assets/Uniplayer/Container/Scripts/Panels/Activity/ActivityUI.cs:267)

이 `+5`는 Unity 화면 코드에 존재하는 **표현 분리값**이다. 이 코드만으로 MetaOn3 서버가 항상 Day 첫 완료 보너스 5점을 지급한다고 확정할 수는 없다. 웹앱은 서버가 `day_clear_bonus` 또는 동등한 명시 필드를 제공할 때만 Day 보상과 Activity 보상을 금액별로 분리해 보여 준다.

### 4.3 신규 Activity 코드 기준 적용

| 신규 Activity 코드 | 활동 | 포인트 경로 | 현재 원칙 |
|---|---|---|---|
| `EBOOK01` | Listen & Read | 일반 `/study/start` -> `/study/end` | 완료 보상은 종료 API 응답만 반영한다. |
| `WDCA01` | Word Card | 일반 종료 | 카드 뒤집기·듣기 자체는 포인트 지급 근거가 아니다. |
| `WDQU01` | Word Quiz | 일반 종료 | 정답 수는 `learn_event`와 피드백에 사용하며, 포인트는 서버가 결정한다. |
| `WDBL01` | Word Blank | 일반 종료 | 로컬 정답 판정만으로 포인트를 지급하지 않는다. |
| `WDPL01` | Matching Game | 일반 종료 | 게임 내 점수·타이머와 영속 포인트를 분리한다. |
| `WDPL02` | Memory Card | 일반 종료 | 라운드 성공·제한시간은 학습 결과이며, 포인트 금액은 서버 응답이 기준이다. |
| `STBL01` | Sentence Blank | 일반 종료 | 문장 정답 수는 분석용이며, 포인트 지급은 종료 API가 결정한다. |
| `STSC01` | Sentence Unscramble | 일반 종료 | 로컬 순서 판정은 지급 근거가 아니다. |
| `STRC01` | Sentence Record | 일반 종료 | 녹음·인식 결과는 학습 데이터이며, 포인트 지급은 별도 서버 정책이 필요하다. |
| `QCHK01` | Quick Check | Quick Check 제출 + 일반 종료 가능성 | 두 응답을 클라이언트가 임의 합산하면 안 된다. 서버가 각 보상 의미를 구분해야 한다. |
| `NPCQHK01`, `NPCQHK02` | NPC Quick Check | 현재 `quizaccept` 미호출, 일반 종료 가능성 | 렌더러의 신규 포인트는 0이다. 다만 `log_idx`가 있으면 ActivityPage가 `/study/end`를 호출하므로 종료 보상 여부는 서버 확인이 필요하다. |

### 4.4 웹앱의 현재 완료 처리와 한계

현재 [ActivityPage.tsx](D:/Codex/MetaOn/webapp/src/pages/ActivityPage.tsx:78)는 Activity 진입 시 `act_idx`로 `/api/study/start`를 호출해 `log_idx`를 저장한다. 완료 시 다음을 수행한다.

1. 브라우저 내 중복 클릭을 `completionLockRef`로 막는다.
2. `log_idx`가 있을 때만 `/api/study/end`를 호출한다.
3. 응답에 `new_point`, `add_point`, `reward_point`, `point` 등의 양수 필드가 있으면 보상 연출에 표시한다.
4. 로컬 `HubProgress`에 완료 Activity를 저장하고 완료 알림을 만든다.

현재 한계는 다음과 같다.

- Activity 완료 표시의 최초 여부는 서버 완료 이력이 아니라 브라우저 프로필별 로컬 `HubProgress`다. 브라우저 데이터 삭제·다른 기기·오프라인 상황과 서버 상태가 달라질 수 있다.
- `/study/end` 실패 후에도 로컬 완료 상태가 저장될 수 있다. 서버 지급 실패를 "완료 보상 확정"으로 보여 주면 안 된다.
- 일반 Activity 종료 응답의 전체 잔액·레벨 포인트·레벨은 전역 상태에 반영되지 않는다.
- Activity 상단의 별 포인트는 현재 `0` 고정 표현이다. [ActivityTopBar.tsx](D:/Codex/MetaOn/webapp/src/components/ActivityTopBar.tsx:71)
- 현재 보상 오버레이는 로컬 최초 완료일 때만 포인트 숫자를 보여 준다. 이는 UX 조건일 뿐 서버의 중복 지급 정책을 대체하지 않는다.

## 5. Quick Check 포인트 정책

### 5.1 채점과 포인트 지급의 분리

웹 Quick Check의 공통 채점 함수는 결과 화면과 제출 로그를 일관되게 만들기 위한 것이다. 포인트 지급은 여전히 서버가 수행한다.

| 문제 유형 | 웹 공통 채점 규칙 | 포인트 결정 |
|---|---|---|
| Type 5 Sentence | `RightWriteAnswer`와 사용자 입력이 완전 일치 | 서버 재채점 후 지급 |
| Type 6, 7, 9, 11 복합형 | 맞은 하위 항목 수가 전체의 절반보다 **엄격히 많음** | 서버 재채점 후 지급 |
| Type 1, 2, 3, 4, 8, 10 | `RightAnswer`와 선택 번호 일치 | 서버 재채점 후 지급 |

클라이언트가 전송한 `correct`나 `newPoints`를 서버가 그대로 신뢰하면 안 된다. 서버는 `q_idx`, 답안, 시도 식별자를 기준으로 다시 채점하고 기존 획득 여부를 판정해야 한다.

### 5.2 요청과 응답

웹 BFF는 현재 MetaOn3 계약과 Unity 레거시 계약을 fallback으로 지원한다.

| 구분 | 우선/대체 API | 주요 필드 |
|---|---|---|
| 문제 조회 | `/study/getquickcheckquiz` 또는 `/study/getnewquickcheckquiz` | `quizzes`/`qlist`, `q_idx`, `qjson`, `quizCode` |
| 답안 제출 | `/study/quizaccept` 또는 `/study/newquizaccept` | `attempt_id` 또는 `qidxlog`, `quizlog`, `useranswer`, `timelog` |
| 신규 포인트 | `new_point_cnt`, 문항별 `qPointlist[].point` | 이번 제출로 서버가 지급한 포인트 |
| 현재 잔액 | `spoint`, `userPoint` | 제출 후 사용자 스타 포인트 |
| 레벨 상태 | `lpoint`, `userLPoint`, `llevel` | 제출 후 레벨 포인트와 레벨 |

[quickCheckAdapter.mjs](D:/Codex/MetaOn/webapp/server/quickCheckAdapter.mjs:120)는 결과를 `newPoints`, `currentPoints`, `lessonPoints`, `level`, 문항별 `pointState`로 정규화한다. 재제출은 BFF의 attempt 캐시가 같은 응답을 반환하도록 처리한다. [server/index.mjs](D:/Codex/MetaOn/webapp/server/index.mjs:526)

`existingPoints = currentPoints - newPoints`는 서버가 명시적 기존 포인트 필드를 주지 않을 때의 **표시용 추정값**이다. 서버가 실제 누적 포인트·기획득 포인트·이번 지급 포인트를 별도 필드로 제공하면 그 필드를 우선한다.

## 6. 웹 공통 포인트 응답 모델

각 보상 API는 원본 필드명이 달라도 BFF에서 아래 공통 모델로 정규화하는 것을 목표로 한다.

```ts
type PointSummary = {
  totalPoints: number;       // 현재 스타 포인트 잔액
  levelPoints: number;       // 현재 레벨 포인트
  level: number;             // 현재 레벨
  deltaPoints?: number;      // 이번 서버 요청으로 확정된 증감
  deltaLevelPoints?: number; // 이번 서버 요청으로 확정된 레벨 포인트 증감
  source:
    | "activity-end"
    | "quick-check"
    | "instant-quiz"
    | "stamp"
    | "book-bonus"
    | "attendance"
    | "store"
    | "mv";
  firstClearDay?: boolean;
  serverAwarded: boolean;
  transactionId?: string;
};
```

정규화 규칙은 다음과 같다.

1. 잔액은 `userSPoint -> spoint -> userPoint -> uspoint` 순서로 읽되, API별 명시 계약을 우선한다.
2. 레벨 포인트는 `userLPoint -> lpoint`, 레벨은 `llevel`로 읽는다.
3. 서버가 `deltaPoints`를 명시하지 않은 경우에만 요청 전후 잔액 차이를 UI 표시용으로 계산한다.
4. `serverAwarded`는 서버 성공과 보상 필드의 의미가 확인됐을 때만 `true`로 둔다.
5. `transactionId`, `log_idx`, `attempt_id` 중 가능한 식별자를 기록해 재시도와 감사 로그에 사용한다.

## 7. 사용자 상태와 화면 반영 정책

1. 로그인 또는 프로필 선택 시 서버가 준 `spoint`, `lpoint`, `llevel`을 초기 `PointStore`에 넣는다.
2. 포인트 관련 서버 응답마다 `PointStore`를 원자적으로 갱신한다. 임시 로컬 완료 상태와 별개로 다룬다.
3. 홈, 프로필, Activity 상단은 동일한 `PointStore`의 잔액만 표시한다.
4. 일반 Activity 완료 팝업은 서버가 확정한 `deltaPoints`와 현재 잔액을 표시한다. 포인트 정보가 없으면 "학습 완료"만 표시한다.
5. Quick Check 결과는 "정답 수", "이번 신규 포인트", "기존 획득 상태", "현재 잔액"을 분리해 보여 준다.
6. 포인트 차감 거래는 `-N`, 거래 사유, 실패 시 잔액 미변경을 명확히 표시한다.
7. `learn_event`에 포인트가 기록되더라도 화면 잔액은 반드시 포인트 API 응답으로만 변경한다.

현재 웹에는 프로필 응답의 `spoint`, `lpoint`, `llevel` 타입은 있으나, 위 `PointStore`와 종료 응답의 공통 정규화는 아직 구현되지 않았다. 로컬 진행 상태는 [useHubState.tsx](D:/Codex/MetaOn/webapp/src/hooks/useHubState.tsx:159)에 프로필별로 저장되며, 서버 포인트 원장이 아니다.

## 8. 서버 계약 필수 확인 사항

| 우선순위 | 확인 대상 | 서버가 제공해야 할 최소 보장 |
|---|---|---|
| P0 | `/study/end` | 성공 여부, `userSPoint`, `userLPoint`, `llevel`, `firstClearDay`, 명시적 지급량 또는 거래 ID, 중복 종료 멱등성 |
| P0 | `/study/quizaccept`, `/study/newquizaccept` | 서버 재채점, 신규/기획득 문항 상태, 신규 포인트, 현재 잔액, 재제출 멱등성 |
| P0 | Quick Check와 `/study/end`의 관계 | 두 요청이 각각 포인트를 지급하는지, 지급 사유가 중복되는지, 화면에 어떻게 분리할지 |
| P1 | 스탬프·출석·패키지 보너스 | 지급 가능 여부, 실제 지급 금액, 수령 완료 상태, 중복 수령 방지 |
| P1 | Instant Quiz | 문항별 지급 조건, 중복 정답 처리, 결과 제출과의 관계 |
| P2 | MyPlanet/MV | 거래 사유, 차감/지급 금액, 거래 ID, 현재 잔액 |

## 9. 구현 우선순위

1. BFF에 `PointSummary` 정규화기를 추가하고 `/study/end`, Quick Check 제출 응답에 적용한다.
2. 프로필 선택 응답과 `PointSummary`를 연결하는 전역 `PointStore`를 구현한다.
3. 일반 Activity 완료에서 서버 종료 성공 후에만 포인트 보상 및 완료 확정 UI를 표시한다. 네트워크 실패는 재시도 상태로 남긴다.
4. Quick Check의 문항 보상과 Activity 종료 보상을 서버 정책에 따라 분리 표시하고 임의 합산하지 않는다.
5. Book 누적, 스탬프, 출석, 패키지 보너스 API를 BFF에 추가한다.
6. MyPlanet 경제 기능은 학습 보상과 분리된 거래 내역 및 차감 UI로 구현한다.

## 10. 참고 소스

- Unity 로그인 포인트 초기화: [PlayerInfo.cs](D:/Codex/MetaOn/Assets/Uniplayer/Container/Scripts/Managers/PlayerInfo.cs:62)
- Unity 일반 Activity 시작·종료: [LessonManager.cs](D:/Codex/MetaOn/Assets/Uniplayer/Container/Scripts/Managers/LessonManager.cs:37)
- Unity Day 첫 완료 및 Activity 보상 연출: [ActivityUI.cs](D:/Codex/MetaOn/Assets/Uniplayer/Container/Scripts/Panels/Activity/ActivityUI.cs:267)
- Unity 포인트 상태 갱신: [AccountManager.cs](D:/Codex/MetaOn/Assets/Uniplayer/Container/Scripts/Managers/AccountManager.cs:113)
- Unity 포인트 API 정의: [NetDefines.cs](D:/Codex/MetaOn/Assets/Uniplayer/Container/Scripts/Managers/Network/NetDefines.cs:51)
- 웹 일반 Activity 완료 처리: [ActivityPage.tsx](D:/Codex/MetaOn/webapp/src/pages/ActivityPage.tsx:150)
- 웹 Quick Check 응답 정규화: [quickCheckAdapter.mjs](D:/Codex/MetaOn/webapp/server/quickCheckAdapter.mjs:120)
- 웹 Quick Check 제출 fallback 및 중복 방지: [server/index.mjs](D:/Codex/MetaOn/webapp/server/index.mjs:526)
- NPC Quick Check의 현재 무제출 처리: [NpcQuickCheckActivity.tsx](D:/Codex/MetaOn/webapp/src/features/npcQuickCheck/NpcQuickCheckActivity.tsx:255)
