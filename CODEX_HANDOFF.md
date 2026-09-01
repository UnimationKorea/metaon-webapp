# MetaOn Webapp 인수인계 문서

> 작성일: 2026-08-13 KST  
> 인수인계 범위: `D:\Codex\MetaOn\webapp`만 포함  
> 독립 인수인계 브랜치: `main`  
> 최근 배포 리비전: `metaon-webapp-00142-hqz`

이 문서는 MetaOn Webapp을 다른 컴퓨터 또는 다른 Codex 계정에서 이어서 개발하기 위한 기준 문서다. 소스, 설정, 배포 절차는 Webapp 범위만 다룬다. 비밀번호, 세션 ID, 브라우저 저장소, 서비스 계정 키, `.env` 파일은 문서나 Git에 포함하지 않는다.

## 1. 프로젝트 목적

MetaOn은 영어 학습 Book과 Activity를 브라우저 및 태블릿 WebView에서 제공하는 웹앱이다.

- 프런트엔드: React 18, Vite, TypeScript
- 서버: Express 기반 BFF(Backend for Frontend)
- 인증/콘텐츠: MetaOn3 API를 BFF를 통해 호출
- 학습 리소스: S3 다운로드 후 IndexedDB에 저장
- 미디어 성능: Cache Storage와 Service Worker를 보조 캐시로 사용
- 화면 기준: 가로 1280x720 Activity 화면과 태블릿 반응형 레이아웃
- 학습 이력: `learn_event`를 기록하여 추후 숙련도와 개인화에 활용

## 2. 현재 운영 상태

| 항목 | 값 |
|---|---|
| 기본 브랜치 | `main` |
| 인수인계 스냅샷 | Webapp 전용 독립 Git 번들의 `main` |
| 기존 원격 저장소 | `https://unimation@gitlab.com/unimation/metaon_client.git` |
| Cloud Run 서비스 | `metaon-webapp` |
| GCP 프로젝트 / 리전 | `gen-lang-client-0309121556` / `asia-northeast3` |
| 최근 확인 리비전 | `metaon-webapp-00142-hqz` |
| 서비스 URL | `https://metaon-webapp-geaypbs2uq-du.a.run.app` |

현재 서비스 배포본은 `43387c04` 기준으로 확인됐다. 이번 인수인계 번들에는 당시 부모 저장소에서 커밋되지 않았던 로그인 화면/스타일 변경과 `output/app-bootstrap-loader.png`도 포함된다. 새 변경을 배포하기 전에는 반드시 테스트와 빌드를 다시 실행한다.

## 3. 완료된 Webapp 기능

### 로그인, 프로필, 카탈로그

- MetaOn3 로그인과 프로필 선택 흐름
- 세션 보관 및 프로필별 홈/학습 상태 분리
- 브랜드, 그룹, 시리즈, Book 카탈로그 표시
- Book 진입 시 버전 비교 후 리소스를 내려받거나 캐시 재사용
- Home, Study Zone, Book 상세, Profile, Placement Test 화면

### 리소스 저장과 재생

- Book 리소스를 S3에서 받고 `metaon-web-cache` IndexedDB에 파일 Blob과 manifest로 저장
- 현재/다음 Activity의 이미지·음성·동영상을 우선 캐시
- `metaon-media-sw.js`가 Cache Storage 미디어와 영상 Range 요청을 처리
- Service Worker가 동작하지 않는 환경에서는 IndexedDB Object URL 방식으로 계속 실행
- Activity 진입 중에는 책/별 궤도 기반의 공통 로더를 사용

### 구현 또는 연결된 Activity

