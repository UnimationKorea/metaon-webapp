# MetaOn NPC Quick Check Activity 구현 현황 (2026-07-13)

## 1. 구현 목적

- 기존 Quick Check `QCHK01`은 유지한다.
- 신규 Activity code `QCNP01`을 Unity Activity 65 데이터와 동일한 문항 원천으로 실행한다.
- 화면은 `D:\Codex\metaonlivechat`의 `ActivityViewer` 전용 모드에서 NPC 채팅 형태로 표시한다.
- 문항 정답은 iframe에 전달하지 않고 MetaOn Parent가 기존 공통 Quick Check 채점 함수로 판정한다.
- 기존 `/study/getquickcheckquiz` 및 Unity 호환 fallback, `/study/quizaccept` 제출 흐름은 그대로 재사용한다.

## 2. 실행 구조

1. MetaOn Activity route가 `QCNP01`을 인식하고 `NpcQuickCheckActivity`를 선택한다.
2. 기존 `study/start` 완료 후 받은 `log_idx`로 Quick Check 문항을 조회한다.
3. MetaOn BFF의 `POST /api/activities/npc-quick-check/launch`가 30분 유효 HMAC launch token을 생성한다.
4. ActivityViewer를 `?mode=npc-quick-check` iframe으로 열며 launch token은 URL에 넣지 않는다.
5. Viewer는 exact-origin RPC `activity.bootstrap`으로 정답이 제거된 문항과 Learning Zone 조회용 단기 token을 받는다.
6. 사용자가 답을 제출하면 Parent가 기존 공통 채점 함수로 채점하고 O/X만 반환한다.
7. 전 문항 완료 후 Parent가 기존 Quick Check API로 한 번만 제출하고 Activity 완료 및 LearnEvent를 저장한다.
8. Viewer 백엔드는 launch token의 `userId`와 `bookIdx` 범위 안에서 Learning Zone API를 보조 컨텍스트로 조회한다.

시나리오 원천 API가 설정된 경우 BFF가 `book_idx + day_idx + act_idx`로 시나리오를 조회한다. 유효한 시나리오는 `dialogue -> question -> correct/incorrect branch -> ending` 상태 머신으로 실행하고, 미설정·404·검증 실패는 기존 선형 Quick Check로 fallback한다. 상세 계약은 `npc_quick_check_scenario_api.md`를 따른다.

Learning Zone API가 미설정, timeout 또는 오류여도 Quick Check 문항 진행은 중단하지 않는다.

## 3. Activity 및 문항 계약

| 구분 | 값 |
|---|---|
| 기존 Quick Check | `QCHK01` |
| 신규 NPC Quick Check | `QCNP01` |
| 공통 ActType | `65` |
| Viewer protocol | `1.0` |
| 문항 종류 | `single-select`, `sentence-input`, `multi-select`, `connect-line`, `drag-alphabet`, `drag-image`, `drag-sentence` |
| 내부 선택지 index | `0-based` |

`QCNP01`을 실제 Book에서 보이게 하려면 CMS 또는 `getBookInfo` 응답의 해당 Activity에 `activity_code: "QCNP01"`이 등록되어야 한다. 등록 전에는 기존 `QCHK01` 렌더러가 계속 사용된다.

## 4. Parent/Viewer RPC

| Method | 방향 | 역할 |
|---|---|---|
| `activity.bootstrap` | Viewer -> Parent | 세션 정보와 정답 제거 문항 조회 |
| `activity.questionViewed` | Viewer -> Parent | 문항 노출 시간 시작 및 이벤트 기록 |
| `activity.requestHint` | Viewer -> Parent | 정답을 노출하지 않는 일반 힌트 조회 |
| `activity.submitAnswer` | Viewer -> Parent | 답안 정규화, 공통 채점, O/X 반환 |
| `activity.complete` | Viewer -> Parent | 전 문항 완료 검사, 중복 방지, 서버 제출 |
| `activity.exit` | Viewer -> Parent | 현재 Book 화면으로 복귀 |

`postMessage`는 iframe `contentWindow`와 정확한 Parent/Viewer origin을 함께 검증한다. 단기 launch token은 iframe URL에 넣지 않아 호스팅 접근 로그와 브라우저 기록 노출을 피한다. MetaOn 로그인 cookie, upstream session-id, 정답 데이터는 Viewer에 전달하지 않는다.

## 5. Learning Zone 현실 응답 반영

첨부 문서 `LEARNING_ZONE_API_현실응답_v1.md`를 다음 기준으로 반영했다.

- 서버 간 `GET /npc/learning-data?user_id=...&book_idx=...` 호출
- 인증은 Viewer 백엔드의 `X-Api-Key`만 사용
- 응답은 `book`, `to_learn.words`, `to_learn.sentences`, `learned`, `progress`만 정규화
- 제공되지 않는 `grammar`, `book.unit`, `read_to` 등은 생성하지 않음
- API 응답은 `Cache-Control: no-store`
- 응답의 `user_id`, `book.book_idx`가 launch token 범위와 다르면 거부

Learning Zone API의 확정 전 항목인 Activity 단위 범위, label/level, lesson/day 필터, 결과 POST는 현재 구현에 임의로 추가하지 않았다.

## 6. LearnEvent 기록 원칙

- `quick_check` 이벤트: `item_idx = q_idx`
- 단어 mastery 이벤트: API/qjson에 명시된 `word_idx`만 `item_idx`로 기록
- 문장 mastery 이벤트: API/qjson에 명시된 `sentence_idx`만 `item_idx`로 기록
- 텍스트 일치로 word/sentence PK를 추정하지 않음
- 복합 문항은 명시된 `subItemIndex`가 있을 때 해당 하위 정답 결과를 기록
- 중복 방지 키 `client_event_id`와 `source: npc_quick_check`는 서버 스키마 확정 전까지 `extra` JSON에 저장

