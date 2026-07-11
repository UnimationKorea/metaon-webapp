# MetaOn Web App Implementation 0701

문서 기준: 2026-07-01  
대상 경로: `D:\Codex\MetaOn\webapp`  
배포 서비스: `metaon-webapp` on Cloud Run

## 1. Summary

MetaOn 웹앱은 Unity 프로젝트를 직접 실행하거나 수정하지 않고, `React 18 + Vite + TypeScript` 프론트엔드와 `Node/Express` BFF로 실제 학습 흐름을 웹 네이티브 형태로 재구성한 상태다.

2026-07-01 기준 가장 중요한 변화는 ZIP 다운로드 방식이 더 이상 기본 흐름이 아니라는 점이다. 현재 앱은 MetaOn3 API의 `getMyBrands`, `getBookInfo`를 사용하고, `getBookInfo`가 제공하는 S3 리소스 경로를 브라우저에서 직접 다운로드해 IndexedDB에 저장한다.

현재 핵심 흐름:

1. `/login`에서 실제 MetaOn 계정으로 로그인한다.
2. BFF가 upstream 세션을 HttpOnly signed cookie로 보관한다.
3. `/study`에서 `POST /content/getMyBrands` 기반 catalog를 표시한다.
4. 브랜드 -> 그룹 -> 시리즈 -> Book을 선택한다.
5. `/books/:bookIdx` 진입 시 별도 버튼 없이 리소스를 자동 다운로드한다.
6. BFF는 `POST /content/getBookInfo` 결과를 `BookResourceManifest`로 정규화한다.
7. 클라이언트는 S3 리소스를 직접 다운로드하고 IndexedDB에 저장한다.
8. Activity renderer는 IndexedDB에 저장된 virtual package 경로를 읽어 실행한다.
9. Activity 완료 시 local progress와 study start/end proxy 흐름을 연결한다.
10. Book 상세의 Activity 목록은 큐브형 학습 경로 UI로 표시된다.

## 2. Runtime Stack

| 영역 | 현재 구현 |
| --- | --- |
| Frontend | React 18, Vite, TypeScript, React Router |
| BFF | Express 4, Node 22 |
| API 기준 | MetaOn3 Cloud Run API |
| Catalog API | `POST /content/getMyBrands` |
| Book detail API | `POST /content/getBookInfo` |
| Resource download | Browser direct S3 download |
| Browser cache | IndexedDB `metaon-web-cache` |
| Package source | `metaon3-resources` |
| UI 기준 | `metaon_3` Hub Shell 스타일 |
| Activity 기준 | Unity `ActType` 숫자 계약 유지 |
| Deployment | Dockerfile + Cloud Build + Cloud Run |
| APK | Cloud Run URL을 여는 Android WebView wrapper 구조 |

주요 명령:

```powershell
cd D:\Codex\MetaOn\webapp
npm run dev
npm run build
npm test -- --run
```

로컬 기본 주소:

| Surface | URL |
| --- | --- |
| Vite frontend | `http://127.0.0.1:5173` |
| BFF | `http://127.0.0.1:4100` |
| BFF health | `http://127.0.0.1:4100/api/health` |

## 3. Major Changes Since 0630

0630 문서 이후 실제 구현 상태가 바뀐 핵심 항목은 다음과 같다.

| 항목 | 0630 상태 | 0701 상태 |
| --- | --- | --- |
| Book catalog | legacy `/book/list` 설명 중심 | MetaOn3 `/content/getMyBrands` 중심 |
| Book resource | ZIP package download + JSZip | S3 resource direct download + IndexedDB |
| Book 상세 CTA | `Download Resources` 버튼 | 페이지 진입 시 자동 다운로드 |
| ZIP endpoint | 주요 다운로드 경로 | `410 Gone`, retired |
| Canonical route | legacy series/book route 중심 | `idx` 기반 `/books/:bookIdx`, `/activity/:bookIdx/:dayIdx/:actIdx` |
| Activity 목록 UI | 세로 리스트 또는 하단 펼침 | 큐브형 학습 경로 + 화살표 연결 |
| 완료 상태 | 텍스트/버튼 중심 | 완료 큐브의 배경/테두리/배지 구분 |
| Book 상세 상단 | 큰 hero + 상태 카드 | compact hero + activity-first layout |
| Cloud Run | 가능 구조 | `metaon-webapp-00016-b8f` 배포 완료 |