| 코드 | Activity | 비고 |
|---|---|---|
| `EBOOK01` | Listen & Read | ebook viewer 및 리소스 캐시 |
| `WDCA01` / `WDCA02` | Word Card / 영상형 Word Card | 카드 뒤집기, 음성, 스와이프 |
| `WDQU01` / `WDQU02` / `WDQU03` | Word Quiz | 텍스트/이미지 선택지, 영상형 포함 |
| `WDBL01` / `WDBL02` | Word Blank | 밑줄 빈칸, 영상형 포함 |
| `WDWR01` / `WDWR02` | Write Word | 필기 인식 연동 및 키보드 대체 입력 |
| `WDPL01` | Matching Game | 단어/이미지 짝맞추기 |
| `WDPL02` | Memory Card | 시간 제한 다단계 카드 매칭 |
| `STBL01` / `STBL02` | Sentence Blank | 문장 빈칸, 영상형 포함 |
| `STSC01` / `STSC02` | Sentence Unscramble | 문장 토큰 순서 맞추기, 영상형 포함 |
| `STRC01` / `STRC02` | Sentence Record | 문장 듣기와 녹음, 영상형 포함 |
| `MOVIE01` | Movie Play | Movie, Script, Movie+Script 모드 |
| `QCHK01` | Quick Check | BFF quiz adapter 및 공통 채점 |
| `NPCQHK01` / `NPCQHK02` | NPC Quick Check | 시나리오/음성 캐시, Parent-iframe 통신 |

### 학습 이력

- `learn_event`는 시작, 문항 보기, 선택/입력, 제출, 재생, 힌트, 완료 등의 원천 행동을 기록한다.
- 정오답 문항은 skill 정보를 함께 보낸다.
- 이벤트는 IndexedDB Outbox에 먼저 추가되고, 배치 전송 성공 시에만 삭제한다.
- 현재 프로필을 바꾸면 이전 프로필의 로컬 학습 상태가 다른 프로필에 표시되지 않도록 분리한다.
- Quick Check 계열은 별도 계약을 사용하므로 일반 `learn_event` 흐름과 섞지 않는다.

## 4. 유지해야 하는 설계 원칙

### NPC Quick Check는 별도 Viewer를 필요로 한다

`NPCQHK01`과 `NPCQHK02`는 ActType 65을 공유하지만 `QCHK01`과 다르게 Parent Webapp과 외부 iframe Viewer가 함께 실행한다. Webapp은 캐시 리소스, 채점, 분기, launch token, 학습 이벤트를 담당하고 Viewer는 화면과 입력만 담당한다. 상세 계약은 `NPC_QUICK_CHECK_HANDOFF.md`를 기준으로 한다.

현재 표준 코드는 `NPCQHK01`, `NPCQHK02`다. `NPCQCK01/02`와 `QCNP01`은 현재 renderer 매핑에 없으므로 CMS/API 표기 변경 전에는 사용하지 않는다.

### BFF를 유지한다

브라우저는 `/api/*`만 호출한다. BFF는 MetaOn3 인증 세션, HttpOnly cookie, 업스트림 API 변환, Study API, LearnEvent API, 외부 서비스 launch token을 처리한다. 업스트림 세션이나 API 키를 프런트엔드에 노출하지 않는다.

### Activity 문자열 코드가 우선이다

renderer 선택은 `activity_code`를 가장 먼저 사용한다. 숫자 ActType은 이전 데이터 호환을 위한 fallback이다. 새 Activity를 추가하면 아래 항목을 함께 수정한다.

1. `src/services/activityCodes.ts`
2. `src/services/activityRegistry.tsx`
3. 리소스 adapter와 importer
4. renderer 및 CSS
5. LearnEvent/skill mapping
6. 단위 테스트

### 캐시는 2단계다

1. IndexedDB: Book manifest와 Blob을 장기 보관하는 기본 저장소
2. Cache Storage: 이미지, 음성, 동영상의 재생 시작을 빠르게 하는 보조 저장소

Cache Storage만 전제로 구현하지 않는다. WebView, private browsing, quota 부족, Service Worker 미제어 상태에서도 IndexedDB fallback이 필요하다.

### 로컬 진도는 UI 상태다

