# MetaOn E-book Resource API Backend Handoff

작성일: 2026-07-06

## 목적

MetaOn 웹앱의 Listening Activity(Type 67)를 기존 MP4 중심 화면에서 RHK Read-Along 형태의 E-book viewer로 대체하기 위해, E-book 리소스를 기존 Book resource 다운로드 구조에 포함시키는 API 수정안을 정리한다.

핵심 방향은 다음과 같다.

- 기존 `GET /api/books/:bookIdx/resource-manifest` 구조를 유지한다.
- ZIP 다운로드 방식은 사용하지 않는다.
- E-book 이미지, 오디오, JSON 리소스를 다른 Activity 리소스와 동일하게 manifest에 포함한다.
- 클라이언트는 `resources[]`를 다운로드하고 `generatedFiles[]`를 생성 파일로 저장하여 IndexedDB에서 읽는다.
- Type 67 Activity는 `info_listen_ebook.json`을 읽고, 그 안의 `entryPath`가 가리키는 E-book `book.json`을 IndexedDB에서 불러와 viewer에 전달한다.

## 현재 API 구조

현재 BFF는 아래 endpoint를 사용한다.

```http
GET /api/books/:bookIdx/resource-manifest
```

현재 서버 흐름:

1. BFF가 upstream `POST /content/getBookInfo`에 `{ book_idx }`를 전달한다.
2. BFF가 응답을 `BookResourceManifest` 형태로 정규화한다.
3. 클라이언트가 manifest의 `resources[]`를 웹에서 다운로드한다.
4. 클라이언트가 `generatedFiles[]`와 다운로드한 파일을 IndexedDB에 저장한다.

현재 manifest 기본 구조:

```ts
type BookResourceManifest = {
  key: string; // usually "book:{bookIdx}"
  book: BookData;
  progress?: {
    actTotal: number;
    actDone: number;
  };
  lessonDays: LessonDay[];
  resources: BookResource[];
  generatedFiles: GeneratedPackageFile[];
  raw?: unknown;
};

type BookResource = {
  path: string;       // IndexedDB virtual path
  sourcePath: string; // original upstream or S3 path
  url: string;        // browser-downloadable URL
  mimeType: string;
  size?: number;
  category?: string;
};

type GeneratedPackageFile = {
  path: string;
  content: string;
  mimeType: string;
};
```

클라이언트 저장 규칙:

```text
IndexedDB packageKey = manifest.key 또는 book:{bookIdx}
IndexedDB file path = resources[].path 또는 generatedFiles[].path
```

예:

```text
packageKey: book:6710
path: Lessons/L1/D1/word/info_word.json
path: Lessons/L1/D1/reading/01/img/img_01.png
path: Lessons/L1/D1/listening/01/info_listen_ebook.json
```

## 제안 API 변경 요약

기존 endpoint를 깨지 않고 optional `ebook` 섹션과 E-book resource category만 추가한다.

```http
GET /api/books/:bookIdx/resource-manifest
```

권장 응답 확장:

```ts
type BookResourceManifest = {
  key: string;
  book: BookData;
  progress?: {
    actTotal: number;
    actDone: number;
  };
  lessonDays: LessonDay[];
  resources: BookResource[];
  generatedFiles: GeneratedPackageFile[];
  ebook?: EbookResourceInfo;
  raw?: unknown;
};

type EbookResourceInfo = {
  source: "rhk-readalong" | "metaon-viewer";
  version: string;
  entryPath: string;
  assetRoot: string;
  dictPath?: string;
  translationPath?: string;
  dataPath?: string;
  resourceCount: number;
  totalBytes?: number;
};
```

기존 클라이언트는 알 수 없는 `ebook` 필드를 무시할 수 있으므로 backward compatible하다.

## 권장 IndexedDB 저장 경로

E-book은 Book 전체 리소스에 가깝기 때문에 `Lessons/L.../D...` 아래에 모든 파일을 중복 저장하지 않는다. Book-level virtual path를 사용한다.

```text
Books/{bookIdx}/ebook/book.json
Books/{bookIdx}/ebook/books.json
Books/{bookIdx}/ebook/dict.json
Books/{bookIdx}/ebook/translation.json
Books/{bookIdx}/ebook/data.json
Books/{bookIdx}/ebook/assets/pages/p001.png
Books/{bookIdx}/ebook/assets/pages/p002.png
Books/{bookIdx}/ebook/assets/audio/p001.mp3
Books/{bookIdx}/ebook/assets/audio/p002.mp3
```