## 4. Routes

현재 `src\App.tsx` 기준 주요 route는 다음과 같다.

| Route | 역할 |
| --- | --- |
| `/` | MetaOn Hub Home |
| `/login` | 실제 MetaOn 로그인 |
| `/study` | StudyZone |
| `/catalog` | StudyZone alias |
| `/books/:bookIdx` | canonical Book 상세 |
| `/books/:seriesGroup/:seriesIdx/:bookId` | legacy 호환 Book 상세 |
| `/activity/:bookIdx/:dayIdx/:actIdx` | canonical Activity 실행 |
| `/activity/:seriesGroup/:seriesIdx/:bookId/:dayId/:actNum` | legacy 호환 Activity 실행 |
| `/ai-chat` | AI Chat launch |
| `/ai-session` | AI Chat iframe/mock |
| `/chat-history` | local chat history |
| `/metaverse` | Metaverse launch |
| `/metaverse-world` | Metaverse iframe/mock |
| `/profile` | Profile |
| `/profile/edit` | Profile edit |
| `/progress` | 학습 진도 |
| `/notifications` | 알림 |
| `/institution/apply` | 기관 신청 |
| `/institution/status` | 기관 상태 |
| `/access-denied` | 접근 제한 |

Activity route는 Hub Shell의 일반 카드형 화면이 아니라, 기존 Unity landscape 기준에 맞춘 Activity runtime 화면을 유지한다.

## 5. Authentication And Session

현재 인증은 `metaon_3` mock auth가 아니라 실제 MetaOn3 로그인/BFF cookie 방식이다.

주요 파일:

- `src\hooks\useAuth.tsx`
- `src\api\uniplanetApi.ts`
- `server\index.mjs`

주요 API:

| API | 역할 |
| --- | --- |
| `GET /api/auth/me` | 현재 BFF auth cookie 확인 |
| `POST /api/auth/login` | `/user/login` proxy, HttpOnly auth cookie 발급 |
| `POST /api/auth/session` | 기존 `Session-Id` 또는 `JSESSIONID` 수동 주입/검증 |
| `POST /api/auth/logout` | auth cookie 삭제, catalog cache clear |

클라이언트는 보조적으로 다음 localStorage 값을 관리한다.

- `metaon-web-client-id`
- `metaon-session-id`
- `metaon-user-idx`

BFF의 실제 인증 권한은 signed HttpOnly cookie가 기준이다. Cloud Run에서는 `METAON_AUTH_COOKIE_SECRET`을 Secret Manager secret `metaon-auth-cookie-secret`에서 가져오도록 구성되어 있다.

## 6. BFF API Surface

현재 `server\index.mjs` 기준 주요 API는 다음과 같다.

| API | 현재 역할 |
| --- | --- |
| `GET /api/health` | BFF runtime/env 상태 확인 |
| `GET /api/auth/me` | 현재 인증 상태 |
| `POST /api/auth/login` | MetaOn3 login proxy |
| `POST /api/auth/session` | 수동 session 검증 |
| `POST /api/auth/logout` | logout |
| `GET /api/books` | `getMyBrands` proxy/normalize |
| `GET /api/books/:bookIdx/resource-manifest` | `getBookInfo` proxy/normalize |
| `GET /api/packages` | retired, `410 Gone` |
| `GET /api/books/:seriesGroup/:seriesIdx/:bookId/package` | retired, `410 Gone` |
| `GET /api/books/:seriesGroup/:seriesIdx/:bookId/thumbnail` | legacy thumbnail proxy |
| `GET /api/books/:seriesGroup/:seriesIdx/:bookId/info` | legacy package metadata proxy |
| `POST /api/study/start` | `/study/start` proxy |
| `POST /api/study/end` | `/study/end` proxy |
| `POST /api/study/quiz-accept` | `/study/quizaccept` proxy |
| `POST /api/study/quick-check` | `/study/getquickcheckquiz` proxy |
| `POST /api/external/launch` | AI/Metaverse launch token 생성 |
| `POST /api/recognition/speech` | 현재 501 stub |
| `POST /api/recognition/handwriting` | 현재 501 stub |

