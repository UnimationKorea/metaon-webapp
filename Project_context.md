# MetaOn Webapp 프로젝트 문맥

> 기준일: 2026-08-13 KST  
> 범위: `D:\Codex\MetaOn\webapp`만 포함

## 시스템 요약

MetaOn Webapp은 React/Vite 프런트엔드와 Express BFF로 구성된 영어 학습 서비스다. 사용자는 로그인과 프로필 선택 후 브랜드/그룹/시리즈/Book을 탐색하고, Book 리소스를 S3에서 내려받아 Activity를 실행한다.

```text
브라우저/태블릿 WebView
  -> React UI
  -> /api BFF
  -> MetaOn3 API

S3 리소스
  -> IndexedDB의 Book package/file Blob
  -> Cache Storage/Service Worker의 미디어 보조 캐시
  -> Activity renderer
```

## 현재 기준

| 항목 | 값 |
|---|---|
| 인수인계 기준 | Webapp 전용 독립 Git 번들의 `main` |
| Cloud Run 서비스 | `metaon-webapp` |
| 서비스 주소 | `https://metaon-webapp-geaypbs2uq-du.a.run.app` |
| 기본 개발 포트 | SPA `5173`, BFF `4100` |
| 데이터 기본 저장소 | IndexedDB `metaon-web-cache` |
| 미디어 보조 캐시 | Cache Storage + `metaon-media-sw.js` |

## 구조 경계

- 프런트엔드는 인증 토큰이나 업스트림 session을 저장/전달하지 않고 BFF만 호출한다.
- BFF는 로그인, 프로필, Book API, Study API, LearnEvent API, 필기 인식, 외부 launch 요청을 중계·정규화한다.
- IndexedDB는 Book 리소스의 기본 오프라인/재사용 저장소다.
- Service Worker는 이미지·음성·영상의 재생 지연을 줄이는 보조 계층이다.
- Activity renderer는 resource manifest와 package path를 통해 리소스를 읽는다.

## Activity 코드 기준

`activity_code`가 renderer 선택의 1순위다. 수치형 ActType은 기존 데이터의 fallback으로만 사용한다.

| 분류 | 코드 |
|---|---|
| ebook | `EBOOK01` |
| Word Card | `WDCA01`, `WDCA02` |
| Word Quiz | `WDQU01`, `WDQU02`, `WDQU03` |
| Word Blank | `WDBL01`, `WDBL02` |
| Write Word | `WDWR01`, `WDWR02` |
| Matching/Memory | `WDPL01`, `WDPL02` |
| Sentence | `STBL01`, `STBL02`, `STSC01`, `STSC02`, `STRC01`, `STRC02` |
| Movie | `MOVIE01` |
| Quick Check | `QCHK01`, `NPCQHK01`, `NPCQHK02` |

## 가장 중요한 모듈

| 경로 | 설명 |
|---|---|
| `src/services/activityCodes.ts` | Activity 코드와 표시 정보 |
| `src/services/activityRegistry.tsx` | renderer 선택 |
| `src/components/activities/PackageActivities.tsx` | 다수의 Activity renderer |
| `src/services/bookPackageImporter.ts` | S3 리소스 다운로드와 IndexedDB 저장 |
| `src/services/metaon3ResourceAdapter.ts` | Book API 정규화 |
| `src/services/learnEventRecorder.ts` | LearnEvent 생성/전송 |
| `src/services/learnEventOutbox.ts` | 이벤트 재전송용 IndexedDB Outbox |
| `src/pages/ActivityPage.tsx` | Activity route와 공통 로더 |
| `server/index.mjs` | Express BFF |
| `shared/quickCheckScoring.mjs` | Quick Check 공통 채점 |
| `NPC_QUICK_CHECK_HANDOFF.md` | NPCQHK01/02 리소스, iframe, 개인화, 운영 계약 |

## 다음 우선순위

1. LearnEvent 서버 응답의 멱등/부분 성공 계약 확정 및 실제 서버 검증
2. NPCQHK02의 개인화 문항 API 연결
3. Book 버전 변경, 프로필 전환, 로그아웃 시 로컬 캐시 정합성 테스트
4. 태블릿 WebView에서 Service Worker/영상 Range/전체 화면 UX 확인
5. 새 Activity 추가 시 리소스·renderer·이벤트·skill·테스트 동시 반영

## 실행

```powershell
Set-Location D:\Codex\MetaOn\webapp
npm ci
Copy-Item .env.example .env.local
npm run dev
```

변경 후 검증 명령:

```powershell
npm test -- --run
npm run build
```

상세 인수인계 절차와 배포 환경 변수는 `CODEX_HANDOFF.md`를 확인한다.
