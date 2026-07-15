# MetaOn Webapp Codex Handoff

> 작성일: 2026-07-15 KST
> 주 작업 폴더: `D:\Codex\MetaOn\webapp`
> 연동 Viewer 폴더: `D:\Codex\metaonlivechat`
> 이 문서는 다른 Codex 계정이 현재 구현을 이어받기 위한 운영·개발 인계 문서다. 비밀값, 로그인 비밀번호, service account 키 내용은 기록하지 않는다.

## 1. 프로젝트 목적

MetaOn Unity 영어학습 앱을 웹 네이티브로 전환하는 프로젝트다. 핵심 목표는 다음과 같다.

- MetaOn3 API 로그인과 실제 카탈로그를 사용한다.
- Book 리소스를 MetaOn S3에서 받아 브라우저 IndexedDB에 캐시한다.
- Unity Activity를 웹 Activity renderer로 대체한다.
- 1280x720 학습 화면, 태블릿 WebView, Cloud Run 배포를 함께 지원한다.
- 학습 결과를 `learn_event`로 기록해 이후 개인화 학습에 사용할 수 있게 한다.
- AI Speaking, 메타버스, NPC Quick Check 같은 외부/iframe 경험을 MetaOn 로그인 흐름 안에서 안전하게 연동한다.

Unity 원본 프로젝트는 `D:\Codex\MetaOn`에 있다. Webapp은 Unity 프로젝트를 직접 수정하는 대신 해당 프로젝트의 Activity code, 리소스 구조, API 계약을 웹에 반영한다.

## 2. 현재 진행 상황

### 운영 배포 상태

| 구분 | 서비스 | GCP 프로젝트 | 현재 리비전 | URL |
|---|---|---|---|---|
| MetaOn 메인 Webapp + BFF | `metaon-webapp` | `gen-lang-client-0309121556` | `metaon-webapp-00076-j6s` | `https://metaon-webapp-geaypbs2uq-du.a.run.app` |
| AI Speaking / NPC Activity Viewer | `metaon-web` | `meta-on-project-230224` | `metaon-web-00126-ngs` | `https://metaon-web-qvfybxizya-du.a.run.app` |

두 서비스는 별도 프로젝트다. `metaon-webapp`은 React + Express BFF이며, `metaon-web`은 `D:\Codex\metaonlivechat`의 Viewer/AI 경험을 제공한다. 서로 다른 폴더에서 잘못된 서비스 이름으로 배포하면 한쪽 기능을 덮어쓸 수 있으므로 반드시 구분한다.

### 최신 검증 상태

| 대상 | 명령 | 최근 결과 |
|---|---|---|
| MetaOn Webapp | `npm test` | 28 files, 127 tests 통과 |
| MetaOn Webapp | `npm run build` | 통과 |
| NPC/AI Viewer | `npm test` | 통과 |
| NPC/AI Viewer | `npm run build:test` | 통과 |
| NPC/AI Viewer | `npm run lint` | 통과. 빈 ESLint 설정 경고만 존재 |
| 메인 BFF | `/api/health` | HTTP 200 JSON 응답 확인 |

## 3. 완료된 작업

### 3.1 MetaOn Webapp

- 실제 MetaOn3 로그인과 HttpOnly 인증 cookie 기반 BFF를 구현했다.
- MetaOn3 `getMyBrands`, `getBookInfo` 응답을 웹 카탈로그/Book manifest로 정규화했다.
- ZIP 다운로드 방식은 기본 흐름에서 제거했다. S3 리소스를 직접 내려받아 IndexedDB `metaon-web-cache`에 저장한다.
- Book 진입 시 리소스를 자동 다운로드하고, 다운로드 완료 후 Activity 큐브 흐름을 표시한다.
- Home, Study Zone, 브랜드/Grade/Level 메뉴, Book 상세, 모바일 sidebar drawer, 배치고사, 프로필/알림/기관 화면을 구현했다.
- Home에는 Placement Test, 이어서 학습, 오늘의 맞춤 학습, 추천 학습 UI 미리보기가 있다. 실제 추천 엔진은 아직 연결 전이다.
- AI Speaking과 메타버스는 HMAC launch token 기반 iframe 경험으로 연동한다.
- Activity 화면은 1280x720 기준 전체 학습 화면을 우선하며, 상단 UI는 콘텐츠 간섭을 줄이는 방향으로 조정됐다.
- Listen & Read는 E-book viewer/resource discovery를 우선 사용하고 기존 media fallback을 유지한다.
- 주요 Word/Sentence/Reading/Listening/Quick Check Activity renderer와 Figma 기반 Activity UI가 구현되어 있다.
- `learn_event` 수집, 녹음 업로드 경계, Activity 완료 시 study end/이벤트 flush 흐름을 추가했다.