기본 upstream/env:

| Env | 현재 값 또는 기본값 |
| --- | --- |
| `METAON_API_ORIGIN` | `https://metaon3-0-609870547235.asia-northeast3.run.app` |
| `METAON_CDN_ORIGIN` | `https://metaon.s3.ap-northeast-2.amazonaws.com` |
| `METAON_BOOKDATA_BASE` | `{METAON_CDN_ORIGIN}/MetaOn3/BookData` |
| `METAON_APP_IDX` | `2` |
| `METAON_APP_VERSION` | `2.2.25` |
| `METAON_PLATFORM` | `Android` |
| `METAON_AUTH_COOKIE_SECURE` | Cloud Run에서 `1` |

## 7. Catalog And StudyZone

`GET /api/books`는 내부적으로 `POST /content/getMyBrands`를 호출하고, 응답을 다음 UI 모델로 정규화한다.

- `BrandData`
- `SeriesGroup`
- `SeriesData`
- `BookData`
- `BookCatalog`

현재 StudyZone 구조:

- 브랜드 탭
- 그룹 chip row
- 시리즈 chip row
- Book grid
- 우측 progress/AI/Metaverse launcher
- 모바일/APK 하단 navigation

처리된 주요 이슈:

- 7개 브랜드 catalog 구조 대응
- `Raz-Kids(RHK)`, `하이마이스쿨`, `PlayNLearn Academy`, `First Readers(RHK)` 등 brand 내부 group 복원
- `Speaking Master`처럼 `brandId: 0`인 항목을 유효 brand로 처리
- Book thumbnail은 실제 `thumb_url` 또는 정규화된 S3 URL을 우선 사용
- Book 카드 thumbnail은 정사각형 기반으로 표시하고 title은 overlay 방식으로 표현

## 8. Home And Hub Shell

현재 앱 Shell은 `metaon_3` 스타일을 기준으로 구성되어 있다.

주요 파일:

- `src\components\MetaOnHubShell.tsx`
- `src\pages\HubHomePage.tsx`
- `src\pages\StudyZonePage.tsx`
- `src\styles-hub.css`

현재 UI 구조:

- 데스크톱: 좌측 nav
- 모바일/APK: 하단 5개 nav
- 메뉴: `홈`, `스터디존`, `AI 채팅`, `메타버스`, `프로필`
- 상단 search/profile/notification 영역
- Home은 최신/선택 Book과 학습 진입 CTA를 보여주는 Hub layout

이전 Unity식 Home carousel 요구는 MetaOn3 Hub 병합 이후 brand 기반 StudyZone 진입과 Hub 카드 구조로 통합된 상태다.

## 9. Resource Download And IndexedDB

현재 ZIP 다운로드는 기본 학습 흐름에서 제거됐다. `GET /api/packages`와 legacy ZIP package endpoint는 `410 Gone`으로 응답한다.

현재 resource flow:

```text
BookData
-> GET /api/books/:bookIdx/resource-manifest
-> BFF calls POST /content/getBookInfo
-> BFF normalizes BookResourceManifest
-> Client downloads each S3 resource directly
-> Client generates synthetic package JSON files
-> IndexedDB packages/files stores save metadata and blobs
-> Activity renderer reads virtual package paths
```

