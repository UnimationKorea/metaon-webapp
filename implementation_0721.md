# MetaOn Webapp 구현 현황 (2026-07-21)

## 0. 개요

이 문서는 `implementation_0713.md`(NPCQHK01 / QCNP01 NPC Quick Check) 이후 `webapp/`에 반영된
개발 내용을 정리한다. 크게 다섯 갈래다.

1. **NPCQHK02** — 개인화 NPC Quick Check(오답 기반 복습) 신규 Activity
2. **NPC Quick Check Viewer UI 개선** — NPCQHK01 / NPCQHK02 공용 화면 정리
3. **Activity 완료 별가루 연출** — 완료 시 포인트 연출 + 다음 Activity 자동 이동
4. **Activity 목록 재설계 — 징검다리 원정대** — 순차 진행을 공간적으로 표현하는 3D 시냇물 트레일
5. **홈(MyZone) · Study Zone(거인의 책장) 재설계** 및 다수 버그 수정

작업 폴더는 `D:\Codex2\MetaOn2026\webapp`(작업 클론)이며, 검증 후 `D:\Codex\MetaOn\webapp`(원본)에
동기화한다. 연동 Viewer는 `D:\Codex\metaonlivechat`다.

---

## 1. NPCQHK02 — 개인화 NPC Quick Check

### 1.1 목적

학습자가 **한 번이라도 틀린** word / sentence를 서버에서 받아, Book에 딸린 `npcqhk2` 리소스로
개인화된 NPC 대화형 퀴즈를 출제하고, 결과를 기존 LearnEvent 흐름으로 되돌려 오답 mastery를 갱신한다.
NPCQHK01의 Viewer · RPC · scenario · scoring · LearnEvent 인프라를 그대로 재사용하고, 데이터 소스와
변형 선택 로직만 새로 만들었다.

### 1.2 데이터 계약 (실제 샘플 기준 확정)

- **script.json 스키마**: 최상위 `opening{text,audio}` / `items[]` / `closing{text,audio}`.
  각 `item` = `{ item_idx, type:"word"|"sentence", en, ko, weak{...}, relearn{...} }`.
  각 변형(`weak`/`relearn`) = `{ kind, question, tts, audio, choices:[{label,t,ok}], fb_ok, fb_no }`.
  오디오는 전부 `audio/xxx.webm` **상대 경로**이며 **비디오가 아닌 오디오**다(`audio/webm`으로 강제).
- **wrong-items 범위**: `book_idx` 기준. 응답 `{ words:[{item_idx,text}], sentences:[{item_idx,text}] }`.
- **변형 출제 정책**: 전체 item을 모두 출제한다. 오답 item → `weak` 변형, 비오답 item → `relearn` 변형.
  (오답이 하나도 없으면 자연히 전체 `relearn`.)
- **결과 전송**: 각 문제에 `contentRefs:[{itemType, itemIdx}]`를 채워 `answer_result` 이벤트가
  word/sentence `item_idx` + 정오답과 함께 전송되도록 한다.

### 1.3 실행 구조

```
getBookInfo(day.npcqhk2) → BFF manifest에 npcqhk2/script.json 리소스 추가
  → importer: script.json 파싱 → audio/*.webm 해석·다운로드 → IndexedDB 캐시
Activity 입장 (activity_code = NPCQHK02)
  → npcQuickCheck2ResourceAdapter:
       1) IDB에서 npcqhk2/script.json + webm 로드
       2) POST /api/learn/wrong-items { book_idx } → 오답 item_idx 집합
       3) item마다 변형 선택(오답=weak, 비오답=relearn), contentRefs 부착
       4) NpcQuickCheckResourceBundle(=NPCQHK01과 동일 타입) 생성
  → 기존 NpcQuickCheckActivity host가 launch token 발급 → iframe Viewer RPC 구동
  → 문제별 채점(Parent) → answer_result LearnEvent
  → 완료 시 flush → POST /api/learn/events → upstream /learn/events
```

세션은 입장 시 wrong-items 스냅샷으로 문제 집합을 **1회 고정**(immutable)한다.

### 1.4 Activity code 등록

