# MetaOn Web App Implementation 0630

문서 기준: 2026-06-30 작업 상태  
검증 재실행: 2026-07-01  
대상 경로: `D:\Codex\MetaOn\webapp`

## 1. Summary

MetaOn Unity 앱을 웹 네이티브 앱으로 재구성한 현재 개발물은 `React 18 + Vite + TypeScript` 프론트엔드와 `Node/Express` BFF로 구성되어 있다. Unity 프로젝트 자체는 수정하지 않고, 실제 MetaOn 계정 로그인, 실제 Book catalog API, Book ZIP 다운로드, IndexedDB 패키지 캐시, Activity renderer를 웹 런타임으로 연결했다.

현재 핵심 학습 흐름은 다음과 같다.

1. `/login`에서 실제 MetaOn 계정으로 로그인한다.
2. BFF가 MetaOn upstream 세션을 같은 출처의 HttpOnly cookie로 보관한다.
3. `/study` 또는 `/catalog`에서 실제 `/book/list` catalog를 불러온다.
4. 브랜드 -> 그룹 -> 시리즈 -> Book을 선택한다.
5. Book 상세에서 ZIP package를 다운로드한다.
6. 클라이언트가 JSZip으로 ZIP을 해제하고 IndexedDB에 파일 단위로 저장한다.
7. `info_lesson.json`, `info_day.json`에서 Lesson/Day/Activity metadata를 생성한다.
8. `/activity/:seriesGroup/:seriesIdx/:bookId/:dayId/:actNum`에서 1280x720 기준 Activity 화면을 실행한다.

## 2. Runtime Stack

| 영역 | 현재 구현 |
| --- | --- |
| Frontend | React 18, Vite, TypeScript, React Router |
| BFF | Express 4, Node 22 |
| Package 처리 | BFF ZIP streaming + client JSZip unzip |
| Browser cache | IndexedDB database `metaon-web-cache` |
| UI 기준 | `metaon_3` 스타일 Hub Shell 병합 |
| Activity 기준 | Unity `ActType` 숫자 계약 유지 |
| 배포 | Dockerfile 기반 Cloud Run 가능 구조 |
| APK | WebView wrapper가 Cloud Run URL을 여는 구조로 유지 |

주요 명령:

```powershell
cd D:\Codex\MetaOn\webapp
npm run dev
npm run build
npm test -- --run
```

로컬 기본 주소:

- Frontend: `http://127.0.0.1:5173`
- BFF: `http://127.0.0.1:4100`

## 3. Routes

현재 `src\App.tsx` 기준 라우트는 다음과 같다.

| Route | 화면/역할 |
| --- | --- |
| `/` | MetaOn Hub Home |
| `/login` | 실제 MetaOn 로그인 |
| `/study` | StudyZone |
| `/catalog` | StudyZone alias |
| `/books/:seriesGroup/:seriesIdx/:bookId` | Book 상세, 다운로드, Activity 목록 |
| `/activity/:seriesGroup/:seriesIdx/:bookId/:dayId/:actNum` | Activity 실행 화면 |
| `/ai-chat` | AI Chat launch 화면 |
| `/ai-session` | AI Chat iframe/mock frame |
| `/chat-history` | local chat history |
| `/metaverse` | Metaverse launch 화면 |
| `/metaverse-world` | Metaverse iframe/mock frame |
| `/profile` | Profile |
| `/profile/edit` | Profile edit |
| `/progress` | 학습 진도 |
| `/notifications` | 알림 |
| `/institution/apply` | 기관 신청 |
| `/institution/status` | 기관 상태 |
| `/access-denied` | 접근 제한 |

Activity route는 Hub Shell 내부 일반 페이지가 아니라 기존 1280x720 Unity landscape 기준의 전체화면 학습 런타임을 유지한다.

## 4. Authentication And Session

현재 인증은 `metaon_3` mock auth가 아니라 실제 MetaOn 로그인/BFF cookie 방식이다.

주요 파일:

- `src\hooks\useAuth.tsx`
- `src\api\uniplanetApi.ts`
- `server\index.mjs`

주요 API:

| API | 역할 |
| --- | --- |
| `GET /api/auth/me` | 현재 BFF auth cookie 확인 |
| `POST /api/auth/login` | MetaOn `/user/login` proxy, HttpOnly auth cookie 발급 |
| `POST /api/auth/session` | 기존 `Session-Id` 또는 `JSESSIONID` 수동 주입/검증 |
| `POST /api/auth/logout` | auth cookie 삭제, catalog cache clear |

로그인 성공 후 클라이언트는 보조적으로 다음 localStorage 값을 관리한다.

- `metaon-web-client-id`
- `metaon-session-id`
- `metaon-user-idx`

BFF의 실제 인증 권한은 signed HttpOnly cookie가 기준이다. Cloud Run에서는 `METAON_AUTH_COOKIE_SECRET`을 고정해야 revision 재시작 후에도 cookie 검증이 유지된다.

## 5. Catalog And StudyZone

`GET /api/books`는 MetaOn upstream `https://imetaon.com:5680/book/list`를 호출하고, Unity header 계약을 붙인다.

기본 header/env 계약:

| 값 | 기본값 |
| --- | --- |
| `METAON_API_ORIGIN` | `https://imetaon.com:5680` |
| `METAON_APP_IDX` | `2` |
| `METAON_APP_VERSION` | `2.2.25` |
| `METAON_PLATFORM` | `Android` |

Catalog normalizer는 upstream `brandlist -> sglist -> slist -> blist` 구조를 웹 타입으로 변환한다.

주요 타입:

- `BrandData`
- `SeriesGroup`
- `SeriesData`
- `BookData`
- `BookCatalog`

현재 StudyZone은 `metaon_3` UI 스타일로 다음 구조를 사용한다.

- 브랜드 탭
- 그룹 chip row
- 시리즈 chip row
- Book grid
- 우측 progress/AI/Metaverse launcher
- 모바일/APK 하단 navigation

### 5.1 Recent Fix - Speaking Master Brand

`Speaking Master`는 실제 catalog에서 `brandId: 0`이다. 기존 파라미터 parser가 `0`을 무효값으로 처리해서 `/study?brand=0` 또는 `Speaking Master` 탭 클릭 시 첫 번째 브랜드인 `코스북`으로 fallback 되는 문제가 있었다.

수정 파일:

- `src\pages\StudyZonePage.tsx`

수정 내용:

- 브랜드 파라미터 전용 `brandParam()` 추가
- `brand=0`을 유효값으로 허용
- 브랜드/그룹/시리즈 변경 시 하위 선택값이 이전 브랜드에서 섞이지 않도록 reset 흐름 정리

검증된 상태:

- `Speaking Master 1315 Books` 탭 클릭 후 URL이 `brand=0`으로 유지됨
- 화면 제목이 `Speaking Master / Small Potaoteos Season 2 / 1월`로 표시됨
- 직접 URL `http://127.0.0.1:5173/study?brand=0&group=15` 진입 시 코스북으로 fallback 되지 않음

## 6. Current BFF API Surface

`server\index.mjs` 기준 현재 API는 다음과 같다.

| API | 현재 역할 |
| --- | --- |
| `GET /api/health` | BFF runtime/env 상태 확인 |
| `GET /api/auth/me` | 현재 인증 상태 |
| `POST /api/auth/login` | MetaOn login proxy |
| `POST /api/auth/session` | 수동 session 검증 |
| `POST /api/auth/logout` | logout |
| `GET /api/books` | 실제 Book catalog proxy/normalize |
| `GET /api/packages` | `/book/packagelist` proxy |
| `GET /api/books/:seriesGroup/:seriesIdx/:bookId/package` | Book ZIP streaming |
| `GET /api/books/:seriesGroup/:seriesIdx/:bookId/thumbnail` | Book thumbnail proxy |
| `GET /api/books/:seriesGroup/:seriesIdx/:bookId/info` | Book package metadata JSON proxy |
| `POST /api/study/start` | study start proxy |
| `POST /api/study/end` | study end proxy |
| `POST /api/study/quiz-accept` | quiz accept proxy |
| `POST /api/external/launch` | AI/Metaverse iframe launch token 생성 |
| `POST /api/recognition/speech` | 현재 501 stub |
| `POST /api/recognition/handwriting` | 현재 501 stub |