주요 파일:

- `src\hooks\useBookPackage.ts`
- `src\services\bookPackageImporter.ts`
- `src\services\metaon3ResourceAdapter.ts`
- `src\services\indexedDbStorage.ts`
- `src\services\packageKeys.ts`
- `src\api\uniplanetApi.ts`

IndexedDB:

| Store | 역할 |
| --- | --- |
| `packages` | `BookPackage` metadata 저장 |
| `files` | resource Blob 저장 |

Package key:

```text
book:{bookIdx}
```

Resource URL:

```text
https://metaon.s3.ap-northeast-2.amazonaws.com/MetaOn3/BookData/{api-relative-path}
```

Virtual path 생성:

| API resource | Virtual package path |
| --- | --- |
| `word` JSON | `Lessons/L{lesson}/D{day}/word/info_word.json` |
| word image | `Lessons/L{lesson}/D{day}/word/img/word_XX.png` |
| word sound | `Lessons/L{lesson}/D{day}/word/snd/snd_word_XX.mp3` |
| `sentence` JSON | `Lessons/L{lesson}/D{day}/sentence/info_sentence.json` |
| sentence sound | `Lessons/L{lesson}/D{day}/sentence/snd/snd_sentence_XX.mp3` |
| reading image | `Lessons/L{lesson}/D{day}/reading/01/img/img_XX.png` |
| reading sound | `Lessons/L{lesson}/D{day}/reading/01/snd/snd_XX_01.mp3` |
| listening video | `Lessons/L{lesson}/D{day}/listening/01/video/video_XX.mp4` |

## 10. Book Detail Page

현재 Book 상세는 resource-first 학습 진입 화면이다.

주요 파일:

- `src\pages\HubBookPage.tsx`
- `src\styles-hub.css`

현재 동작:

1. `/books/:bookIdx` 진입
2. IndexedDB cache 확인
3. cache가 없으면 자동으로 resource download 시작
4. 완료 후 Activity 목록 표시
5. `Start` 버튼 또는 개별 Activity 큐브 클릭으로 Activity 진입

최근 UI 변경:

- 별도 `Download Resources` 버튼 제거
- 상단 Book hero compact 처리
- 기존 3개 상태 카드 제거
- `files / days / acts` 정보를 작은 pill로 hero 내부 표시
- resource 완료 상태에서는 progress bar 숨김
- Activity 목록을 큐브형 학습 경로로 표시
- 큐브 사이를 화살표로 연결
- 완료된 Activity 큐브는 초록 border/background/status badge로 구분
- 미완료 Activity 큐브는 `대기` badge 표시
- 모바일에서는 세로 큐브 흐름과 아래 방향 화살표로 표시

검증된 대표 화면:

- `http://127.0.0.1:5173/books/6712`
- Book: `Mom`
- 리소스: 46 files
- Activity: 10 acts
- 완료 상태 예: `1/10 완료`

## 11. Activity Runtime

Activity 실행 화면은 기존 1280x720 Unity landscape 기준을 유지한다.

주요 파일:

- `src\pages\ActivityPage.tsx`
- `src\components\ActivityTopBar.tsx`
- `src\components\activities\PackageActivities.tsx`
- `src\services\activityRegistry.tsx`
- `src\services\actTypeCatalog.ts`
- `src\services\activityBackgrounds.ts`
- `src\types\metaonTypes.ts`

현재 canonical route:

```text
/activity/:bookIdx/:dayIdx/:actIdx
```

legacy route도 유지:

```text
/activity/:seriesGroup/:seriesIdx/:bookId/:dayId/:actNum
```

Activity 시작/완료 흐름:

```text
ActivityPage mount
-> POST /api/study/start { act_idx }
-> renderer.render()
-> user clicks 완료
-> POST /api/study/end { log_idx }
-> local completeActivity(bookKey, activity.id)
-> notification 생성
-> Book page complete cube 표시
```