| 구분 | 값 |
|---|---|
| 기존 Quick Check | `QCHK01` |
| 리소스 NPC Quick Check | `NPCQHK01` |
| Legacy NPC Quick Check | `QCNP01` |
| **개인화 NPC Quick Check (신규)** | **`NPCQHK02`** |
| 공용 ActType | `QuickCheck (65)` |

`NPCQHK01` / `QCNP01` / `NPCQHK02`는 모두 `npcQuickCheckRenderer`를 공유한다.

---

## 2. NPC Quick Check Viewer UI 개선

NPCQHK01 / NPCQHK02 공용 화면을 태블릿 기준으로 정리했다(연동 Viewer `metaonlivechat`).

1. 우측 상단 문제 갯수 칩이 오버레이 메뉴에 가리므로 **왼쪽으로 70px 이동**.
2. NPC가 공중에 떠 보이던 문제 → **바닥 고정**.
3. **Hint 버튼 제거**(불필요).
4. 시작화면 / 결과화면 버튼을 문제 공간의 **정중앙에 배치**(태블릿 해상도 기준).

---

## 3. Activity 완료 별가루 연출 + 자동 이동

`ActivityCompletionCelebration` 컴포넌트를 도입해, Activity 완료 시 전체 화면 "별가루" 연출을
보여주고 다음 Activity로 자동 이동한다.

- **적용 범위**: NPC 포함 모든 Activity.
- **포인트 정책 유지**: 포인트는 기존 서버 흐름대로 **최초 학습 시에만** 적립된다(`point_policy.md`).
  별가루 연출은 완료 시 **항상** 표시하되, 포인트 값(`+N`)은 최초 학습이고 양수일 때만 노출한다.
- **자동 이동**: 연출 종료 후 다음 Activity로 이동, 마지막 Activity면 Book 화면으로 복귀.
- 중복 완료 방지 lock(`completionLockRef`)으로 재적립·중복 이벤트를 막는다.

---

## 4. Activity 목록 재설계 — 징검다리 원정대

Activity 목록을 순차 진행이 공간적으로 읽히는 **시냇물 위 징검다리 트레일**(3D)로 교체했다.
`HubBookPage.tsx` + `styles-hub.css`. 순수 transform/opacity 애니메이션이라 태블릿 WebView에서 가볍다.

### 4.1 상태 표현 — 돌의 높이

| 상태 | 돌 높이(`--lift`) | 색 / 표시 |
|---|---|---|
| 완료 | +12px | 모래색 돌 + 별 깃발 |
| 지금 학습 | **+32px (최고)** | 밝은 노란 돌 + 내 토큰 + 은은한 글로우 펄스 |
| 잠김 | +2px (가라앉음) | 회색 점선 돌 + 자물쇠, 클릭 불가 |

잠긴 돌을 누르면 도리도리 흔들림, 진행 가능한 돌을 누르면 460ms 발사 연출 후 이동한다.
리소스가 준비되지 않은 NPC Activity는 `isActivityResourceReady()`로 목록에서 숨겨 오류를 막는다.

### 4.2 반응형 — S자 줄바꿈 + U자 회전

화면 폭을 `ResizeObserver`로 측정해 한 줄에 들어갈 돌 개수를 계산하고, 넘치면 다음 줄로 접는다.

- **직렬 스크롤 제거**: 가로 스크롤 없이 아래 줄로 흐른다. 씬 높이는 줄 수에 따라 자란다(`--trail-h`).
- **S자 진행**: 홀수 줄은 오른쪽→왼쪽으로 흘러 진행 방향이 화면을 가로질러 되돌아오지 않는다.
- **U자 회전**: 명패가 모든 돌 바로 위에 있어 수직 연결선은 명패에 가린다. 그래서 줄바꿈 지점을
  바깥으로 도는 **U자 아크**(회전 레인 90px)로 처리한다. 연결선의 시작·끝점은 각 돌의 수면 접촉
  고리 바깥 끝에 맞춰, 돌 한가운데가 아니라 고리에서 빠져나가 다음 고리로 들어가는 형태다.
- **가로형 강제 줄바꿈**: 앱 기본이 가로 화면이라 넓은 태블릿에서도 한 줄이 되지 않도록
  `TRAIL_MAX_COLUMNS = 5` 상한을 두고, 줄을 고르게 분배한다(9개 → 5+4, 12개 → 4+4+4).

