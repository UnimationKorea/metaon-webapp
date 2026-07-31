# MetaOn Service Worker Media Cache 백엔드 연동 가이드

작성일: 2026-07-31
수신: MetaOn 콘텐츠 API, S3/CDN, BFF 담당자
목적: Book 리소스를 Service Worker + Cache Storage 방식으로 안정적으로 내려주기 위한 API 및 S3 계약 정의

## 1. 요청 배경

현재 MetaOn 웹앱은 `GET /api/books/:bookIdx/resource-manifest`로 리소스 목록을 받고, 브라우저가 S3에서 파일을 직접 내려받는다.

기존 클라이언트는 MP4/MP3/이미지까지 IndexedDB Blob으로 저장한 후 Object URL로 재생한다. 앞으로는 리소스 바이트를 Cache Storage에 저장하고 Service Worker를 통해 `<video>`, `<audio>`, `<img>` 요청에 그대로 반환한다.

이 변경의 목적은 다음과 같다.

- 대용량 MP4의 재생 시작과 탐색 안정화
- 오프라인/재방문 재생 지원
- 동영상형 Activity와 `MOVIE01`의 표준 media pipeline 사용
- Book 단위 resource version 관리

S3 직접 다운로드 원칙은 유지한다. BFF가 영상 바이트를 proxy하거나 저장하지 않는다.

## 2. 기존 계약

### BFF endpoint

```http
GET /api/books/:bookIdx/resource-manifest
```

### upstream 호출

```http
POST /content/getBookInfo
Content-Type: application/json

{ "book_idx": 6710 }
```

### 현재 클라이언트가 사용하는 resource 기본 필드

```ts
type BookResource = {
  path: string;       // 클라이언트 virtual path
  sourcePath: string; // 원본 S3 상대 또는 절대 경로
  url: string;        // 브라우저가 직접 GET할 S3 URL
  mimeType: string;
  size?: number;
  category?: string;
};
```

기존 필드는 삭제하거나 의미를 바꾸면 안 된다. 아래 확장 필드를 optional로 추가한다.

## 3. 요구 API 확장

### 3.1 manifest 수준 필드

```ts
type BookResourceManifest = {
  key: string;                  // 예: book:6710
  resourceVersion: string;      // Book 전체 리소스 버전
  resources: BookResource[];
  generatedFiles: GeneratedPackageFile[];
  // 기존 book, lessonDays, progress 등은 유지
};
```

`resourceVersion`은 Book의 리소스 파일 구성이 바뀔 때 변경해야 한다. 권장값은 배포 버전 또는 manifest hash다.

### 3.2 resource 수준 필드

```ts
type BookResource = {
  path: string;
  sourcePath: string;
  url: string;
  mimeType: string;
  size?: number;
  category?: string;

  // Service Worker cache 확장 필드
  cacheKey?: string;            // signed URL과 무관한 안정적인 논리 키
  version?: string;             // 해당 파일 콘텐츠 버전
  etag?: string;                // S3 object ETag
  sha256?: string;              // 가능하면 제공하는 콘텐츠 검증값
  contentLength?: number;       // size와 동일해도 명시 권장
  acceptRanges?: boolean;       // MP4/MP3에는 true
  cacheControl?: string;        // 예상 Cache-Control 값
  urlExpiresAt?: string;        // signed URL을 쓸 때만 ISO timestamp
  optional?: boolean;           // 없더라도 Book 전체 download가 실패하지 않는 리소스
};
```

### 3.3 권장 응답 예시

