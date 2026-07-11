# Uniplanet Web Native 개발 요약

작성일: 2026-06-25

## 목적

Unity로 제작된 영어학습 앱 Uniplanet을 웹에서 실행 가능한 네이티브 웹앱으로 리팩토링했다. 최종 방향은 Unity WebGL 런타임 전환이 아니라 `React + Vite + TypeScript` 클라이언트와 `Node/Express` BFF로 기존 학습 흐름과 콘텐츠 패키지 실행을 재구현하는 것이다.

## 개발 방향

- Unity 프로젝트 원본은 유지하고 새 웹앱은 `webapp/`에 분리했다.
- 기존 API와 CDN의 CORS 제약은 브라우저에서 직접 호출하지 않고 BFF 프록시가 흡수하도록 했다.
- ZIP 콘텐츠 패키지는 BFF를 통해 다운로드하고, 클라이언트에서 `JSZip`으로 해제한 뒤 `IndexedDB`에 캐시한다.
- Unity `Act_Type` 숫자 계약은 웹 타입으로 유지해 기존 책/학습 데이터와 연결했다.
- 목표 UI는 새 디자인이 아니라 Unity 앱의 화면 구성과 학습 흐름을 웹 방식으로 재현하는 것으로 잡았다.

## 주요 구현 내용

### 앱 기반

- `webapp/`에 Vite React 앱과 Express BFF를 구축했다.
- 주요 실행 명령은 `npm run dev`, `npm run build`, `npm run test`, `npm start`다.
- BFF는 `/api/books`, `/api/books/:seriesGroup/:seriesIdx/:bookId/package`, `/api/study/start`, `/api/study/end`, `/api/study/quiz-accept`를 제공한다.
- 카탈로그 응답은 `sgrouplist` 기반으로 웹 카탈로그 모델에 맞춰 정규화한다.
- 패키지 메타데이터, 파일 목록, Activity/Day 정보는 ZIP 내부 파일 구조에서 파생한다.

### 화면과 콘텐츠

- 홈 화면을 추가하고 메뉴 캐러셀을 구현했다.
- Speaking I, Speaking II, Raz-Kids Grade 계열 메뉴를 카탈로그 기반으로 확장했다.
- 책 목록에는 모든 Book 썸네일 이미지를 정사각형 카드로 표시하고, Book title은 하단 오버레이로 표현했다.
- 좌측 메뉴는 줄바꿈이 생기지 않도록 폰트 크기와 레이아웃을 조정했다.
- Unity 앱의 배경 이미지를 Activity 화면에 반영하고, Activity별 배경 전환 구조를 추가했다.
- Activity 화면은 1280x720 기준으로 동작하도록 스테이지/전체화면 구조를 맞췄다.

### 패키지 다운로드와 실행

- `Download package` 후 ZIP을 BFF에서 받아오고 클라이언트에서 압축 해제한다.
- 해제된 파일은 `IndexedDB`에 저장해 새로고침 후에도 재사용한다.
- `Start activity`는 캐시된 패키지 메타데이터를 기반으로 `/activity/:seriesGroup/:seriesIdx/:bookId/:dayId/:actNum` 경로를 연다.
- 예시 검증 책은 `G2LI01`, `A Broken Leg for Bonk`, Lesson 1 Day 1 흐름을 중심으로 진행했다.

## Activity 포팅 상태

현재 `activityRegistry.tsx`에서 Unity Act Type을 웹 렌더러에 매핑한다.

대표 구현 렌더러:

- Reading
- Listening
- Ebook / BookPage
- Movie
- Voca Quiz / Word Choice
- Word Card / Flash Card
- Word Blank
- Matching Game
- Memory Game
- Spelling / Write Quiz
- Word Puzzle
- Word Search
- Peeling Word
- Sentence Blank
- Sentence Unscramble
- Listen & Record
- Sentence Record
- Story Check
- Read & Flip
- Sequencing

완전 별도 구현이 어려운 일부 Unity 전용/네이티브 기능은 호환 렌더러 또는 Pending 화면으로 분리했다. 예를 들어 외부 SDK, AR, Android 권한, 일부 특수 게임성 Activity는 웹 기능으로 대체하거나 후속 구현 대상이다.

## 최근 수정된 Activity 동작

- Activity 1 Listen은 우측 텍스트 패널을 제거하고 비디오 플레이어가 콘텐츠 영역 전체를 차지하도록 변경했다.
- 모든 Activity 내부의 `Activity N / 타이틀` 행을 제거했다.
- ActivityTopBar 아래의 남은 영역을 콘텐츠가 더 크게 사용하도록 공통 프레임 높이와 그리드 스타일을 조정했다.
- Activity 3 Word Card는 중앙 이미지 카드 형태로 변경했다. 클릭하면 오디오 재생을 시도하고 카드가 플립되어 단어 텍스트가 보인다.
- Activity 7 Word Blank는 단어 일부 문자를 비우고 선택지에서 정답 글자를 고르는 방식으로 수정했다.
- Word Quiz, Memory Card, Word Blank 등 선택형 Activity는 선택지/카드가 랜덤 배치되도록 수정했다.
- Sentence Blank와 Sentence Unscramble은 문장 데이터 기반으로 동작하도록 검토 및 수정했다.
- Read Activity는 패키지의 reading 이미지/오디오/스크립트 데이터를 이용해 실행되도록 검토했다.