주요 상수: `TRAIL_SLOT_W 152`, `TRAIL_ROW_H 244`, `TRAIL_TURN_BULGE 90`, `TRAIL_MAX_COLUMNS 5`,
`TRAIL_RING_RX 68`, `TRAIL_RING_DY 26`.

### 4.3 배경 — 흐르는 시냇물

징검다리 개념에 맞춰 잔디 배경을 **시냇물**로 교체했다. 원근 투영된 수면 평면 + 먼 강둑,
각 돌 하단에 수면 접촉 고리(슬롯 간격보다 좁혀 이웃 고리와 겹치지 않게). 현재 학습 돌은 물에
묻히지 않도록 따뜻한 노란색 + 노란 글로우로 대비를 준다.

> 참고: 초기에 물결 애니메이션(드리프트 2겹 + 리플)을 넣었으나 "부자연스럽고 어수선하다"는
> 피드백으로 **전부 제거**했다. 현재는 잔잔한 수면 + 정적 접촉 고리만 남아 있다.

### 4.4 검증 방식

개발 카탈로그에 Activity가 1개뿐이라 트레일 전체 형상을 실제 데이터로 볼 수 없어,
**기하 로직은 단위 테스트**(`buildTrailPoints` / `buildTrailLinks` / `computeTrailColumns` 등)로,
**렌더 결과는 브라우저 DOM 주입 + computed-style 측정**으로 검증했다. 이 과정에서 발견해 함께 고친
실제 버그: 명패가 토큰을 덮던 겹침, U자 연결선이 명패 뒤로 53% 묻히던 문제, 접촉 고리 2px 편심,
장식 수면 평면이 만들던 2225px 가로 스크롤(→ `overflow: hidden`).

---

## 5. 홈(MyZone) · Study Zone 재설계

### 5.1 MyZone 홈 히어로

히어로 섹션을 **추천 Book + 최근 학습 Book** 공간으로 재구성했다(`HubHomePage.tsx`).

- **추천 Book**: Placement Test 완료 후 배치 결과(`recommendation.target` grade/level)에서 파생한
  7개. 배치 전에는 배치고사 CTA를 노출한다.
- **최근 학습 Book**: 신규 열람 추적(`recordRecentBook`, `localStorage`, 최대 12개) + 진행률 fallback,
  실제 썸네일 표시.
- 아이들 취향의 팬시 애니메이션(등장 스태거, 말랑 젤리 프레스)을 적용하되, 태블릿 터치에서 체감되도록
  **프레스 후 이동에 딜레이**(`TILE_PRESS_NAV_MS`)를, 스태거는 더 느린 지연을 준다.

### 5.2 Study Zone — 거인의 책장

좌측 사이드 메뉴 기반 구조를 **전체 폭 책장(shelf wall)** UI로 교체했다(`StudyZonePage.tsx`).

- 사이드바 제거 → 상단바 검색(`/study?q=...`)으로 대체.
- 모든 Grade / Level의 Book을 책장(bay)에 배열, 하단 Grade NAV의 노란 테두리가 **실제 터치한 Grade
  칩과 정확히 일치**하도록 most-visible-bay 감지 + CSS-calc 정렬로 수정.
- Next / Prev Level 칩: 대상 레벨의 첫 Book이 가장 왼쪽에 오도록 left-align 이동(`jumpToBayLeft`).
- 이어읽기 칩을 완독 수 칩 우측으로, 그 자리에 Prev Level 칩 배치. 카트는 책 썸네일과 겹치지 않게
  활성 bay 헤더의 ★완독 칩 우측에 배치.
- 책장 테마 5종(`wood` / `sky` / `forest` / `berry` / `night`), `localStorage` 저장.

---

## 6. 주요 버그 수정 및 안정화

- **NPC 리소스 미준비 Book**: 리소스 다운로드 실패로 "리소스를 준비하지 못했습니다" 경고와 함께
  Activity 목록이 안 뜨던 문제 → 리소스 없는 Activity를 목록에서 숨기고 오류화하지 않음.
