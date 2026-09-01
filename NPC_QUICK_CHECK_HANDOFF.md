# NPC Quick Check 인수인계 문서

> 작성일: 2026-08-26 KST  
> 적용 범위: `D:\Codex\MetaOn\webapp`  
> 대상 코드: `NPCQHK01`, `NPCQHK02`

## 1. 코드명 확인

현재 Webapp에서 실제로 인식하고 실행하는 Activity 코드는 아래와 같다.

| 구분 | 현재 지원 코드 | ActType | 설명 |
|---|---|---:|---|
| 리소스 기반 NPC Quick Check | `NPCQHK01` | `65` | Book에 포함된 고정 시나리오와 음성으로 진행 |
| 개인화 NPC Quick Check | `NPCQHK02` | `65` | 학습자의 과거 오답을 기준으로 `weak` 또는 `relearn` 시나리오를 선택 |
| 일반 Quick Check | `QCHK01` | `65` | iframe NPC 화면이 아닌 기존 Quick Check 화면 |

요청에서 언급된 `NPCQCK01`, `NPCQCK02`는 현재 코드/서버 매핑에 없다. CMS 또는 API가 이 코드로 내려오면 NPC renderer가 선택되지 않는다. 신규 표준을 `NPCQCK`로 변경하려는 의도라면, `activityCodes.ts`, `activityRegistry.tsx`, `server/index.mjs`, Book 리소스 판정, 테스트를 함께 변경해야 한다. 현 인수인계 기준의 표준 코드는 **`NPCQHK01`, `NPCQHK02`**다.

`QCNP01`은 이전 기획/시나리오 API 문서에 남은 legacy 표기다. 현재 실행 등록에는 사용되지 않는다. `implementation_0713.md`, `npc_quick_check_sample_v2_handoff.md`, `npc_quick_check_scenario_api.md`를 신규 실행 계약으로 그대로 사용하면 안 된다.

## 2. 공통 아키텍처와 책임 분리

```text
Book getBookInfo
  -> BFF manifest에 npcqhk 또는 npcqhk2 리소스 추가
  -> 브라우저가 S3에서 script.json/음성을 다운로드
  -> IndexedDB(metaon-web-cache)에 Book package로 저장
  -> NpcQuickCheckActivity가 캐시에서 bundle 생성
  -> BFF가 짧은 수명의 launch token 발급
  -> 외부 NPC Viewer iframe이 RPC로 화면/입력을 요청
  -> Parent Webapp이 채점, 분기, LearnEvent, 종료를 처리
```

### Parent Webapp 책임

- 캐시된 시나리오와 음성을 읽고 Viewer에 전달한다.
- 정답은 Parent만 보유하고 Viewer에는 `correctAnswer`를 제거한 문제만 전달한다.
- Viewer 답안을 정규화하고 `shared/quickCheckScoring.mjs`로 채점한다.
- 정답/오답에 따른 다음 노드를 검증한다. Viewer가 임의 노드로 이동할 수 없다.
- LearnEvent, Activity 완료, Book 화면 복귀를 처리한다.

### Viewer 책임

- NPC 대화, 음성 재생, 말풍선, 선택지, 피드백 화면을 표시한다.
- Parent에게 RPC 요청을 보내고 반환된 결과만 표시한다.
- 정답, BFF cookie, MetaOn3 session, launch secret을 보유하거나 추론하지 않는다.

Viewer는 이 Webapp 번들에 포함되지 않는다. 별도 Viewer 전달본 `D:\Codex\MetaOn\handoff\metaon-npc-viewer-source-20260826.bundle`을 함께 전달하고, 번들 안의 `VIEWER_HANDOFF.md`를 기준으로 `METAON_NPC_QUICK_CHECK_URL`과 배포 환경을 구성한다.

## 3. Renderer 선택

`src/services/activityRegistry.tsx`에서 문자열 `activity_code`가 숫자 ActType보다 우선한다.

```text
NPCQHK01 또는 NPCQHK02
  -> NpcQuickCheckActivity
QCHK01 또는 코드 없음 + ActType 65
  -> QuickCheckActivity
```

두 NPC 코드는 하나의 `NpcQuickCheckActivity`를 공유한다. 그 안에서 코드가 `NPCQHK02`인지 판별해 서로 다른 resource adapter를 선택한다.

