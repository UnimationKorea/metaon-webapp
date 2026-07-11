# MetaOn Web Native

React/Vite + Express BFF implementation for the MetaOn web-native refactor.

This `webapp/` was scaffolded from the Uniplanet web-native implementation documented in
`uniplanet_development_summary_reference.md`, then adapted to the MetaOn Unity project contracts under
`D:\Codex\MetaOn`.

## Commands

```powershell
npm install
npm run dev
npm run test
npm run build
```

- Frontend: `http://127.0.0.1:5173`
- BFF: `http://127.0.0.1:4100`

## Runtime Contract

- `GET /api/books` proxies `https://imetaon.com:5680/book/list` with the Unity headers `App-Idx: 2`, `App-Version: 2.2.25`, and `Platform: Android`, then normalizes the MetaOn `brandlist -> sglist -> slist -> blist` catalog shape.
- `POST /api/auth/login` proxies `/user/login`, stores the upstream `JSESSIONID`/`Session-Id` inside a same-origin HttpOnly cookie, and returns sanitized user display data to the client.
- `POST /api/auth/session` accepts `userIdx` plus an existing `Session-Id` or `JSESSIONID`, verifies it with `/book/list`, then stores it in the same HttpOnly cookie.
- MetaOn `/book/list` returns `resultCode: 137` without an authenticated server session. Use the web `/login` screen, or set `METAON_USER_IDX` plus `METAON_SESSION_ID`/`METAON_COOKIE` in the BFF environment for server-side verification.
- `GET /api/packages` proxies `/book/packagelist` and exposes the raw `plist` package list for later My Package/Daily Books flows.
- `GET /api/books/:seriesGroup/:seriesIdx/:bookId/package` resolves the book `bUrl` from the catalog and streams the ZIP from `https://metaon.s3.ap-northeast-2.amazonaws.com`.
- `POST /api/study/start`, `/api/study/end`, and `/api/study/quiz-accept` proxy the existing study endpoints with the same header/session rules.
- Recognition endpoints are intentionally stubbed with `501` until server credentials are provisioned.

## MetaOn Unity Source Contracts

- API origin: `Assets/Uniplayer/Container/Scripts/Managers/Network/NetDefines.cs`
- Request headers and `App-Idx`: `Assets/Uniplayer/Container/Scripts/Managers/Network/NetworkManager.cs`
- CDN/content origin and file names: `Assets/Uniplayer/Common/Scripts/Defines/PathDef.cs`
- `Act_Type`, scene mapping, and native permission hints: `Assets/Uniplayer/Common/Scripts/Defines/GLOBAL.cs`
- Catalog model: `Assets/Uniplayer/Common/Scripts/DataClass.cs`

## Client Architecture

- `src/types/uniplanet.ts` currently preserves the Unity `Act_Type` numeric contract, including MetaOn-specific activity codes.
- `src/services/bookPackageImporter.ts` downloads ZIP packages through the BFF, unpacks them with JSZip, derives lesson/activity metadata, and stores files in IndexedDB.
- `src/services/activityRegistry.tsx` maps Unity activity codes to implemented, compatible, or pending web renderers.
- Browser-native ports live in `src/ports`: media playback, `MediaRecorder`, and recognition proxy boundaries.

## Current Implementation Boundaries

This is the first MetaOn web-native foundation. The book/package download and activity launch flow is ported first. MetaOn-specific surfaces such as My Planet, MV, avatar inventory, m-pass purchases, quiz room, agency notice, and homework upload need dedicated web screens and API contracts after the core learning flow is verified.

For Cloud Run, set a stable `METAON_AUTH_COOKIE_SECRET` so BFF auth cookies remain valid across container restarts and revisions.