Type 67 Activity에는 pointer JSON만 둔다.

```text
Lessons/L{lesson}/D{day}/listening/{folder}/info_listen_ebook.json
```

예:

```json
{
  "version": 2,
  "source": "rhk-readalong",
  "viewer": "ebook-readalong",
  "entryPath": "Books/6710/ebook/book.json",
  "dictPath": "Books/6710/ebook/dict.json",
  "translationPath": "Books/6710/ebook/translation.json",
  "assetRoot": "Books/6710/ebook/",
  "fallbackVideoPaths": [
    "Lessons/L1/D1/listening/01/video/video_01.mp4"
  ]
}
```

## Resource Category 규칙

`resources[].category`는 아래 값을 권장한다.

| Category | 용도 | 예시 path |
|---|---|---|
| `ebook-json` | E-book manifest 또는 book data JSON | `Books/6710/ebook/book.json` |
| `ebook-page` | E-book page image | `Books/6710/ebook/assets/pages/p001.png` |
| `ebook-audio` | E-book page audio | `Books/6710/ebook/assets/audio/p001.mp3` |
| `ebook-dict` | 단어 사전 JSON | `Books/6710/ebook/dict.json` |
| `ebook-translation` | 해석 JSON | `Books/6710/ebook/translation.json` |
| `ebook-data` | MetaOn viewer-widget용 `data.json` | `Books/6710/ebook/data.json` |
| `listening-caption` | caption/smi/vtt/json | `Lessons/L1/D1/listening/01/caption/...` |
| `listening` | 기존 fallback MP4 | `Lessons/L1/D1/listening/01/video/video_01.mp4` |

## E-book book.json 스키마

RHK Read-Along viewer가 사용하기 좋은 최소 스키마는 아래와 같다.

```json
{
  "id": "GPLaa01",
  "title": "Over",
  "level": "aa",
  "boxSource": "server-word-boxes",
  "pages": [
    {
      "bookPage": 1,
      "imgW": 792,
      "imgH": 1224,
      "img": "assets/pages/p001.png",
      "audio": "assets/audio/p001.mp3",
      "words": [
        {
          "w": "Over",
          "read": true,
          "body": true,
          "x": 0.2146,
          "y": 0.3821,
          "bw": 0.083,
          "bh": 0.031,
          "t0": 0.08,
          "t1": 0.78
        }
      ]
    }
  ]
}
```

필드 규칙:

| Field | 필수 | 설명 |
|---|---:|---|
| `pages[].img` | O | `Books/{bookIdx}/ebook/` 기준 상대 경로 |
| `pages[].audio` | O | `Books/{bookIdx}/ebook/` 기준 상대 경로 |
| `pages[].words[].w` | 권장 | 화면 highlight와 단어장에 표시할 단어 |
| `x`, `y`, `bw`, `bh` | 권장 | page image 기준 0-1 normalized 좌표 |
| `t0`, `t1` | 권장 | audio 시작/종료 초 단위 |
| `body` | 권장 | 본문 단어 여부 |
| `read` | 권장 | read-along 대상 여부 |

`x/y/bw/bh/t0/t1`가 없으면 클라이언트는 caption fallback만 표시할 수 있다. Netlify RHK Read-Along viewer처럼 본문 위에 단어 highlight를 정확히 표시하려면 좌표와 timestamp가 필요하다.

## 전체 응답 예시