### 3.2 Quick Check와 NPCQHK01

- 기존 `QCHK01` Quick Check는 유지한다.
- `NPCQHK01`과 이전 코드 `QCNP01`은 Activity code 기준으로 NPC renderer를 선택한다.
- `NPCQHK01`은 Book의 `npcqhk` 리소스와 캐시된 `script.json`, 음성 파일을 사용한다.
- iframe Viewer에는 정답을 제거한 문제만 전달한다. Parent Webapp이 채점과 LearnEvent 기록을 담당한다.
- NPC 대화, 자동 음성 재생, 선택 즉시 답안 제출, 정답/오답 분기, 결과 화면, 중복 제출 방지를 구현했다.
- 최근 수정으로 NPC 입은 CSS로 만든 별도 입 도형을 제거하고, Jade 본체 TALK Lottie와 전용 mouth Lottie viseme 프레임을 음원 재생 상태에 연결했다.
- 현재 리소스 기반 `NPCQHK01`은 결과를 `quizaccept`로 제출하지 않고 Activity 완료 및 LearnEvent를 기록한다. 과거 문서의 `QCNP01 + Quick Check API 제출` 설명은 이전 설계이므로 현재 소스를 우선한다.

### 3.3 연동 Viewer

- `D:\Codex\metaonlivechat`에 NPC Quick Check 전용 `?mode=npc-quick-check` Viewer가 있다.
- Parent/iframe은 origin 검증이 포함된 `postMessage` RPC로 통신한다.
- launch token은 iframe URL에 넣지 않고 Parent bootstrap 응답에서만 전달한다.
- Viewer backend는 HMAC token을 검증하고 Learning Zone API에서 사용자/Book 범위의 보조 학습 컨텍스트를 읽을 수 있다.

## 4. 미완료 작업

### 우선 미완료

1. **NPCQHK02 개인화 NPC Activity**
   - 아직 구현되지 않았다. 학습자의 word/sentence 학습 결과를 받아 동적으로 복습하는 별도 Activity code다.
   - UI는 NPCQHK01 Viewer를 재사용하되, Book `script.json`이 아니라 서버가 생성한 사용자별 고정 세션을 사용해야 한다.
   - 상세 계획은 최근 대화의 `NPCQHK02 적용 계획`을 따른다.

2. **실제 개인화 추천 엔진**
   - Home의 개인화 카드는 현재 UI/예시 중심이다.
   - `learn_event`를 파생 mastery/skill 데이터로 집계하고, 약점·간격 반복·다음 Book 추천 API를 연결해야 한다.

3. **전체 Unity Activity 포팅 완성**
   - 다수 Activity는 구현 또는 compatible renderer가 있지만, Unity 전체 Activity가 동등하게 구현된 상태는 아니다.
   - 새 Activity는 문자열 `activity_code`를 먼저 등록하고, 필요 시 동일 `ActType` 내에서 code로 renderer를 분기한다.

4. **고정 세션 저장소**
   - Quick Check/Placement 등 일부 세션 저장소는 프로세스 메모리를 사용한다.
   - Cloud Run 인스턴스가 여러 개가 되면 요청이 다른 인스턴스로 분산될 수 있으므로 Redis/DB 기반 공유 저장소 전환이 필요하다.

5. **인증/인식/개인화 API 운영 확정**
   - 필기·음성 인식 API는 보류 상태다.
   - Learning Zone의 개인화 세션 생성·답안 채점·완료 API 계약이 확정되어야 NPCQHK02를 안전하게 구현할 수 있다.

### 확인이 필요한 품질 항목

- 실제 Android APK/WebView에서 로그인, IndexedDB, 대용량 S3 리소스, video/audio, microphone까지의 완전한 E2E 검증은 계속 필요하다.
- Browser 자동화 런타임에서 `Cannot redefine property: process` 오류가 발생한 적이 있다. 이는 앱 오류가 아니라 Codex Browser 연결 문제였으며, 해당 상황에서는 빌드·테스트·HTTP 검증만 완료된 상태로 기록한다.
- 외부 iframe은 대상 서비스의 CSP/X-Frame-Options 정책이 바뀌면 로딩에 실패할 수 있으므로 배포 후 항상 실제 진입을 확인한다.

## 5. 핵심 설계 이유