주요 파일:

| 경로 | 역할 |
|---|---|
| `src/services/activityCodes.ts` | `NPCQHK01/02` 코드와 ActType 65 매핑 |
| `src/services/activityRegistry.tsx` | NPC 코드 우선 renderer 선택 |
| `src/features/npcQuickCheck/NpcQuickCheckActivity.tsx` | Parent host, iframe RPC, 채점/분기/완료 |
| `src/features/npcQuickCheck/npcQuickCheckResourceAdapter.ts` | `NPCQHK01` 캐시 리소스 해석 |
| `src/features/npcQuickCheck/npcQuickCheck2ResourceAdapter.ts` | `NPCQHK02` 개인화 선택/캐시 리소스 해석 |
| `src/features/npcQuickCheck/npcQuickCheckProtocol.ts` | RPC payload 검증 및 Viewer 전달 문제 정제 |
| `src/features/npcQuickCheck/npcQuickCheckScenarioRuntime.ts` | 시나리오 노드/분기 검증 |
| `shared/npcQuickCheckScenario.mjs` | 시나리오 그래프 검증 |

## 4. NPCQHK01 리소스 계약

### getBookInfo 수신 필드

BFF는 각 Day에서 아래 필드 중 하나를 인식한다.

```text
npcqhk
npc_qhk
npcQuickCheck
npc_quick_check
```

값은 `script_json`, `scriptJson`, `script`, `manifest`, `json`, `resource_path`, `resourcePath`, `path` 중 하나로 `script.json` 경로를 제공할 수 있다. Day 최상위 또는 `assets` 안의 `audio`, `audios`, `audio_paths`, `audioPaths`도 미리 manifest에 넣을 수 있다.

### IndexedDB 가상 경로

```text
Lessons/L{lesson}/D{day}/npcqhk/script.json
Lessons/L{lesson}/D{day}/npcqhk/audio/...
```

`bookPackageImporter.ts`는 내려받은 `script.json`을 해석해 script 안에서 참조한 추가 음성을 찾아 같은 Book cache에 저장한다. `NPCQHK01`의 기본 음성 형식은 MP3다.

### script.json 최소 구조

```json
{
  "version": 1,
  "voice": { "name": "Jade", "id": "jade" },
  "opening": { "text": "...", "audio": "audio/opening.mp3" },
  "questions": [
    {
      "id": "q1",
      "original_question": "What can fly?",
      "ko_hint": "하늘을 나는 것을 골라 보세요.",
      "audio": "audio/q1.mp3",
      "tts": "What can fly?",
      "choices": [
        { "t": "Bird", "ok": true },
        { "t": "Table", "ok": false }
      ],
      "fb_ok": { "text": "Great!", "audio": "audio/q1_ok.mp3" },
      "fb_no": { "text": "Try again next time.", "audio": "audio/q1_no.mp3" }
    }
  ],
  "closing": { "text": "Finished!", "audio": "audio/closing.mp3" }
}
```

- `questions`는 비어 있으면 안 된다.
- 각 문제는 선택지 2개 이상, `ok: true`인 정답 정확히 1개가 필요하다.
- 현재 구현은 단일 선택(`single-select`)만 지원한다.
- opening -> 각 문제 -> 정답/오답 피드백 -> closing의 선형 시나리오를 자동 생성한다.

## 5. NPCQHK02 개인화 리소스 계약

### 리소스와 저장 경로

BFF는 Day에서 아래 필드 중 하나를 읽는다.

```text
npcqhk2
npc_qhk2
npc_qhk_2
npcQuickCheck2
npc_quick_check2
```

가상 경로는 아래와 같다.

```text
Lessons/L{lesson}/D{day}/npcqhk2/script.json
Lessons/L{lesson}/D{day}/npcqhk2/...
```

`script.json` 안의 상대 음성 경로를 importer가 찾아 S3에서 추가 다운로드한다. 기본 형식은 WebM/Opus이며 adapter가 `audio/webm` MIME으로 처리한다.

### 개인화 선택 규칙