```json
{
  "key": "book:6710",
  "resourceVersion": "2026-07-31T12:30:00Z",
  "book": {
    "bookIdx": 6710,
    "bookCode": "GPLaa01",
    "title": "Over"
  },
  "resources": [
    {
      "path": "Lessons/L1/D1/movie/video/movie_01.mp4",
      "sourcePath": "/6710/Lessons/L1/D1/movie/video/movie_01.mp4",
      "url": "https://metaon.s3.ap-northeast-2.amazonaws.com/MetaOn3/BookData/6710/Lessons/L1/D1/movie/video/movie_01.mp4",
      "mimeType": "video/mp4",
      "size": 18493211,
      "contentLength": 18493211,
      "category": "movie-video",
      "cacheKey": "metaon/book/6710/20260731/Lessons/L1/D1/movie/video/movie_01.mp4",
      "version": "20260731.1",
      "etag": "\"d41d8cd98f00b204e9800998ecf8427e\"",
      "acceptRanges": true,
      "cacheControl": "public, max-age=31536000, immutable"
    },
    {
      "path": "Lessons/L1/D1/movie/caption/movie_01.word_timing.json",
      "sourcePath": "/6710/Lessons/L1/D1/movie/caption/movie_01.word_timing.json",
      "url": "https://metaon.s3.ap-northeast-2.amazonaws.com/MetaOn3/BookData/6710/Lessons/L1/D1/movie/caption/movie_01.word_timing.json",
      "mimeType": "application/json",
      "category": "movie-word-timing",
      "cacheKey": "metaon/book/6710/20260731/Lessons/L1/D1/movie/caption/movie_01.word_timing.json",
      "version": "20260731.1"
    }
  ],
  "generatedFiles": []
}
```

## 4. cacheKey, URL, version 규칙

### 필수 원칙

1. `path`는 현재와 동일한 Activity renderer용 virtual path다.
2. `cacheKey`는 signed URL의 token, 만료 시각, 임시 query string을 포함하지 않는다.
3. 파일 내용 변경 시 `version`, `etag`, `sha256` 중 하나 이상이 달라져야 한다.
4. URL은 직접 다운로드 가능한 S3/CDN URL이어야 한다.
5. `resourceVersion`이 바뀌면 클라이언트는 해당 Book의 stale cache를 다시 받는다.

### public object 권장

가장 단순한 운영 방식은 리소스 경로에 version을 포함하고, URL을 장기간 유지하는 것이다.

```text
https://.../BookData/6710/v20260731/.../movie_01.mp4
```

이 경우 아래 헤더를 권장한다.

```http
Cache-Control: public, max-age=31536000, immutable
ETag: "..."
Accept-Ranges: bytes
```

### signed URL을 반드시 써야 하는 경우

- `url`은 짧은 수명이어도 되지만 `cacheKey`는 안정적이어야 한다.
- `urlExpiresAt`을 반드시 제공한다.
- 만료가 임박했거나 403이 발생하면 클라이언트가 manifest를 재요청할 수 있어야 한다.
- 이미 Cache Storage에 저장된 파일은 signed URL 만료 후에도 재생할 수 있어야 한다.

## 5. S3/CDN 필수 설정

### 5.1 HTTP 응답

MP4/MP3에 대해 아래 동작을 보장해야 한다.

| 요청 | 기대 응답 |
|---|---|
| `GET object.mp4` | `200`, 올바른 `Content-Type`, 전체 파일 |
| `HEAD object.mp4` | `200`, `Content-Length`, `ETag`, `Accept-Ranges` |
| `GET` + `Range: bytes=0-1023` | `206`, `Content-Range`, 해당 바이트 |
| 존재하지 않는 파일 | `404` |
| 권한 만료 signed URL | `403` 또는 `401`, manifest refresh 가능 |

MP4는 `Content-Type: video/mp4`, MP3는 `audio/mpeg`, WebVTT는 `text/vtt; charset=utf-8`, JSON은 `application/json; charset=utf-8`을 사용한다. `Content-Disposition: attachment`는 설정하지 않는다.

### 5.2 CORS

Cloud Run 운영 origin과 로컬 개발 origin에서 직접 S3 요청이 가능해야 한다.

권장 CORS 정책 예시:

```xml
<CORSConfiguration>
  <CORSRule>
    <AllowedOrigin>https://metaon-webapp-geaypbs2uq-du.a.run.app</AllowedOrigin>
    <AllowedOrigin>http://localhost:5173</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedMethod>OPTIONS</AllowedMethod>
    <AllowedHeader>Range</AllowedHeader>
    <AllowedHeader>Content-Type</AllowedHeader>
    <ExposeHeader>Accept-Ranges</ExposeHeader>
    <ExposeHeader>Content-Length</ExposeHeader>
    <ExposeHeader>Content-Range</ExposeHeader>
    <ExposeHeader>ETag</ExposeHeader>
    <MaxAgeSeconds>3600</MaxAgeSeconds>
  </CORSRule>
</CORSConfiguration>
```