### BFF와 인증

브라우저가 upstream API를 직접 호출하지 않는다. 기존 API의 CORS, HTTP/HTTPS, session header 문제를 Express BFF가 흡수하고, upstream session은 동일 출처 HttpOnly cookie에 보관한다.

### S3 + IndexedDB

Book 단위 리소스는 S3에서 다운로드하고 IndexedDB에 Blob으로 저장한다. 이후 Activity는 네트워크 대신 cached package를 참조한다. 이는 ZIP 해제보다 재사용과 부분 리소스 확장에 적합하며 태블릿 WebView에도 일관된 방식이다.

### Activity code 우선 renderer 선택

같은 Unity `ActType`도 신규 문자열 code에 따라 UI/데이터 원천이 다를 수 있다. 예를 들어 `QCHK01`, `NPCQHK01`, 향후 `NPCQHK02`는 모두 Quick Check 계열이지만 renderer와 데이터 계약이 다르다. 따라서 `activity_code`가 renderer 선택의 우선 기준이다.

### Parent가 채점·권한을 보유

외부 iframe Viewer는 화면과 입력만 담당한다. 정답, MetaOn 로그인 cookie, upstream session, study log, launch secret은 Parent Webapp/BFF에 남긴다. RPC origin과 iframe `contentWindow`를 모두 검증한다.

### 사용자별 세션은 immutable snapshot

향후 NPCQHK02에서는 시작 시 선택된 word/sentence 목록과 순서를 `session_id`로 고정한다. 활동 중 새 LearnEvent가 들어와도 현재 Activity의 문제·정답·분기는 변하지 않아야 한다.

## 6. 폴더 구조

```text
D:\Codex\MetaOn\
├─ Assets\                         # Unity 원본. Webapp 작업 시 임의 수정 금지
└─ webapp\                          # 메인 MetaOn Webapp / Cloud Run metaon-webapp
   ├─ src\
   │  ├─ api\                       # Browser -> BFF API client
   │  ├─ components\                # 공통 UI, Activity controls, Activity renderers
   │  ├─ components\activities\     # PackageActivities.tsx 등 다수 Activity 구현
   │  ├─ features\quickCheck\       # QCHK01 DTO, 채점/화면
   │  ├─ features\npcQuickCheck\    # NPCQHK01 Parent host, resource adapter, RPC protocol
   │  ├─ pages\                     # Hub, Study, Book, Activity, Placement 화면
   │  ├─ services\                  # catalog, IndexedDB, resource importer, activity registry
   │  ├─ placementTest\              # Placement Test 하위 앱/데이터
   │  └─ types\                     # metaonTypes, LearnEvent 타입
   ├─ server\                       # Express BFF
   ├─ shared\                       # Parent/BFF 공유 채점·시나리오 계약
   ├─ public\metaon-assets\         # UI/Activity 이미지와 정적 리소스
   ├─ Dockerfile
   ├─ .env.example
   ├─ implementation_0701.md         # 초기 API/S3 전환 이력
   ├─ implementation_0710.md         # Quick Check 중심 구현 이력
   ├─ implementation_0713.md         # NPC 구현 이력. 일부 과거 설계 표기 주의
   └─ CODEX_HANDOFF.md               # 이 문서

D:\Codex\metaonlivechat\            # AI Speaking + NPC Viewer / Cloud Run metaon-web
├─ src\components\npcQuickCheck\    # iframe Viewer UI, scenario runtime
├─ src\services\rpc\                # Parent/iframe RPC client
├─ src\components\lottie\            # 기존 NPC body/mouth Lottie 구현 참조
├─ backend\                           # FastAPI, launch token, Learning Zone client
├─ public\npc-quick-check-samples\   # 독립 Viewer 샘플
├─ Dockerfile
└─ .env.example
```

## 7. 주요 클래스·모듈

### 메인 Webapp