```json
{
  "key": "book:6710",
  "book": {
    "bookIdx": 6710,
    "bookId": "GPLaa01",
    "bookCode": "GPLaa01",
    "title": "Over"
  },
  "progress": {
    "actTotal": 12,
    "actDone": 3
  },
  "lessonDays": [
    {
      "id": "978",
      "dayIdx": 978,
      "lesson": 1,
      "day": 1,
      "title": "Day 1",
      "activities": [
        {
          "id": "12881",
          "actIdx": 12881,
          "dayIdx": 978,
          "actType": 67,
          "title": "Listen",
          "actNum": 0,
          "category": "listening",
          "params": ["0"]
        }
      ]
    }
  ],
  "ebook": {
    "source": "rhk-readalong",
    "version": "2026-07-06T00:00:00Z",
    "entryPath": "Books/6710/ebook/book.json",
    "assetRoot": "Books/6710/ebook/",
    "dictPath": "Books/6710/ebook/dict.json",
    "translationPath": "Books/6710/ebook/translation.json",
    "resourceCount": 18,
    "totalBytes": 12345678
  },
  "resources": [
    {
      "path": "Books/6710/ebook/assets/pages/p001.png",
      "sourcePath": "/unimeta2/unilive/bookdata/GPLaa01/ebook/assets/pages/p001.png",
      "url": "https://metaon.s3.ap-northeast-2.amazonaws.com/unimeta2/unilive/bookdata/GPLaa01/ebook/assets/pages/p001.png",
      "mimeType": "image/png",
      "size": 234567,
      "category": "ebook-page"
    },
    {
      "path": "Books/6710/ebook/assets/audio/p001.mp3",
      "sourcePath": "/unimeta2/unilive/bookdata/GPLaa01/ebook/assets/audio/p001.mp3",
      "url": "https://metaon.s3.ap-northeast-2.amazonaws.com/unimeta2/unilive/bookdata/GPLaa01/ebook/assets/audio/p001.mp3",
      "mimeType": "audio/mpeg",
      "size": 345678,
      "category": "ebook-audio"
    }
  ],
  "generatedFiles": [
    {
      "path": "Books/6710/ebook/book.json",
      "mimeType": "application/json",
      "content": "{\"id\":\"GPLaa01\",\"title\":\"Over\",\"pages\":[]}"
    },
    {
      "path": "Books/6710/ebook/dict.json",
      "mimeType": "application/json",
      "content": "{}"
    },
    {
      "path": "Books/6710/ebook/translation.json",
      "mimeType": "application/json",
      "content": "{}"
    },
    {
      "path": "Lessons/L1/D1/listening/01/info_listen_ebook.json",
      "mimeType": "application/json",
      "content": "{\"version\":2,\"source\":\"rhk-readalong\",\"viewer\":\"ebook-readalong\",\"entryPath\":\"Books/6710/ebook/book.json\",\"assetRoot\":\"Books/6710/ebook/\"}"
    }
  ]
}
```

## S3 URL 및 CORS 요구사항

현재 클라이언트는 `resources[].url`을 브라우저에서 직접 `fetch()`한다. 따라서 URL은 브라우저가 접근 가능해야 한다.

필수 조건:

- `GET` 허용
- Cloud Run 서비스 origin 허용
- 로컬 개발 origin 허용: `http://127.0.0.1:5173`
- `Content-Type`이 실제 파일과 맞아야 함
- 가능하면 `Content-Length`, `ETag` 제공

권장 CORS:

```http
Access-Control-Allow-Origin: https://{metaon-cloud-run-domain}
Access-Control-Allow-Methods: GET, HEAD
Access-Control-Allow-Headers: Content-Type, Range
Access-Control-Expose-Headers: Content-Length, ETag, Accept-Ranges
```

운영에서 S3 CORS 설정이 어렵다면, `resources[].url`을 S3 직접 URL 대신 BFF resource proxy 또는 signed URL로 내려도 된다. 단, manifest의 `path/sourcePath/category` 계약은 유지한다.

## Backend 구현 체크리스트

1. `/content/getBookInfo` 또는 BFF normalizer에서 E-book 존재 여부 확인
2. Book 단위 E-book root 결정
   - 예: `unimeta2/unilive/bookdata/{bookCode}/ebook/`
   - 예: `MetaOn3/BookData/{...}/ebook/`
3. `book.json` 생성 또는 원본 `book.json` 참조
4. page image/audio 리소스를 `resources[]`에 추가
5. `dict.json`, `translation.json`이 있으면 `generatedFiles[]` 또는 `resources[]`에 추가
6. Type 67용 `info_listen_ebook.json` pointer를 `generatedFiles[]`에 추가
7. 기존 MP4가 있으면 fallback으로 계속 `resources[]`에 포함
8. `ebook.version` 또는 파일별 `etag/hash` 제공
9. 파일 누락 시 전체 실패보다 `ebook` 섹션 생략 또는 `ebook.available=false`로 처리
10. 응답 크기가 커질 경우 큰 JSON은 `generatedFiles` 대신 `resources[]`로 내려서 클라이언트가 다운로드하게 처리