주요 action은 `npc_intro`, `question_view`, `hint_request`, `answer_submit`, `answer_result`, `activity_submit`, `activity_complete`다.

## 7. 실패 및 fallback

- 문항 목록이 비어 있거나 Quick Check API가 실패하면 오류 상태를 표시한다.
- Viewer launch 설정 또는 iframe 연결이 실패하면 `기본 Quick Check로 계속` 버튼으로 기존 `QCHK01` 화면을 사용할 수 있다.
- Learning Zone API 장애는 NPC 도입 문구/진도 정보만 생략하고 문항 진행은 유지한다.
- 문항별 제출과 전체 제출은 각각 lock을 두어 중복 요청을 방지한다.

## 8. 환경 변수

### MetaOn BFF

```env
METAON_NPC_QUICK_CHECK_URL=https://<activity-viewer-host>/?mode=npc-quick-check
METAON_NPC_LAUNCH_SECRET=<secret-manager-value>
METAON_PUBLIC_ORIGIN=https://<metaon-webapp-host>
METAON_NPC_SCENARIO_API_URL=https://<scenario-api-host>/npc/quick-check/scenario
METAON_NPC_SCENARIO_API_KEY=<server-only-api-key>
METAON_NPC_SCENARIO_TIMEOUT_MS=5000
```

### ActivityViewer frontend/backend

```env
VITE_API_URL=https://<activity-viewer-api-host>
METAON_NPC_LAUNCH_SECRET=<same-secret-as-metaon-bff>
LEARNING_ZONE_API_ORIGIN=https://metaon3-0-609870547235.asia-northeast3.run.app
LEARNING_ZONE_API_PATH=/npc/learning-data
LEARNING_ZONE_API_KEY=<server-only-api-key>
LEARNING_ZONE_API_TIMEOUT_SECONDS=5
```

`METAON_NPC_LAUNCH_SECRET`은 두 서비스에서 동일해야 하며 Secret Manager로 주입한다. `LEARNING_ZONE_API_KEY`는 frontend 번들 또는 iframe URL에 넣지 않는다.

## 9. 주요 변경 파일

### `D:\Codex\MetaOn\webapp`

- `src/features/npcQuickCheck/NpcQuickCheckActivity.tsx`
- `src/features/npcQuickCheck/npcQuickCheckProtocol.ts`
- `src/api/npcQuickCheck.ts`
- `src/services/activityCodes.ts`
- `src/services/activityRegistry.tsx`
- `src/pages/ActivityPage.tsx`
- `src/features/quickCheck/quickCheckAdapter.ts`
- `server/npcQuickCheckLaunch.mjs`
- `server/npcQuickCheckScenarioSource.mjs`
- `shared/npcQuickCheckScenario.mjs`
- `server/index.mjs`

### `D:\Codex\metaonlivechat`

- `src/components/npcQuickCheck/NpcQuickCheckViewer.jsx`
- `src/components/npcQuickCheck/NpcQuickCheckViewer.css`
- `src/components/npcQuickCheck/scenarioRuntime.js`
- `src/services/rpc/npc-quick-check-rpc.js`
- `src/services/rpc/rpc-client.js`
- `src/services/rpc/rpc-server.js`
- `backend/launch_token.py`
- `backend/learning_zone.py`
- `backend/main.py`

## 10. 검증 결과

| 대상 | 명령/검증 | 결과 |
|---|---|---|
| MetaOn | `npm test -- --run` | 26 files, 122 tests 통과 |
| MetaOn | `npm run build` | 통과 |
| ActivityViewer | `npm test` | 5 tests 통과 |
| ActivityViewer backend | `python -m unittest discover -s backend -p "test_*.py"` | 3 tests 통과 |
| ActivityViewer | `npm run build` | 통과 |
| ActivityViewer | `npm run lint` | 오류 없음, 기존 빈 ESLint 설정 경고만 존재 |
| Browser QA | 시나리오 7개 문항 end-to-end | 정답/오답 분기, ending, `6/7` 결과 확인 |
| Browser QA | 시나리오 fallback | `scenario=0`에서 기존 선형 Quick Check 확인 |
| Responsive QA | 1280x720, 1024x768, 430x760 | 가로 overflow 및 console error 없음 |

로컬 독립 Viewer 샘플은 `http://127.0.0.1:5174/?mode=npc-quick-check`에서 확인할 수 있다.

## 11. 배포 전 확인 사항

1. CMS/Book data에 `QCNP01` Activity를 등록한다.
2. MetaOn BFF와 ActivityViewer backend에 동일한 launch secret을 설정한다.
3. ActivityViewer backend의 Learning Zone IP allowlist와 API key를 설정한다.
4. 실제 `/npc/learning-data` query 계약이 `user_id + book_idx`인지 백엔드 담당자와 최종 확정한다.
5. `learn_event`의 `source`, `client_event_id` 정식 column 추가 여부를 확정한다.
6. Cloud Run 다중 인스턴스 환경에서 기존 Quick Check attempt 저장소가 메모리 기반이면 Redis/DB 공유 저장소로 이전한다.
7. `D:\Codex\metaonlivechat`에 기존부터 추적 중인 `.env`, backend credential 및 service-account 파일이 있으므로 공개 배포 전에 Git 추적 제거와 키 회전을 수행한다.
8. 시나리오 생성 서버는 `npc_quick_check_scenario_api.md` 계약에 맞춰 게시 version과 content hash를 제공한다.