1. Activity 입장 시 `POST /api/learn/wrong-items`에 `{ "book_idx": bookIdx }`를 보낸다.
2. BFF가 업스트림 `/learn/wrong-items`를 호출하고 `words[]`, `sentences[]`를 정규화한다.
3. `item_idx`가 오답 목록에 있으면 `weak`, 없으면 `relearn` variant를 선택한다.
4. 선택된 각 item은 한 번씩만 문제로 구성된다.
5. wrong-items API 오류 시 Activity 중단 대신 모든 item을 `relearn`으로 선택한다.
6. 시작 시 선택한 결과는 현재 attempt 동안 고정된다. 학습 중 새 이벤트가 들어와도 문제 세트는 바뀌지 않는다.

### script.json 최소 구조

```json
{
  "version": 1,
  "voice": { "name": "Jade", "id": "jade" },
  "opening": { "text": "...", "audio": "audio/opening.webm" },
  "items": [
    {
      "item_idx": 101,
      "type": "word",
      "ko": "새",
      "weak": {
        "question": "Choose the word.",
        "audio": "audio/weak-101.webm",
        "choices": [{ "t": "bird", "ok": true }, { "t": "book", "ok": false }],
        "fb_ok": { "text": "Great!", "audio": "audio/ok.webm" },
        "fb_no": { "text": "Review it again.", "audio": "audio/no.webm" }
      },
      "relearn": {
        "question": "Choose the word.",
        "audio": "audio/relearn-101.webm",
        "choices": [{ "t": "bird", "ok": true }, { "t": "book", "ok": false }],
        "fb_ok": { "text": "Great!", "audio": "audio/ok.webm" },
        "fb_no": { "text": "Review it again.", "audio": "audio/no.webm" }
      }
    }
  ],
  "closing": { "text": "Finished!", "audio": "audio/closing.webm" }
}
```

- `type`은 현재 `word` 또는 `sentence`다.
- `item_idx`는 `/learn/wrong-items`가 반환하는 item 식별자와 정확히 일치해야 한다.
- `weak`과 `relearn` 모두 선택지 2개 이상과 정답 1개를 가져야 한다.
- `contentRefs`가 word/sentence item에 연결되어 해당 item 단위의 숙련도 이벤트를 기록할 수 있다.

## 6. iframe launch와 RPC 계약

### BFF launch

```http
POST /api/activities/npc-quick-check/launch
Content-Type: application/json

{
  "bookIdx": 123,
  "dayIdx": 456,
  "actIdx": 789,
  "logIdx": 987,
  "attemptId": "npcqhk:...",
  "bookCode": "GPLB64"
}
```

- 로그인/프로필이 있어야 한다.
- BFF는 HMAC launch token을 발급한다. 기본 만료는 30분이다.
- 운영 환경에서 `METAON_NPC_QUICK_CHECK_URL`, `METAON_NPC_LAUNCH_SECRET`, `METAON_PUBLIC_ORIGIN`이 반드시 필요하다.
- launch token과 secret은 Viewer에 저장하거나 로그로 남기지 않는다.

### Viewer RPC 메서드

| RPC method | Parent 동작 |
|---|---|
| `activity.bootstrap` | 시나리오, 정답을 제거한 문제, 음성 ArrayBuffer, launch context 반환 |
| `activity.scenarioNodeViewed` | 노드 표시 이벤트 기록 |
| `activity.scenarioAdvance` | 허용된 다음 노드인지 검증 후 이동 |
| `activity.questionViewed` | 문항 시작 시각/이벤트 기록 |
| `activity.requestHint` | 시나리오 힌트 또는 공통 힌트 반환 |
| `activity.submitAnswer` | 답안 완성 확인, Parent 채점, 피드백/다음 노드 반환 |
| `activity.complete` | 전체 문항/ending 도달 확인 후 결과 반환 |
| `activity.exit` | Activity 종료/Book 화면 복귀 |

`message` 수신 시 Parent는 `event.source === iframe.contentWindow`와 `event.origin === viewerOrigin`을 모두 검사한다. Viewer 역시 `parent_origin`과 RPC response ID를 확인해야 한다.

## 7. 채점, 완료, 학습 이력