| 파일 | 역할 |
|---|---|
| `src/pages/ActivityPage.tsx` | study start/end, fullscreen, learnEvent flush, Activity renderer context 생성 |
| `src/services/activityCodes.ts` | 신규 문자열 Activity code와 Unity ActType 매핑 |
| `src/services/activityRegistry.tsx` | code/ActType 기준 renderer 선택 |
| `src/components/activities/PackageActivities.tsx` | Word, Sentence, Reading, Listening 등 주요 Activity renderer 집합 |
| `src/services/metaon3ResourceAdapter.ts` | MetaOn3 Book API 응답을 lesson/day/activity/resource manifest로 정규화 |
| `src/services/bookPackageImporter.ts` | S3 리소스 다운로드, generated JSON, IndexedDB package 저장 |
| `src/services/indexedDbStorage.ts` | `metaon-web-cache` package/file Blob 저장소 |
| `src/features/quickCheck/QuickCheckActivity.tsx` | 일반 `QCHK01` Quick Check 화면과 제출 흐름 |
| `src/features/npcQuickCheck/NpcQuickCheckActivity.tsx` | NPCQHK01 Parent host, RPC 처리, LearnEvent, 완료 처리 |
| `src/features/npcQuickCheck/npcQuickCheckResourceAdapter.ts` | cached `npcqhk/script.json`과 음성 Blob을 Viewer bootstrap 형태로 변환 |
| `server/index.mjs` | Express BFF, 인증, catalog, resource manifest, study, LearnEvent, iframe launch API |
| `server/npcQuickCheckLaunch.mjs` | 30분 HMAC NPC launch token 생성·검증 |
| `server/npcQuickCheckScenarioSource.mjs` | 선택적 원격 scenario API 조회/검증 |
| `shared/quickCheckScoring.mjs` | Quick Check 공통 정답·복합형 채점 규칙 |
| `shared/npcQuickCheckScenario.mjs` | NPC scenario 상태 머신 계약과 validation |

### NPC/AI Viewer

| 파일 | 역할 |
|---|---|
| `src/components/npcQuickCheck/NpcQuickCheckViewer.jsx` | NPC 말풍선, 질문, 자동 음성, 분기, Jade body/mouth Lottie 상태 제어 |
| `src/components/npcQuickCheck/NpcQuickCheckViewer.css` | 데스크톱/태블릿 NPC Activity layout 및 Lottie 합성 좌표 |
| `src/components/npcQuickCheck/scenarioRuntime.js` | scenario node/질문/분기 조회 |
| `src/services/rpc/npc-quick-check-rpc.js` | Viewer가 Parent에게 호출하는 RPC facade |
| `backend/main.py` | FastAPI API, `/activity-viewer/context`, AI/관리 기능 |
| `backend/launch_token.py` | Parent BFF와 동일 secret을 사용하는 launch token 검증 |
| `backend/learning_zone.py` | `user_id + book_idx` 범위 Learning Zone 데이터 조회·정규화 |

## 8. 로컬 실행 방법

### 8.1 MetaOn Webapp

```powershell
Set-Location D:\Codex\MetaOn\webapp
npm ci
Copy-Item .env.example .env.local
# .env.local에 승인된 개발용 값만 설정한다. 비밀값은 채팅/문서에 넣지 않는다.
npm run dev
```

- Browser SPA: `http://127.0.0.1:5173`
- Express BFF: `http://127.0.0.1:4100`
- 검증: `npm test`, `npm run build`

`server/index.mjs`는 watcher가 아니다. BFF를 수정한 경우 `npm run dev`를 재시작한다.

### 8.2 NPC/AI Viewer

```powershell
Set-Location D:\Codex\metaonlivechat
npm ci
npm run dev:test -- --port 5174
```

- 독립 NPC Viewer: `http://127.0.0.1:5174/?mode=npc-quick-check&sample=G1LG11`
- 다른 sample: `sample=GPLB64`
- 검증: `npm test`, `npm run build:test`, `npm run lint`

Viewer backend가 필요한 경우:

```powershell
Set-Location D:\Codex\metaonlivechat\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

메인 Webapp의 `.env.local`에는 local Viewer URL, Viewer의 환경에는 local FastAPI URL을 설정해야 한다. 양쪽을 동시에 실행할 때 port 충돌 여부를 먼저 확인한다.

## 9. Cloud Run 배포 방법

### 메인 Webapp 배포

```powershell
Set-Location D:\Codex\MetaOn\webapp
npm test
npm run build
gcloud run deploy metaon-webapp --source . --region asia-northeast3 --project gen-lang-client-0309121556 --clear-base-image --quiet
gcloud run services describe metaon-webapp --region asia-northeast3 --project gen-lang-client-0309121556 --format="yaml(status.url,status.latestReadyRevisionName,status.traffic)"
Invoke-WebRequest -UseBasicParsing https://metaon-webapp-geaypbs2uq-du.a.run.app/api/health
```

### NPC/AI Viewer 배포

```powershell
Set-Location D:\Codex\metaonlivechat
npm test
npm run build:test
gcloud run deploy metaon-web --source . --region asia-northeast3 --project meta-on-project-230224 --clear-base-image --quiet
gcloud run services describe metaon-web --region asia-northeast3 --project meta-on-project-230224 --format="yaml(status.url,status.latestReadyRevisionName,status.traffic)"
```

`METAON_NPC_LAUNCH_SECRET`은 Main Webapp BFF와 Viewer backend가 같은 Secret Manager 값이어야 한다. 배포 명령에 secret/env 값을 생략하면 기존 서비스 설정이 유지되는지 `gcloud run services describe`로 반드시 확인한다.

## 10. 주의사항

1. **상위 Unity 저장소가 dirty 상태다.** `D:\Codex\MetaOn\webapp`에서 `git status`를 실행해도 상위 Unity 파일이 함께 보일 수 있다. `git add .`, `git reset --hard`, 광범위한 checkout/revert를 사용하지 않는다.
2. **`D:\Codex\metaonlivechat\backend`에 credential 파일과 `.env`가 존재할 수 있다.** Git에 추가하거나 채팅/문서에 내용을 복사하지 않는다. 공개 배포 전에는 현재 Git 추적 여부를 검사하고 키를 회전한다.
3. **Cookie secret은 stable해야 한다.** `METAON_AUTH_COOKIE_SECRET`이 revision마다 바뀌면 기존 로그인 cookie가 무효화된다.
4. **S3는 Browser 직접 다운로드가 기본이다.** CORS, URL, resource path, MIME type을 변경할 때 IndexedDB 재사용과 WebView 동작을 함께 검증한다.
5. **Activity code와 ActType을 혼동하지 않는다.** code가 바뀌면 `activityCodes.ts`, `activityRegistry.tsx`, 서버 code normalization, 테스트를 함께 확인한다.
6. **NPCQHK01의 정답은 iframe에 전달하지 않는다.** 새 NPC Activity도 Parent/BFF에서 정답·채점·권한을 유지한다.
7. **문서의 시점 차이를 확인한다.** `implementation_0701.md`, `implementation_0710.md`, `implementation_0713.md`는 유용한 이력 문서이나 현재 소스와 Activity code 표기가 다를 수 있다. 구현 전 현재 코드와 테스트를 먼저 읽는다.
8. **Cloud Run 메모리 세션을 신뢰하지 않는다.** 사용자별 세션/정답 제출을 새로 추가할 때는 idempotency key와 공유 저장소 계획을 함께 넣는다.

## 11. 다음 우선순위

1. **NPCQHK02 설계 확정 및 구현**
   - 개인화 서버가 `session_id`, word/sentence `item_idx`, 선택 사유, 미디어 URL, 문제 유형을 고정 snapshot으로 반환하도록 계약한다.
   - server-authoritative answer API를 추가하고, 기존 NPC Viewer UI/RPC를 공통화한다.
   - 동적 미디어는 `personalized:<type>:<item_idx>:<hash>` 키로 IndexedDB에 캐시한다.

2. **개인화 데이터 파이프라인 연결**
   - LearnEvent -> word/sentence mastery -> skill mastery -> 추천 세션 생성 흐름을 서버에 구현한다.
   - Home의 개인화 카드와 NPCQHK02 진입을 실제 API 데이터로 바꾼다.

3. **NPCQHK01 운영 검증**
   - 실제 Book `NPCQHK01` 데이터, S3 script/audio, Android WebView, 사용자 LearnEvent를 E2E로 확인한다.
   - Jade mouth Lottie가 PC/태블릿에서 본체와 일치하는지 실제 화면으로 재확인한다.

4. **세션 저장소 운영화**
   - Quick Check, Placement, NPC 개인화 세션을 Redis/DB로 이동하고 중복 제출/재진입을 검증한다.

5. **나머지 Activity 품질 정리**
   - renderer별 리소스 근거, mobile layout, font scaling, LearnEvent item PK, audio/retry 흐름을 우선 순위로 점검한다.

## 12. 다음 담당자의 첫 점검 순서

1. 이 문서와 `package.json`, `.env.example`, 최근 `implementation_0713.md`를 읽는다.
2. Main Webapp과 Viewer 각각에서 `npm test`와 build를 실행한다.
3. Cloud Run 현재 revision/traffic과 `/api/health`를 확인한다.
4. 테스트 계정으로 로그인 후 Book 리소스 다운로드, 일반 Activity, NPCQHK01을 한 번씩 실행한다.
5. 새 기능은 `activity_code`, resource/API adapter, renderer, LearnEvent, tests, deployment까지 한 단위로 변경한다.