현재 Activity 화면의 상단 title bar는 제거/축소 방향으로 정리되어 있고, 콘텐츠 영역을 우선 표시한다. Listening 계열은 video player가 큰 영역을 차지하도록 조정되어 있다.

## 12. ActType And Renderer Status

`src\types\metaonTypes.ts`의 `ActType`은 Unity 숫자 계약을 유지하며, MetaOn 전용 타입명으로 `metaonTypes.ts`에 정리되어 있다.

현재 `activityRegistry.tsx`에서 구체 renderer로 연결된 주요 ActType:

| ActType | Label | Renderer 방향 |
| --- | --- | --- |
| `67` | Listening | HTML video/listening renderer |
| `66` | Reading | reading image/audio renderer |
| `16` | Ebook | cached book page renderer |
| `17`, `26`, `117`, `1017` | Flash Card | image/audio card flip renderer |
| `4`, `1004` | Voca Quiz / Word Check | random choice word quiz |
| `5`, `1005` | Voca Check / Word Blank | word blank renderer |
| `6`, `1006` | Sentence Blank | sentence blank renderer |
| `7`, `1007` | Sentence Unscramble | shuffled sentence token renderer |
| `8` | Matching Game | word image/text matching |
| `15` | Memory Game | paired memory cards |
| `27`, `53` | Word Puzzle | scrambled letter selection |
| `28` | Word Search | generated word search grid |
| `32`, `1032` | Listen/Word Record | browser MediaRecorder |
| `9`, `1009` | Sentence Record | sentence audio + recorder |
| `48` | Write Word | word input renderer |
| `57` | Read & Flip | `read_n_flip` JSON renderer |
| `65` | Quick Check | quick-check API proxy + quiz accept |
| `1201` | Story Check | reading quiz JSON renderer |
| `1501` | Sequencing | reading sequence JSON renderer |

Planned/web-replacement 상태도 `actTypeCatalog.ts`에 유지된다. 따라서 미구현 ActType도 unknown으로 사라지지 않고 catalog/renderer fallback에서 식별 가능하다.

## 13. Activity Resource Mapping Basis

각 Activity가 어떤 리소스를 쓰는지는 다음 기준으로 판단한다.

1. `actTypeCatalog.ts`의 category/status/webStrategy
2. `activityRegistry.tsx`의 renderer mapping
3. `PackageActivities.tsx` 내부 hook 호출
4. `metaon3ResourceAdapter.ts`가 생성한 virtual package path

대표 mapping:

| Renderer | 내부 hook | 참조 리소스 |
| --- | --- | --- |
| `FlashCardActivity` | `useWords(context)` | word image/audio/info_word |
| `VocaQuizActivity` | `useWords(context)` | word list + randomized choices |
| `WordBlankActivity` | `useWords(context)` | word list + blank question |
| `MemoryGameActivity` | `useWords(context)` | word image/text pairs |
| `MatchingGameActivity` | `useWords(context)` | word image/text/audio |
| `SentenceBlankActivity` | `useSentences(context)`, `useWords(context)` | sentence audio/text + word distractors |
| `SentenceUnscrambleActivity` | `useSentences(context)` | sentence slice/token data |
| `ReadingActivity` | `useReadingAssets(context)` | reading image/audio |
| `ListeningActivity` | video asset lookup | listening MP4 |
| `ListenRecordActivity` | `useWords(context)` + recorder | word audio + MediaRecorder |
| `SentenceRecordActivity` | `useSentences(context)` + recorder | sentence audio + MediaRecorder |
| `QuickCheckActivity` | `getQuickCheckQuiz()` | study quick-check API |

이 내용의 spreadsheet 근거 파일은 기존 산출물로 남아 있다.

- `activity_resource_mapping.xlsx`
- `activity_resource_mapping_0629.xlsx`

## 14. Progress, Completion, Notifications

학습 진행 상태는 현재 client-local persistence로 관리된다.