현재 ZIP package URL은 catalog의 `bUrl`과 `bookId`를 조합해 생성한다.

```text
{METAON_CDN_ORIGIN}/{bUrl}/{bookId}.zip
```

기본 CDN origin:

```text
https://metaon.s3.ap-northeast-2.amazonaws.com
```

## 7. Package Download And IndexedDB Cache

현재 구현 파일:

- `src\hooks\useBookPackage.ts`
- `src\services\bookPackageImporter.ts`
- `src\services\indexedDbStorage.ts`
- `src\services\packageKeys.ts`

현재 package flow:

```text
BookData
-> GET /api/books/:seriesGroup/:seriesIdx/:bookId/package
-> BFF streams ZIP
-> client receives ArrayBuffer
-> JSZip.loadAsync()
-> each ZIP entry converted to Blob
-> IndexedDB files store에 저장
-> info_lesson.json / info_day.json 기반 BookPackage 생성
-> Activity renderer가 IndexedDB Blob을 object URL로 읽음
```

IndexedDB:

| Store | 역할 |
| --- | --- |
| `packages` | `BookPackage` metadata 저장 |
| `files` | package file Blob 저장 |

파일 key:

```text
{packageKey}::{normalizedPath}
```

Package key:

```text
{seriesGroup}:{seriesIdx}:{bookId}
```

현재 다운로드 진행 상태:

| Phase | 의미 |
| --- | --- |
| `downloading` | ZIP stream download |
| `unzipping` | JSZip unzip 및 Blob 변환 |
| `saving` | IndexedDB 저장 |
| `done` | Activity 실행 가능 |
| `error` | 다운로드/압축해제/저장 실패 |

## 8. Activity Contract

Unity `Act_Type` 숫자값은 `src\types\metaonTypes.ts`의 `ActType` enum으로 유지한다. 이전 `uniplanet.ts` 명칭은 `metaonTypes.ts`로 정리되었고, MetaOn 웹앱은 이 타입 파일을 기준으로 동작한다.

Activity metadata는 ZIP 내부의 다음 파일에서 파생된다.

```text
info_lesson.json
Lessons/L{lesson}/D{day}/info_day.json
```

`info_day.json`의 `activitys[].code`가 `ActType`이며, `activitys[].param`, `activitys[].use_word_list`가 renderer의 리소스 선택 근거가 된다.

현재 Activity registry:

- `src\services\actTypeCatalog.ts`
- `src\services\activityRegistry.tsx`
- `src\components\activities\PackageActivities.tsx`

Activity 상태 분류:

| Status | 의미 |
| --- | --- |
| `implemented` | 전용 웹 renderer 구현 |
| `compatible-renderer` | 유사 renderer로 우선 실행 |
| `planned` | metadata 분석 및 전용 구현 필요 |
| `web-replacement` | Unity native/AR/pen/camera 등 웹 대체 설계 필요 |

현재 전용 또는 호환 renderer로 실행되는 주요 Activity:

- Reading `66`
- Listening `67`
- Ebook `16`
- BookPage `46`
- MoviePlay `13`
- VocaPreview `1`
- VocaQuiz `4`
- VocaCheck `5`, `1005`
- SentenceCheck `6`, `1006`
- SentenceUnscramble `7`, `1007`
- MatchingGame `8`
- MemoryGame `15`
- FlashCard `17`, `26`, `117`, `1017`
- SoundWord `21`
- SoundCheck `23`
- SpellingCheck `24`
- WordPuzzle `27`, `53`
- WordSearch `28`
- WriteQuiz `30`
- ListenRecord `32`, `1032`
- PeelingWord `47`
- WriteWord `48`
- WordBox `50`
- ReadAndFlip `57`
- UnderSea `59`
- Reading2/StoryCheck `1201`
- Reading5/Sequencing `1501`
- SentenceShadowing `9`, `1009`