홈/Book 화면의 완료 표시와 최근 학습은 프로필별 로컬 상태를 사용한다. 서버 기준 진도 API가 확정되면 이 부분은 BFF Port를 통해 교체한다. 서버 학습 로그와 화면 표시를 혼동하지 않는다.

## 5. 남은 작업과 확인 항목

1. 학습 이벤트 API의 서버 응답 계약을 운영 서버 기준으로 재확인한다.
   - `accepted_event_count + duplicated_event_count`가 전송한 이벤트 수와 같을 때만 Outbox를 삭제한다.
   - `batch_id` 또는 `payload_hash`를 응답에 포함하는 것을 권장한다.
2. 필기 인식 기능은 Cloud Run Secret `METAON_GOOGLE_VISION_API_KEY` 설정 여부를 확인한다.
3. NPCQHK02는 학습 결과 기반 단어/문장 데이터를 받는 서버 계약을 확정하고 sample fallback을 제거한다.
4. LocalStorage/IndexedDB 데이터의 프로필 전환·로그아웃·버전 갱신 시나리오를 실제 태블릿에서 확인한다.
5. 실제 Book별 리소스 누락, S3 CORS, MIME type, 영상 Range 요청을 지속 점검한다.
6. 배포 전에는 로그인, 프로필 선택, Book 다운로드, 대표 Activity 실행, LearnEvent 전송을 브라우저에서 직접 확인한다.

## 6. 폴더 구조

```text
D:\Codex\MetaOn\webapp\
├─ src\
│  ├─ api\                    # 프런트엔드 API client
│  ├─ components\             # 공통 UI 및 Activity renderer
│  ├─ features\quickCheck\   # QCHK01 DTO, 채점, 화면
│  ├─ features\npcQuickCheck\# NPCQHK Parent host, protocol, adapter
│  ├─ hooks\                  # 인증, 카탈로그, Book package, Hub 상태
│  ├─ pages\                  # Home, Study, Book, Activity, Placement, Profile
│  ├─ services\               # cache, importer, registry, LearnEvent
│  ├─ types\                  # MetaOn 및 LearnEvent 계약
│  └─ placementTest\          # 배치고사 독립 화면
├─ public\                    # Activity/ebook/디자인 정적 자산, Service Worker
├─ server\                    # Express BFF
├─ shared\                    # 서버·클라이언트 공용 Quick Check 채점
├─ output\                    # 앱 부트 로더 등 필요한 생성 자산
├─ Dockerfile                  # Cloud Run 컨테이너 빌드
├─ package.json
├─ .env.example
├─ CODEX_HANDOFF.md            # 이 문서
└─ Project_context.md          # 빠른 프로젝트 문맥
```

## 7. 주요 파일

| 경로 | 역할 |
|---|---|
| `src/services/activityCodes.ts` | Activity 문자열 코드, 표시명, fallback 매핑 |
| `src/services/activityRegistry.tsx` | 코드/유형 기준 renderer 선택 |
| `src/components/activities/PackageActivities.tsx` | Word/Sentence/Reading/Listening 등 주요 Activity 구현 |
| `src/services/metaon3ResourceAdapter.ts` | Book API 응답을 lesson/day/activity/resource manifest로 변환 |
| `src/services/bookPackageImporter.ts` | S3 파일 다운로드, generated JSON 생성, IndexedDB 저장 |
| `src/services/indexedDbStorage.ts` | `metaon-web-cache` package/file Blob 저장소 |
| `src/services/videoMediaCache.ts` | 영상형 Activity의 Cache Storage 우선 처리 |
| `src/services/learnEventRecorder.ts` | LearnEvent 생성, Outbox 기록, 재전송 |
| `src/services/learnEventOutbox.ts` | IndexedDB Outbox 저장/조회/삭제 |
| `src/pages/ActivityPage.tsx` | Activity route, 초기 로딩, 완료/뒤로가기 연결 |
| `src/pages/LoginPage.tsx` | 로그인 및 로그인 완료 상태 화면 |
| `server/index.mjs` | 인증, 프로필, 카탈로그, manifest, Study, LearnEvent BFF |
| `shared/quickCheckScoring.mjs` | Quick Check의 단일 공통 채점 규칙 |