## Version 및 재다운로드 규칙

권장 필드:

```json
{
  "ebook": {
    "version": "2026-07-06T00:00:00Z",
    "contentHash": "sha256:...",
    "resourceCount": 18,
    "totalBytes": 12345678
  }
}
```

클라이언트는 추후 아래 조건에서 재다운로드할 수 있다.

- `ebook.version` 변경
- `ebook.contentHash` 변경
- `resourceCount` 변경
- IndexedDB에 `entryPath` 또는 필수 page/audio 파일이 없음

## 클라이언트 기대 동작

1. Book page 진입
2. `GET /api/books/:bookIdx/resource-manifest` 호출
3. `generatedFiles[]`를 Blob으로 변환
4. `resources[]`를 `fetch(resource.url)`로 다운로드
5. 모든 파일을 `manifest.key` 아래 IndexedDB에 저장
6. Type 67 Activity 실행
7. `Lessons/L{lesson}/D{day}/listening/{folder}/info_listen_ebook.json` 읽기
8. `entryPath`의 `Books/{bookIdx}/ebook/book.json` 읽기
9. `book.json`의 상대 경로를 `assetRoot` 기준으로 IndexedDB Blob URL로 변환
10. `/ebook-viewer/listening.html` iframe에 payload 전달

## 호환성

기존 Word, Sentence, Reading, Listening MP4 리소스는 그대로 유지한다.

변경 전:

```text
Lessons/L1/D1/listening/01/video/video_01.mp4
Lessons/L1/D1/listening/01/info_listen_ebook.json
```

변경 후:

```text
Books/6710/ebook/book.json
Books/6710/ebook/assets/pages/p001.png
Books/6710/ebook/assets/audio/p001.mp3
Lessons/L1/D1/listening/01/info_listen_ebook.json
Lessons/L1/D1/listening/01/video/video_01.mp4  // fallback
```

기존 클라이언트는 `ebook` 섹션을 무시할 수 있고, 새 클라이언트는 `ebook` 섹션이 없을 경우 기존 MP4 또는 현재 fallback renderer로 동작한다.

## 테스트 요청 항목

백엔드 반영 후 아래 Book 기준으로 확인한다.

| Case | 기대 결과 |
|---|---|
| `GET /api/books/{bookIdx}/resource-manifest` | `ebook.entryPath`와 `ebook.assetRoot` 포함 |
| `resources[]` | page image/audio가 `ebook-page`, `ebook-audio` category로 포함 |
| `generatedFiles[]` | `Books/{bookIdx}/ebook/book.json` 포함 |
| Type 67 pointer | `Lessons/L1/D1/listening/01/info_listen_ebook.json` 포함 |
| S3 URL | 브라우저 `fetch()` 200 |
| CORS | Cloud Run과 로컬 개발 origin에서 CORS error 없음 |
| 누락 파일 | 전체 catalog/API 실패 없이 fallback 가능 |

## 결정 필요 사항

백엔드에서 확정이 필요한 항목:

1. E-book 원본 root
   - `unimeta2/unilive/bookdata/{bookCode}/ebook/`
   - `MetaOn3/BookData/...`
   - 기타 운영 S3 경로
2. `book.json`을 서버가 생성할지, 제작기 산출물을 그대로 사용할지
3. `book.json`에 단어 좌표와 timestamp를 포함할 수 있는지
4. `dict.json`, `translation.json` 제공 여부
5. E-book version/hash 기준
6. S3 direct URL 사용 가능 여부
7. direct URL이 불가능할 경우 signed URL 또는 BFF proxy 제공 방식

## 최소 구현안

가장 작은 적용 범위는 아래 4개다.

1. `ebook` 섹션 추가
2. `Books/{bookIdx}/ebook/book.json` 생성
3. page image/audio를 `resources[]`에 추가
4. Type 67 `info_listen_ebook.json`에 `entryPath` 추가

이 최소 구현만으로도 웹앱은 E-book 리소스를 다른 Activity처럼 다운로드하고 IndexedDB에서 읽을 수 있다. 단, word-level highlight 품질은 `book.json`에 좌표와 timestamp가 포함되는지에 따라 달라진다.