운영 URL이 추가되면 `AllowedOrigin`에도 추가해야 한다. 보안 정책상 가능하면 `*` 대신 명시 origin을 사용한다.

## 6. 카테고리 추가 권장

기존 `category`는 유지하고 아래 값을 허용한다.

| category | 용도 |
|---|---|
| `movie-video` | MOVIE01 기본 MP4 |
| `movie-audio` | Script 모드 전용 음성 |
| `movie-caption` | VTT/SMI/SRT/문장 cue JSON |
| `movie-word-timing` | 단어 단위 highlight timing JSON |
| `video-background` | WDCA02 등 배경 동영상 |
| `ebook-page` | E-book page image |
| `ebook-audio` | E-book page audio |
| `ebook-json` | E-book `book.json` |
| `npcqhk` | NPC Quick Check script/image/audio |

동영상형 Activity의 리소스가 Activity별 경로에 없을 경우, Day 공통 `video/` resource에는 `video-background` category를 내려준다.

## 7. 백엔드 변경 범위

### 최소 변경

1. `/content/getBookInfo` 또는 BFF 정규화 결과에 `resourceVersion` 추가
2. 각 `resources[]`에 `cacheKey`, `version`, `etag`, `contentLength`, `acceptRanges` 추가
3. S3 object의 CORS, MIME type, Range 응답 확인

### 권장 변경

1. object 업로드 시 versioned path 또는 manifest version 갱신 자동화
2. `sha256` 생성 및 manifest 포함
3. signed URL을 쓸 경우 manifest refresh 또는 URL refresh endpoint 지원
4. 콘텐츠 배포 후 샘플 Book의 GET/HEAD/Range smoke test 자동화

### 변경하지 않는 것

- BFF가 S3 file bytes를 전달하는 proxy endpoint
- ZIP endpoint 복구
- 기존 `path`, `sourcePath`, `url`, `mimeType` 필드 삭제
- Activity별 별도 미디어 API 생성

## 8. 클라이언트와 백엔드 책임 경계

| 구분 | 책임 |
|---|---|
| 콘텐츠 API/BFF | manifest 정규화, 로그인 권한 검증, resource version 제공 |
| S3/CDN | 파일 바이트, MIME, CORS, Range, ETag, Cache-Control |
| Webapp downloader | 다운로드 진행 표시, Cache Storage 기록, 실패 재시도 |
| Service Worker | cached Response 반환, Range request 206 처리, cache version 정리 |
| IndexedDB | Book manifest와 cache 상태, 실패 정보, 다운로드 완료 상태 |

## 9. 인수 테스트

아래 검증은 Book 한 권과 MP4 한 개 기준으로 진행한다.

```powershell
# 1. manifest에 새 필드가 포함되는지 확인
Invoke-RestMethod "https://<webapp-origin>/api/books/6710/resource-manifest"

# 2. S3 일반 GET
Invoke-WebRequest -Method Get "<resource-url>" -OutFile movie.mp4

# 3. HEAD headers
Invoke-WebRequest -Method Head "<resource-url>" |
  Select-Object -ExpandProperty Headers

# 4. Range 응답
Invoke-WebRequest -Method Get "<resource-url>" -Headers @{ Range = "bytes=0-1023" } |
  Select-Object StatusCode, Headers
```

브라우저 인수 기준:

1. Book 리소스 다운로드 완료 후 새로고침한다.
2. 개발자 도구에서 offline을 켠다.
3. 동일 Book의 MOVIE01 또는 동영상형 Activity를 연다.
4. MP4가 재생되고, seek가 가능하며, script/timing JSON도 읽힌다.
5. manifest의 version을 바꾼 뒤 다시 진입하면 새 cache가 생성된다.

## 10. 참고

- 캐시된 audio/video에는 사전 cache, `crossorigin`, Range 요청 처리가 필요하다. [Chrome Workbox media caching](https://developer.chrome.com/docs/workbox/serving-cached-audio-and-video/)
- `RangeRequestsPlugin`은 cached full response에서 요청된 range를 206 response로 반환한다. [Chrome Workbox Range requests](https://developer.chrome.com/docs/workbox/modules/workbox-range-requests)
- Service Worker update는 기존 worker와 cache가 동시에 존재할 수 있으므로 versioned cache 정리가 필요하다. [Service Worker lifecycle](https://web.dev/articles/service-worker-lifecycle)