## 8. 로컬 실행과 검증

```powershell
Set-Location D:\Codex\MetaOn\webapp
npm ci
Copy-Item .env.example .env.local
# 승인된 개발용 값만 .env.local에 입력한다.
npm run dev
```

- SPA: `http://127.0.0.1:5173`
- BFF: `http://127.0.0.1:4100`
- 테스트: `npm test -- --run`
- 프로덕션 빌드: `npm run build`

`server/index.mjs` 변경 후에는 `npm run dev`를 다시 시작한다.

## 9. 환경 변수와 Cloud Run

변수 이름은 `.env.example`을 기준으로 확인한다. 운영 비밀값은 Secret Manager에서만 관리한다.

| 용도 | Cloud Run 설정 |
|---|---|
| cookie 서명 | Secret `metaon-auth-cookie-secret` -> `METAON_AUTH_COOKIE_SECRET` |
| NPC launch token | Secret `metaon-npc-launch-secret` -> `METAON_NPC_LAUNCH_SECRET` |
| 필기 인식 | Secret `metaon-google-vision-api-key` -> `METAON_GOOGLE_VISION_API_KEY` |
| 공개 BFF 주소 | `METAON_PUBLIC_ORIGIN=https://metaon-webapp-geaypbs2uq-du.a.run.app` |
| 업스트림 API | `METAON_API_ORIGIN=https://metaon3-0-609870547235.asia-northeast3.run.app` |

배포는 깨끗한 작업 트리에서만 진행한다.

```powershell
Set-Location D:\Codex\MetaOn\webapp
npm test -- --run
npm run build
gcloud run deploy metaon-webapp --source . --region asia-northeast3 --project gen-lang-client-0309121556 --quiet
gcloud run services describe metaon-webapp --region asia-northeast3 --project gen-lang-client-0309121556 --format="yaml(status.url,status.latestReadyRevisionName,status.traffic)"
Invoke-WebRequest -UseBasicParsing https://metaon-webapp-geaypbs2uq-du.a.run.app/api/health
```

## 10. 다른 컴퓨터로 이전하기

전달 파일은 [상위 `handoff` 폴더]에 있는 `metaon-webapp-only-20260813.bundle`이다. 이 번들은 Webapp만 포함하는 독립 Git 저장소다.

```powershell
git clone D:\Transfer\metaon-webapp-only-20260813.bundle D:\Codex\MetaOn\webapp
Set-Location D:\Codex\MetaOn\webapp
npm ci
Copy-Item .env.example .env.local
npm test -- --run
npm run build
```

- `.env.local`은 새 컴퓨터에서 새로 만든다.
- 로그인 정보, 세션 ID, 브라우저 저장소, API 키, 서비스 계정 파일을 복사하지 않는다.
- 번들에는 인수인계 당시의 Login/스타일 변경과 로더 자산이 이미 포함되어 있다. 별도 patch 적용은 필요 없다.
- `metaon-main-20260813.bundle`은 이전 전체 아카이브이므로 사용하지 않는다.

## 11. 범위와 주의사항

- 이 인수인계는 Webapp 소스만 대상으로 한다. Unity 프로젝트, `Assets/`, `ProjectSettings/`, Android wrapper, 임시 배포 폴더는 포함하지 않는다.
- 서비스에서 사용하는 외부 API, S3 경로, Secret 이름은 운영 환경에서 다시 확인한다.
- 새로운 Activity는 문자열 코드, 리소스, renderer, 이벤트, 테스트를 한 묶음으로 추가한다.
- 사용자별 데이터는 프로필 키로 분리한다. 다른 프로필의 로컬 학습 데이터가 노출되지 않도록 변경 후 반드시 검증한다.
- 실제 배포 전에는 빌드 성공만 보지 말고, 로그인부터 Activity 실행까지 화면 흐름을 직접 확인한다.