지원되지 않거나 아직 전용 구현이 부족한 Activity는 `PendingActivity` 또는 compatible renderer로 fallback 된다.

## 9. Activity Resource Mapping

Activity renderer는 IndexedDB에 저장된 package file path를 기준으로 필요한 리소스를 찾는다. 경로 판단 기준은 `PackageActivities.tsx`의 helper 함수와 각 renderer의 호출 구조다.

대표 경로:

| Activity 계열 | 대표 경로 |
| --- | --- |
| Word 계열 | `Lessons/L{lesson}/D{day}/word/...` |
| Sentence 계열 | `Lessons/L{lesson}/D{day}/sentence/...` |
| Reading 계열 | `Lessons/L{lesson}/D{day}/reading...` 또는 `reading_1201`, `reading_1501` |
| Listening 계열 | `Lessons/L{lesson}/D{day}/listening/{param}/video/...` |
| Movie 계열 | `Lessons/L{lesson}/D{day}/movie/info_movie.json`, `video/movie/...` |
| BookPage/Ebook 계열 | `Lessons/L{lesson}/D{day}/bookpage/{param}/...` |
| ReadAndFlip 계열 | `read_n_flip` 관련 JSON 및 page assets |

별도 산출물:

- `activity_resource_mapping.xlsx`
- `activity_resource_mapping_0629.xlsx`

이 Excel 문서에는 Activity code, renderer, 사용 리소스 함수, 추론 근거, fallback 규칙이 정리되어 있다.

## 10. UI State

현재 UI는 `metaon_3` 스타일을 `D:\Codex\MetaOn\webapp`에 병합한 상태다.

주요 파일:

- `src\components\MetaOnHubShell.tsx`
- `src\pages\HubHomePage.tsx`
- `src\pages\StudyZonePage.tsx`
- `src\pages\HubBookPage.tsx`
- `src\pages\ProfilePages.tsx`
- `src\pages\ExternalPages.tsx`
- `src\styles-hub.css`
- `public\metaon-assets`

구현된 UI 흐름:

- Home 브랜드 메뉴
- StudyZone 실 catalog 기반 탐색
- Book thumbnail 표시
- Book 상세 popup/page 스타일 학습 진입
- Package download CTA
- Activity 목록
- Activity 1280x720 전체화면 실행
- AI Chat/Metaverse mock iframe launch
- Profile/Progress/Notifications/Institution local persistence
- Desktop 좌측 navigation
- Mobile/APK 하단 navigation

## 11. Deployment State

Dockerfile은 Cloud Run 배포 가능한 형태다.

Build stage:

```text
node:22-slim
npm ci
npm run build
npm prune --omit=dev
```

Runtime stage:

```text
node:22-slim
node server/index.mjs
EXPOSE 8080
```

Cloud Run 필수/권장 환경 변수:

| Env | 목적 |
| --- | --- |
| `PORT` | Cloud Run runtime port, 기본 4100이나 Cloud Run은 8080 주입 |
| `METAON_AUTH_COOKIE_SECRET` | auth cookie 서명 안정화 |
| `METAON_AUTH_COOKIE_SECURE` | HTTPS cookie secure 설정 |
| `METAON_API_ORIGIN` | MetaOn API origin override |
| `METAON_CDN_ORIGIN` | CDN/S3 origin override |
| `METAON_AI_CHAT_URL` | 실제 AI Chat URL 연결 시 사용 |
| `METAON_METAVERSE_URL` | 실제 Metaverse URL 연결 시 사용 |
| `METAON_EXTERNAL_LAUNCH_SECRET` | external launch token 서명 |

## 12. Validation

현재 코드 기준으로 검증한 명령:

```powershell
cd D:\Codex\MetaOn\webapp
npm run build
npm test -- --run
```