- Viewer는 정답 데이터를 받지 않는다.
- Parent는 `shared/quickCheckScoring.mjs`의 `scoreQuickCheckAnswer`, `scoreQuickCheckAttempt`로 채점한다.
- 동일 문제의 재제출은 첫 번째 결과를 재사용하여 중복 채점을 막는다.
- 모든 문항의 답변과 `ending` 노드 도달 뒤에만 `activity.complete`가 성공한다.
- 현재 NPC Activity는 `/study/quizaccept`를 호출하지 않는다. 결과의 `newPoints`, `currentPoints`, `existingPoints`, `lessonPoints`는 모두 0이다.
- `context.onComplete()`는 호출하므로 일반 Activity 종료/진도 흐름은 계속 탄다. 서버의 `/study/end` 보상 정책은 별도로 확인해야 한다.
- renderer에는 `npc_intro`, `scenario_start`, `dialogue_view`, `scenario_node_view`, `branch_taken`, `question_view`, `hint_request`, `answer_submit`, `answer_result`, `activity_submit`, `scenario_complete` 기록이 구현되어 있다.
- 다만 `learn_event_action_map.md`는 `QCHK01`, `NPCQHK01`, `NPCQHK02`를 공통 LearnEvent 전송 제외 대상으로 정의한다. renderer의 기록과 실제 전송 정책이 완전히 일치하는지 배포 전 반드시 재검증한다.

## 8. 외부 시나리오 API 관련 주의

`/api/activities/npc-quick-check/scenario` 및 `METAON_NPC_SCENARIO_API_URL`은 BFF에 존재하지만, 현재 `NpcQuickCheckActivity`의 실제 런타임은 이 API를 호출하지 않고 캐시된 `npcqhk`/`npcqhk2` `script.json`에서 시나리오를 만든다.

따라서 외부 시나리오 API를 운영 계약으로 전환하려면 다음이 별도 작업으로 필요하다.

1. `NpcQuickCheckActivity`가 resource script 대신 또는 우선하여 scenario API 결과를 읽도록 연결한다.
2. scenario의 `q_idx`와 현재 문제 집합을 1:1로 검증한다.
3. 404/API 오류 시 resource script 또는 일반 `QCHK01` fallback을 명확히 정한다.
4. `QCNP01` legacy 문서의 코드명과 현재 `NPCQHK01/02` 코드를 하나로 정리한다.

## 9. 테스트와 점검 순서

관련 테스트 파일:

```text
src/features/npcQuickCheck/npcQuickCheckResourceAdapter.test.ts
src/features/npcQuickCheck/npcQuickCheck2ResourceAdapter.test.ts
src/features/npcQuickCheck/npcQuickCheckProtocol.test.ts
src/features/npcQuickCheck/npcQuickCheckScenarioRuntime.test.ts
src/services/activityCodes.test.ts
src/services/activityRegistry.test.tsx
src/services/bookPackageImporter.test.ts
```

최소 점검 순서:

1. CMS/API가 정확히 `NPCQHK01` 또는 `NPCQHK02`를 반환하는지 확인한다.
2. Book 다운로드 후 IndexedDB에 `script.json`과 모든 참조 음성이 있는지 확인한다.
3. Cloud Run에서 Viewer URL과 launch secret을 설정한다.
4. iframe이 bootstrap -> 질문 -> 정답/오답 branch -> ending까지 RPC를 정상 처리하는지 확인한다.
5. `NPCQHK02`는 오답 item에서 `weak`, 나머지 item에서 `relearn`이 선택되는지 확인한다.
6. 정답 정보가 Viewer bootstrap payload나 브라우저 콘솔에 노출되지 않는지 확인한다.
7. `quizaccept` 미호출, 포인트 0, `/study/end` 동작을 실제 서버 응답으로 확인한다.

## 10. 인수인계 시 함께 전달할 파일

- 이 문서 `NPC_QUICK_CHECK_HANDOFF.md`
- `CODEX_HANDOFF.md`, `Project_context.md`
- Webapp 전용 번들 `D:\Codex\MetaOn\handoff\metaon-webapp-only-20260813.bundle`
- NPC Viewer 별도 전달본 `D:\Codex\MetaOn\handoff\metaon-npc-viewer-source-20260826.bundle` 및 그 안의 `VIEWER_HANDOFF.md`
- Cloud Run Secret의 **이름만**: `METAON_NPC_LAUNCH_SECRET` (값은 Secret Manager에서 별도 권한으로 관리)

전달하지 않을 항목: launch token, secret 값, 로그인 session, 사용자 학습 이력 원본, 브라우저 저장소, 운영 API key.