## 주요 파일

- `webapp/server/index.mjs`: Express BFF, API/패키지 프록시, 정적 배포 서버
- `webapp/src/api/catalogNormalizer.ts`: 카탈로그 응답 정규화
- `webapp/src/services/bookPackageImporter.ts`: ZIP 다운로드, 해제, 메타데이터 파생, IndexedDB 저장
- `webapp/src/services/indexedDbStorage.ts`: 패키지 파일 캐시
- `webapp/src/services/activityRegistry.tsx`: Act Type별 렌더러 매핑
- `webapp/src/components/activities/PackageActivities.tsx`: Activity 렌더러 구현
- `webapp/src/pages/HomePage.tsx`: 홈 캐러셀
- `webapp/src/pages/CatalogPage.tsx`: 메뉴/시리즈/책 목록
- `webapp/src/pages/BookPage.tsx`: 책 상세, 패키지 다운로드, Activity 시작
- `webapp/src/pages/ActivityPage.tsx`: Activity 실행 화면
- `webapp/src/styles.css`: 1280x720 스테이지, Unity 스타일, Activity 레이아웃

## 검증 내역

로컬 검증:

```powershell
cd D:\Codex\Uniplayer-RazKids\webapp
npm run build
npm run test
```

결과:

- `npm run build` 통과
- `npm run test` 통과
- Vitest 테스트 파일 2개, 테스트 5개 통과
- 1280x720 기준에서 Listen과 Word Card 화면의 내부 Activity 타이틀 행이 제거된 것을 브라우저로 확인
- Word Card 클릭 후 `.flipped` 상태 전환 확인

대표 로컬 경로:

- `http://127.0.0.1:5175/activity/7/17/G2LI01/1:1/0`
- `http://127.0.0.1:5175/activity/7/17/G2LI01/1:1/2`

## Cloud Run 배포

현재 배포 서비스:

- Service: `uniplanet-webapp`
- Region: `asia-northeast3`
- Project: `gen-lang-client-0309121556`
- URL: `https://uniplanet-webapp-geaypbs2uq-du.a.run.app`
- Latest ready revision: `uniplanet-webapp-00006-hnt`
- Image: `asia-northeast3-docker.pkg.dev/gen-lang-client-0309121556/uniplanet/uniplanet-webapp:20260625-152300`

환경 변수:

- `UNIPLANET_APP_IDX=3`
- `UNIPLANET_APP_VERSION=1.0.5`
- `UNIPLANET_PLATFORM=Android`
- `UNIPLANET_API_ORIGIN=http://uniplanet.co.kr:28080`
- `UNIPLANET_CDN_ORIGIN=https://cdn.unimation.co.kr`

헬스 체크:

```powershell
Invoke-WebRequest -UseBasicParsing https://uniplanet-webapp-geaypbs2uq-du.a.run.app/api/health
```

응답은 `ok: true`로 확인했다.

## 남은 과제

- 전체 Unity Activity를 픽셀 단위로 동일하게 재현하려면 각 Act Type별 원본 prefab/scene 동작 분석이 더 필요하다.
- 현재 일부 Act Type은 호환 렌더러로 동작하므로, Unity 원본과 동일한 세부 게임 규칙/애니메이션은 후속 포팅 대상이다.
- Google 음성/필기 인식은 서버 인증 정보가 준비된 뒤 BFF에서 실제 연동해야 한다.
- 여러 Book/Grade/Day 조합에서 패키지 구조 차이를 더 수집해 렌더러별 예외 처리를 늘려야 한다.
- Safari/iPad, Android Chrome, 데스크톱 Chrome에서 미디어 자동재생, 녹음 권한, IndexedDB 용량 정책을 별도 QA해야 한다.

## 인계 메모

- ZIP 다운로드와 Activity 실행은 이 웹앱의 핵심 흐름이므로, 후속 변경 시 `bookPackageImporter.ts`, `indexedDbStorage.ts`, `ActivityPage.tsx`, `PackageActivities.tsx`를 우선 확인한다.
- UI 변경은 1280x720 기준 스테이지에서 먼저 검증하고, 그 다음 태블릿/데스크톱 브라우저를 확인한다.
- Cloud Run 배포 전에는 반드시 `npm run build`와 `npm run test`를 통과시킨다.
- Unity 원본 프로젝트는 직접 수정하지 않고, 필요한 계약과 리소스만 웹앱에서 참조하는 방향을 유지한다.