주요 파일:

- `src\hooks\useHubState.tsx`
- `src\pages\ActivityPage.tsx`
- `src\pages\HubBookPage.tsx`
- `src\pages\ProfilePages.tsx`

LocalStorage keys:

- `metaon.hub.profile`
- `metaon.hub.notifications`
- `metaon.hub.progress`
- `metaon.hub.institutionApplication`

Progress model:

```ts
type HubProgress = {
  bookKey: string;
  completedActivityIds: string[];
  updatedAt: string;
};
```

Book page는 `completedActivityIds.includes(activity.id)`로 완료 큐브를 판별한다.

## 15. External AI / Metaverse

AI Chat과 Metaverse는 `metaon_3` 스타일의 external launch UX를 유지한다.

주요 파일:

- `src\pages\ExternalPages.tsx`
- `src\api\externalLaunch.ts`
- `server\index.mjs`

BFF endpoint:

```text
POST /api/external/launch
```

입력:

- `kind`
- `bookIdx`
- `bookId`
- `seriesGroup`
- `seriesIdx`
- `lastActivityId`

출력:

- `iframeUrl`
- `launchToken`
- `expiresAt`
- `isMock`

환경 변수:

- `METAON_AI_CHAT_URL`
- `METAON_METAVERSE_URL`
- `METAON_EXTERNAL_LAUNCH_SECRET`

외부 URL이 없으면 mock iframe UX로 동작한다.

## 16. Cloud Run Deployment

현재 배포 상태:

| 항목 | 값 |
| --- | --- |
| GCP project | `gen-lang-client-0309121556` |
| Region | `asia-northeast3` |
| Service | `metaon-webapp` |
| Latest ready revision | `metaon-webapp-00016-b8f` |
| Traffic | 100% to latest revision |
| Public URL | `https://metaon-webapp-geaypbs2uq-du.a.run.app` |
| Alternate URL | `https://metaon-webapp-441722815895.asia-northeast3.run.app` |
| Image | `asia-northeast3-docker.pkg.dev/gen-lang-client-0309121556/metaon/metaon-webapp:20260701-compact-activity-cubes` |
| Cloud Build ID | `c35f30d7-8dc8-4927-a21a-92b5e19f4694` |

Cloud Run env:

| Env | 값 |
| --- | --- |
| `METAON_API_ORIGIN` | `https://metaon3-0-609870547235.asia-northeast3.run.app` |
| `METAON_CDN_ORIGIN` | `https://metaon.s3.ap-northeast-2.amazonaws.com` |
| `METAON_APP_IDX` | `2` |
| `METAON_APP_VERSION` | `2.2.25` |
| `METAON_PLATFORM` | `Android` |
| `METAON_USER_IDX` | `0` |
| `METAON_AUTH_COOKIE_SECURE` | `1` |
| `METAON_AUTH_COOKIE_SECRET` | Secret Manager `metaon-auth-cookie-secret:latest` |

배포 검증:

```text
GET /api/health -> 200
GET / -> 200
deployed CSS contains hub-book-hero.is-compact
deployed CSS contains hub-book-mini-stats
deployed CSS contains hub-button-row.compact
```

## 17. Validation Status

최근 확인된 검증:

| 검증 | 결과 |
| --- | --- |
| `npm test -- --run` | 5 test files, 18 tests passed |
| `npm run build` | passed |
| Cloud Build `npm run build` | passed |
| Local `/books/6712` desktop QA | compact hero + cube flow 확인 |
| Local `/books/6712` mobile 430x760 QA | no horizontal overflow, cube visible |
| Cloud Run `/api/health` | 200 |
| Cloud Run root HTML | 200 |

테스트 파일:

- `src\api\catalogNormalizer.test.ts`
- `src\services\metaon3ResourceAdapter.test.ts`
- `src\services\activityRegistry.test.tsx`
- `src\services\hubCatalog.test.ts`
- `src\utils\catalogLookup.test.ts`