- **Minimap 정렬**: 스크롤 비율 대신 CSS-calc(`--i`/`--n`) 기반으로 칩과 정확히 일치.
- **테스트 격리**: 완료 연출 테스트의 누적 렌더 문제 → `afterEach(cleanup)`.
- webm mime 오탐 방지, `itemType` 명시 타입, importer 정규식 `npcqhk` → `npcqhk2?` 일반화 등.

---

## 7. 주요 변경 파일

### `webapp/` (BFF + SPA)

- `server/index.mjs` — `NPCQHK02` code, `collectNpcQuickCheck2BookInfoResources`, `POST /api/learn/wrong-items`
- `src/services/activityCodes.ts`, `src/services/activityRegistry.tsx`, `src/services/metaon3ResourceAdapter.ts`
- `src/services/bookPackageImporter.ts`, `src/services/mime.ts`, `src/services/hubCatalog.ts`
- `src/features/npcQuickCheck/npcQuickCheck2ResourceAdapter.ts`, `NpcQuickCheckActivity.tsx`
- `src/api/npcQuickCheck.ts`, `src/api/uniplanetApi.ts`
- `src/pages/ActivityPage.tsx` — 별가루 연출 + 자동 이동
- `src/components/ActivityCompletionCelebration.tsx`
- `src/pages/HubBookPage.tsx` (+ `HubBookPage.helpers.test.ts`) — 징검다리 트레일
- `src/pages/HubHomePage.tsx` — MyZone 히어로
- `src/pages/StudyZonePage.tsx` (+ `StudyZonePage.helpers.test.ts`), `src/components/MetaOnHubShell.tsx` — 거인의 책장
- `src/hooks/useHubState.tsx` — 최근 Book 추적
- `src/styles-hub.css` — 트레일 · 시냇물 · 책장 · 홈 스타일

### `metaonlivechat/` (Viewer)

- `src/components/npcQuickCheck/NpcQuickCheckViewer.jsx` / `.css` — NPC UI 4개 개선
- `src/components/npcQuickCheck/scenarioRuntime.js`, `localSampleScenarios.js`

---

## 8. 검증 결과

| 대상 | 명령 | 결과 |
|---|---|---|
| Webapp | `npx tsc -b` | 통과 |
| Webapp | `npm test` | 32 files, **178 tests** 통과 |
| Webapp | `npm run build` | 통과 |
| 트레일 기하 | `HubBookPage.helpers.test.ts` | 29 tests (줄바꿈·U자 회전·고리 앵커 포함) |
| 브라우저 QA | DOM 주입 + computed-style 측정 | 상태별 돌 높이 / U자 회전 / 반응형 줄바꿈 / 고리 앵커 확인 |

원본 폴더(`D:\Codex\MetaOn\webapp`) 동기화 후 `tsc -b` · `npm test`(178 통과) 재확인.

---

## 9. 배포 현황

- 서비스: **`metaon-webapp`** (project `gen-lang-client-0309121556`, region `asia-northeast3`)
- 최신 리비전: **`metaon-webapp-00094-75b`** (트래픽 100%)
- URL: `https://metaon-webapp-441722815895.asia-northeast3.run.app`
  (동일 서비스의 legacy 형식: `https://metaon-webapp-geaypbs2uq-du.a.run.app`)
- 배포 명령: `gcloud run deploy metaon-webapp --source . --region asia-northeast3 --project gen-lang-client-0309121556 --clear-base-image --quiet`

> 별도 서비스 `metaon-web`(Viewer, project `meta-on-project-230224`)은 이번 범위와 무관.

---

## 10. 후속 확인 사항

1. upstream `/learn/wrong-items` 계약(경로 · `book_idx` 파라미터 · 응답 필드명) 백엔드 최종 확정.
2. `day.npcqhk2` 필드명/값 형태(문자열 S3 base) getBookInfo 실제 응답으로 확정.
3. CMS/Book data에 `NPCQHK02` Activity 등록(등록 전에는 기존 렌더러 사용).
4. 실제 태블릿 가로 해상도에서 트레일 줄바꿈 열 수 · U자 회전 가독성 확인
   (필요 시 `TRAIL_MAX_COLUMNS` 조정).
5. Activity 5개 이하 Book은 여전히 한 줄이므로, 짧은 Book도 접길 원하면 상한 하향 검토.