검증 결과:

| 항목 | 결과 |
| --- | --- |
| TypeScript/Vite production build | Pass |
| Vitest | Pass |
| Test files | 4 passed |
| Tests | 16 passed |

브라우저에서 확인한 주요 동작:

- `smlee / 1234` 실제 로그인 가능
- `/study`에서 실제 catalog 로딩
- `Speaking Master 1315 Books` 클릭 시 `brand=0` 유지
- `Speaking Master / Small Potaoteos Season 2 / 1월` 선택 상태 유지
- `/study?brand=0&group=15` 직접 진입 시 코스북으로 fallback 되지 않음

## 13. Known Boundaries

현재 구현의 한계는 다음과 같다.

1. Package 다운로드는 아직 ZIP 단위다.
2. ZIP 전체를 받은 뒤에야 unzip이 시작되므로 대용량 Book에서 초기 대기 시간이 크다.
3. JSZip unzip이 브라우저 main thread와 memory에 부담을 줄 수 있다.
4. 파일별 재시도, 부분 다운로드, resume은 아직 구현되어 있지 않다.
5. ZIP 내부 파일 목록을 받기 전에는 Activity별 필요 리소스만 선별 다운로드할 수 없다.
6. Speech/handwriting recognition은 BFF endpoint가 있으나 현재 501 stub이다.
7. Unity native 기능인 pen, AR, camera, OMR, 일부 quiz/game 계열은 웹 대체 설계가 필요하다.
8. Activity별 renderer 품질은 구현된 범위 내에서 동작하며, Unity와 픽셀 동일 수준은 아니다.

## 14. Next Plan - ZIP Download To Web Resource IndexedDB API

다음 단계의 목표는 현재 ZIP 다운로드 방식을 제거하거나 축소하고, Book resource를 웹 리소스 단위로 다운로드하여 IndexedDB에 저장하는 구조로 API를 수정하는 것이다.

### 14.1 Current Problem

현재 구조:

```text
Client
-> GET /api/books/:seriesGroup/:seriesIdx/:bookId/package
-> BFF streams {bookId}.zip
-> Client downloads full ZIP
-> Client unzips all files
-> IndexedDB save
```

문제:

- 전체 ZIP이 필요하므로 첫 실행이 무겁다.
- 특정 Activity만 실행해도 전체 package를 받아야 한다.
- ZIP 다운로드 실패 시 처음부터 다시 받아야 한다.
- 파일별 cache validation이 어렵다.
- IndexedDB에는 결국 파일 단위로 저장하므로 ZIP은 중간 포맷에 가깝다.

### 14.2 Target Flow

목표 구조:

```text
Client
-> GET /api/books/:seriesGroup/:seriesIdx/:bookId/resources/manifest
-> BFF returns resource manifest
-> Client compares manifest with IndexedDB
-> missing/stale files only download
-> each file saved directly to IndexedDB
-> Activity starts when required resources are available
```

### 14.3 Proposed BFF API

신규 또는 변경 API 초안:

| API | 역할 |
| --- | --- |
| `GET /api/books/:seriesGroup/:seriesIdx/:bookId/resources/manifest` | Book 리소스 목록, size, mime, hash/etag, Activity mapping 반환 |
| `GET /api/books/:seriesGroup/:seriesIdx/:bookId/resources/*` | 단일 파일 proxy streaming |
| `POST /api/books/:seriesGroup/:seriesIdx/:bookId/resources/batch` | 여러 파일 URL/metadata 일괄 발급 또는 streaming 계획 반환 |
| `GET /api/books/:seriesGroup/:seriesIdx/:bookId/activity/:dayId/:actNum/resources` | 특정 Activity 실행에 필요한 최소 리소스 목록 반환 |

초기 manifest 예시:

```json
{
  "packageKey": "25:158:smallpotatoes02_01",
  "bookId": "smallpotatoes02_01",
  "version": "2.2.25",
  "baseUrl": "/api/books/25/158/smallpotatoes02_01/resources",
  "files": [
    {
      "path": "Lessons/L1/D1/info_day.json",
      "size": 1234,
      "mimeType": "application/json",
      "etag": "..."
    }
  ],
  "lessonDays": [
    {
      "id": "1:1",
      "activities": [
        {
          "actNum": 0,
          "actType": 67,
          "requiredPaths": [
            "Lessons/L1/D1/info_day.json",
            "Lessons/L1/D1/listening/1/video/listening.mp4"
          ]
        }
      ]
    }
  ]
}
```

### 14.4 Manifest Source Options

리소스 manifest를 만드는 방법은 3가지가 있다.

| 방식 | 설명 | 장점 | 단점 |
| --- | --- | --- | --- |
| 서버에서 ZIP index만 읽기 | BFF가 ZIP 중앙 디렉터리를 읽어 파일 목록 생성 | 기존 CDN ZIP 유지 가능 | 여전히 서버가 ZIP 접근 필요 |
| CDN에 exploded files 배포 | ZIP을 사전에 풀어 S3/CDN에 파일 단위 배포 | 브라우저가 필요한 파일만 받음 | 배포/스토리지 구조 변경 필요 |
| 별도 manifest JSON 생성 | package publish 단계에서 resource manifest 생성 | 가장 안정적 | 원본 콘텐츠 파이프라인 수정 필요 |

권장 방향:

1. 단기: BFF가 기존 ZIP을 이용해 manifest를 생성하고 cache한다.
2. 중기: 자주 쓰는 Book부터 exploded resources를 CDN에 올린다.
3. 장기: 콘텐츠 빌드/배포 단계에서 manifest JSON을 공식 산출물로 만든다.

### 14.5 Client Changes

현재 `bookPackageImporter.ts`를 다음 구조로 분리한다.

| 현재 | 변경 후 |
| --- | --- |
| `downloadAndCacheBookPackage()` | `syncBookResources()` |
| `downloadBookZip()` | `getResourceManifest()`, `downloadResourceFile()` |
| `JSZip.loadAsync()` | 제거 또는 fallback 전용 |
| ZIP entries -> Blob | resource response -> Blob |
| 전체 package 저장 | 필요한 파일부터 점진 저장 |

신규 client service 초안:

- `src\services\resourceManifestImporter.ts`
- `src\services\resourceSync.ts`
- `src\api\resourceApi.ts`

필요 기능:

- manifest fetch
- IndexedDB local manifest 비교
- missing/stale file detection
- parallel download concurrency 제한
- file별 retry
- Activity별 required resource 우선 다운로드
- background prefetch
- ZIP fallback 유지

### 14.6 IndexedDB Schema Changes

현재 DB version은 `1`이다. Resource manifest 구조를 안정적으로 저장하려면 `DB_VERSION = 2` migration이 필요하다.

추가 store 제안:

| Store | Key | 역할 |
| --- | --- | --- |
| `resourceManifests` | `packageKey` | 서버 manifest 원본/정규화본 저장 |
| `resourceFiles` | `{packageKey}::{path}` | 기존 files store 대체 또는 확장 |
| `resourceStatus` | `{packageKey}::{path}` | 다운로드 상태, etag, updatedAt, retry count |

기존 `files` store는 migration 중 유지해서 ZIP 방식 cache와 새 resource 방식 cache가 같이 동작하도록 한다.

### 14.7 Activity Start Policy

Activity 시작 조건도 변경한다.

현재:

```text
Book package 전체 다운로드 완료 -> Activity 목록/Start 활성화
```

변경 후:

```text
Book manifest 확보 -> Activity 목록 표시
Activity별 required resources 확보 -> 해당 Activity Start 활성화
나머지 리소스는 background prefetch
```

화면 정책:

- Book 상세에서 `Download package` 대신 `Prepare resources` 또는 `Download resources` 표시
- Activity 카드별 resource 상태 표시
- 필수 리소스만 먼저 받은 Activity는 바로 실행 가능
- 네트워크 실패 파일은 file 단위 retry
- 전체 Book offline 사용을 위한 `Download all` 옵션 유지