## 18. APK Status

현재 APK는 별도 네이티브 기능을 추가 구현하는 형태가 아니라, Cloud Run URL을 여는 Android WebView wrapper 구조로 유지하는 방향이다.

따라서 다음 조건이면 웹 UI 수정은 APK 재빌드 없이 반영 가능하다.

- APK 시작 URL이 기존 Cloud Run `metaon-webapp` URL 그대로임
- Android native permission 또는 WebView setting 변경이 없음
- 앱 캐시가 오래된 asset을 붙잡지 않음

확인 방법:

1. APK에서 앱 reload 또는 앱 재시작
2. `/books/:bookIdx` 진입
3. compact Book header와 Activity 큐브 UI가 보이는지 확인

재빌드가 필요한 경우:

- 시작 URL 변경
- WebView permission 변경
- file chooser/camera/microphone native bridge 변경
- Android manifest 또는 wrapper 코드 변경

## 19. Known Limitations

현재 남아있는 제한:

- 모든 Unity ActType이 pixel-perfect로 포팅된 것은 아니다.
- 일부 ActType은 `planned`, `compatible-renderer`, `web-replacement` 상태다.
- Speech/handwriting recognition endpoint는 아직 501 stub이다.
- Profile/Notifications/Institution/Progress는 대부분 client-local persistence 기반이다.
- Quick Check는 API proxy가 붙었지만 모든 quiz type의 Unity UI parity는 추가 검증이 필요하다.
- S3 resource download는 브라우저 직접 접근을 전제로 하므로 S3 CORS/권한 변경 시 영향이 있다.
- Resource lazy download는 아직 Book 단위 전체 다운로드 이후 최적화 대상으로 남아 있다.
- 실제 API schema가 바뀌면 `catalogNormalizer.ts`와 `metaon3ResourceAdapter.ts`를 먼저 점검해야 한다.

## 20. Next Steps

우선순위가 높은 후속 작업:

1. 대표 Book별 resource download/Activity 실행 회귀 테스트 세트 작성
2. Quick Check quiz type별 renderer 보강
3. Speech/handwriting recognition BFF port 구현
4. Activity별 lazy resource download 최적화
5. Progress/Notification 실제 서버 저장 API 연결
6. APK WebView에서 IndexedDB persistence, video playback, microphone permission 확인
7. 미구현 ActType별 planned/web-replacement 우선순위 재정렬

## 21. Key Files

| 파일 | 역할 |
| --- | --- |
| `src\App.tsx` | route 정의 |
| `src\components\MetaOnHubShell.tsx` | Hub shell/nav |
| `src\pages\LoginPage.tsx` | 실제 로그인 화면 |
| `src\pages\StudyZonePage.tsx` | 브랜드/그룹/시리즈/Book 선택 |
| `src\pages\HubBookPage.tsx` | Book 상세, 자동 resource download, Activity cube flow |
| `src\pages\ActivityPage.tsx` | Activity runtime |
| `src\components\activities\PackageActivities.tsx` | Activity renderer 구현 |
| `src\services\activityRegistry.tsx` | ActType -> renderer mapping |
| `src\services\actTypeCatalog.ts` | ActType catalog/status/strategy |
| `src\types\metaonTypes.ts` | MetaOn/Activity 타입 |
| `src\api\catalogNormalizer.ts` | getMyBrands/catalog 정규화 |
| `src\services\metaon3ResourceAdapter.ts` | getBookInfo -> manifest/resource 정규화 |
| `src\services\bookPackageImporter.ts` | S3 resource download + IndexedDB 저장 |
| `src\services\indexedDbStorage.ts` | IndexedDB adapter |
| `src\hooks\useBookPackage.ts` | resource package state hook |
| `src\hooks\useHubState.tsx` | local progress/profile/notification state |
| `server\index.mjs` | BFF/auth/API proxy/static server |
| `Dockerfile` | Cloud Run image build |