### 14.8 Compatibility Plan

API 전환 중에는 ZIP fallback을 유지한다.

우선순위:

1. `/resources/manifest` 호출
2. manifest가 있으면 파일 단위 다운로드
3. manifest 생성 실패 또는 리소스 파일이 없으면 기존 `/package` ZIP 다운로드 fallback
4. fallback으로 저장된 파일도 같은 IndexedDB path 계약을 사용

이렇게 하면 기존 Activity renderer는 대부분 수정하지 않고 유지할 수 있다. renderer는 이미 IndexedDB path를 기준으로 리소스를 읽기 때문이다.

### 14.9 Test Plan For Resource API

단위 테스트:

- manifest normalize
- IndexedDB DB v1 -> v2 migration
- missing/stale file 계산
- Activity requiredPaths 계산
- ZIP fallback path

통합 테스트:

- `smallpotatoes02_01` manifest 생성
- 특정 Activity resource만 다운로드
- 새로고침 후 IndexedDB cache 재사용
- partial failure 후 retry
- 전체 Book offline download

브라우저 QA:

- StudyZone -> Book 상세 -> resources 준비 -> Activity start
- Listening video resource 단독 다운로드 후 재생
- Word activity image/audio resource 단독 다운로드 후 실행
- Sentence activity JSON/audio 단독 다운로드 후 실행
- IndexedDB 삭제 후 재다운로드

성능 확인:

- ZIP 전체 다운로드 대비 최초 Activity 실행 시간
- IndexedDB 저장량
- 동시 다운로드 수
- 모바일 WebView memory 사용량

## 15. Recommended Next Implementation Order

1. `resource manifest` 타입과 테스트 추가
2. BFF에 `/resources/manifest` endpoint 추가
3. 기존 ZIP 기반 manifest 생성 fallback 구현
4. IndexedDB v2 migration 추가
5. client `resourceSync` service 추가
6. Book 상세의 다운로드 CTA를 resource 방식으로 변경
7. Activity별 required resources 계산 연결
8. ZIP fallback 유지 상태로 browser QA
9. Cloud Run 배포
10. APK WebView에서 cache/download 동작 확인

## 16. Files To Watch

향후 다운로드 API 전환 시 영향이 큰 파일:

| 파일 | 영향 |
| --- | --- |
| `server\index.mjs` | 신규 resource manifest/file proxy API |
| `src\api\uniplanetApi.ts` | ZIP API를 resource API로 분리 |
| `src\services\bookPackageImporter.ts` | ZIP importer를 resource sync로 대체 |
| `src\services\indexedDbStorage.ts` | DB v2 migration, resource metadata 저장 |
| `src\hooks\useBookPackage.ts` | package state를 resource sync state로 확장 |
| `src\pages\HubBookPage.tsx` | 다운로드 CTA 및 Activity별 readiness 표시 |
| `src\pages\ActivityPage.tsx` | Activity 진입 전 required resources 확인 |
| `src\components\activities\PackageActivities.tsx` | renderer path 계약 유지 여부 확인 |
| `src\types\metaonTypes.ts` | resource manifest 타입 추가 가능 |

## 17. Conclusion

현재 MetaOn 웹앱은 실제 로그인, 실제 catalog, Book 선택, ZIP 다운로드, IndexedDB 저장, Activity 실행까지 연결된 웹 네이티브 기반 구현이다. 다음 단계의 핵심은 ZIP 전체 다운로드를 웹 리소스 단위 다운로드로 바꾸는 것이다.

가장 안전한 전환 방식은 기존 ZIP API를 즉시 제거하지 않고, `resource manifest -> file download -> IndexedDB` 경로를 추가한 뒤 실패 시 ZIP fallback으로 내려가는 점진 전환이다. 이렇게 하면 현재 구현된 Activity renderer와 IndexedDB path 계약을 유지하면서 다운로드 성능, 재시도, 부분 실행, 모바일 WebView 안정성을 개선할 수 있다.
