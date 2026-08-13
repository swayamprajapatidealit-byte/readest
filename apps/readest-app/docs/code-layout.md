# Readest App Code Layout

This note summarizes the runtime boundaries inside `apps/readest-app`, with two goals:

- explain which directories are server-side, client-side, or mixed
- explain the directory-level role of `apps/readest-app/src/services`

Readest is web-only and local-only now: `apps/readest-app/src` (the Next.js/React
app) is the entire product. There is no `src-tauri` native shell and no
desktop/mobile build target — both were removed from this fork. A second
cleanup pass on top of that removed the AI assistant, translation providers,
Hardcover/Readwise, cloud/file sync, OPDS/RSS/web-novel import, "Send to
Readest", public sharing, and the whole Supabase auth/Stripe billing system.
`src/pages/api` and `src/context` (no more Auth/Sync contexts) shrank the most
as a result; see [architecture.md](./architecture.md) for what those features
used to look like and why they're gone.

## Directory classification inside `apps/readest-app`

### Mostly server-side directories

- `apps/readest-app/src/app/api`
  Next.js App Router server endpoints (`route.ts`). Only two remain:
  `metadata/search` and `tts/edge`, both unauthenticated. (`opds/proxy` is
  also still on disk but has no caller — leftover from the OPDS removal.)

- `apps/readest-app/src/pages/api`
  Empty. Every route that used to live here (sync, storage, send, DeepL,
  BookOrbit, user/account) was deleted along with its feature.

- `apps/readest-app/src/app/runtime-config.js`
  A server route that emits runtime JavaScript config for the client
  (`apiBaseUrl`, `fontBaseUrl` — much smaller than before auth/billing were
  removed).

- `apps/readest-app/workers`
  `workers/send-email` still exists as a source tree, but the "Send to
  Readest by email" feature it served is gone — it has no live counterpart to
  talk to.

### Mostly client-side directories

- `apps/readest-app/src/components`
  Reusable React UI components.

- `apps/readest-app/src/context`
  React context providers: `EnvContext` (app service / environment wiring),
  `DropdownContext`, and `PHContext` (PostHog telemetry, opt-in/opt-out via
  settings). No more `AuthContext` or sync-related context — both were
  deleted with the auth/sync systems.

- `apps/readest-app/src/hooks`
  Client-side React hooks.

- `apps/readest-app/src/store`
  Frontend state stores (Zustand). See [architecture.md](./architecture.md)
  section 3.2 for the current list — every store that only existed to
  support a deleted feature (AI chat, RSS feeds, file sync, cloud transfers,
  OPDS catalogs) is gone.

- `apps/readest-app/src/styles`
  Styling, theme assets, and UI presentation helpers.

- `apps/readest-app/src/data`
  Static or bundled app data (e.g. `data/demo` — the demo library shown on
  first launch).

- `apps/readest-app/src/i18n`
  Internationalization resources and setup.

- `apps/readest-app/src/workers`
  Browser worker code used by the frontend (e.g. the library search index
  worker).

- `apps/readest-app/public`
  Static assets served to the frontend, including vendored PDF.js/simplecc/jieba
  builds copied in at build time, and `public/locales/*` (i18n translation
  files).

- `apps/readest-app/extensions/send-to-readest`
  Browser-extension client code still exists on disk, but the backend it
  talked to (`src/services/send`, the `/api/send/*` routes) is gone — the
  extension has no live server to send to on this fork.

### Mixed or shared directories

- `apps/readest-app/src/app`
  Mostly frontend routes and UI, but not purely client-side. In Next App Router,
  `page.tsx`, `layout.tsx`, and related files can mix server rendering and
  client components. The exception is `src/app/api`, which is server-only.
  What's left under `src/app` besides `api`: `library`, `reader`, `o`
  (annotation deep-link landing page), `offline`, plus root `page.tsx`
  (renders the library directly) and `layout.tsx`. There is no more `auth`,
  `send`, `user`, `opds`, `s`, or `o`'s old sibling `share` UI — all deleted.

- `apps/readest-app/src/pages`
  Mixed. `src/pages/api` is empty (server-only when it had routes);
  `src/pages/reader/index.tsx` is the frontend route the `/reader/:ids`
  rewrite points at; `_app.tsx` and `_document.tsx` are Pages Router
  wrapper/document files.

- `apps/readest-app/src/services`
  Shared domain/service layer. Most of this is not "backend-only"; it contains
  the platform adapter, client logic, and reader-side feature logic. See the
  breakdown below.

- `apps/readest-app/src/utils`
  Shared helpers used by both frontend code and server handlers.

- `apps/readest-app/src/libs`
  Shared library code: document loading (`document.ts`), Edge TTS client
  (`edgeTTS.ts`), media session integration, storage helpers, and app-lock
  crypto (`libs/crypto`). Auth (`libs/auth.ts`), payment, sync, and sharing
  helpers that used to live here are gone.

- `apps/readest-app/src/helpers`
  General helper code (settings, keyboard shortcuts, "open with"), usually
  shared.

- `apps/readest-app/src/types`
  Shared type definitions.

- `apps/readest-app/bench`
  Standalone Node benchmarks (library search, Turso-backed search) run via
  `pnpm bench`, outside the Next.js build.

- `apps/readest-app/scripts`
  Build, release, and maintenance scripts (worktree setup, WordLens data
  build/sync, release-notes sync).

- `apps/readest-app/docs`
  App-specific documentation.

There is no `e2e/` directory and no `src/__tests__` — this fork runs no
automated test suite; verification is manual (lint + `pnpm dev-web`).

## `src/app` and `src/pages` at directory level

### `src/app`

- `src/app/api`: server-side HTTP endpoints (`metadata/search`, `tts/edge`)
- `src/app/library`: library UI
- `src/app/o`: annotation deep-link landing page (rewritten from
  `/o/book/:hash/annotation/:id`) — tries an Android/iOS app handoff (dead on
  this web-only fork), then falls back to opening the book in the web reader
- `src/app/offline`: frontend offline page
- `src/app/reader`: reader UI
- `src/app/runtime-config.js`: server-generated runtime config endpoint

So `src/app` is almost entirely application UI, with one explicitly
server-only subtree: `src/app/api`, plus the runtime-config route.

### `src/pages`

- `src/pages/api`: empty
- `src/pages/reader`: frontend page route (`index.tsx`, the target of the
  `/reader/:ids` rewrite)
- `src/pages/_app.tsx`: application wrapper for Pages Router
- `src/pages/_document.tsx`: server-side document shell

So `src/pages` is mixed, not purely client-side, even though it's much
smaller than `src/app` now.

## `src/services` breakdown

The most important point is this:

- `src/services` is mostly a shared application/service layer
- it is not the same thing as "backend code"
- the only actual HTTP server entrypoints left are the two routes under
  `src/app/api`
- exactly one platform adapter exists now (`webAppService.ts`) — see
  [architecture.md](./architecture.md) section 4 for the history and the
  handful of files that still contain unreachable Tauri-only branches
  (`NativeTTSClient.ts`, `NativeAudioPlayer.ts`, `settingsSync.ts`, and a
  scattering of `src/utils` files)

### Top-level files in `src/services`

- `appService.ts`
  `AppService` interface / `BaseAppService` base class.

- `webAppService.ts`
  The only concrete `AppService` implementation (browser).

- `environment.ts`
  Runtime environment detection (`isTauriAppPlatform()`/`isWebAppPlatform()` are now hardcoded) and the `WebAppService` singleton getter.

- `bookService.ts`, `bookContent.ts`
  Book-level operations: covers, metadata shaping, and resolving where a book's bytes actually live (a locally-imported copy or a path kept in place).

- `libraryService.ts`, `librarySearchService.ts`, `librarySearchIndex.ts`, `librarySearchWorker.ts`
  Library management and full-text/section search, including the per-book search index cache and its web worker.

- `deleteLibraryService.ts`
  Whole-library wipe (local only — there's no cloud copy to also delete anymore).

- `demoBooks.ts`
  The demo library shown on first launch (`data/demo/*.json`).

- `settingsService.ts`
  Reading and persisting settings.

- `backupService.ts`
  Backup/import-export related logic.

- `biometric.ts`
  Face ID / Touch ID unlock support checks — self-documented as permanently unavailable on web (no native bridge); the surrounding PIN-unlock decision logic (app lock, see architecture.md 6.8) stays real.

- `fontService.ts`
  Custom font handling.

- `imageService.ts`
  Image-related helper logic.

- `ingestService.ts`
  Import / ingest pipeline for locally-added books.

- `persistence.ts`
  Shared persistence utilities.

- `transformService.ts`
  Content transformation entrypoints.

- `commandRegistry.ts`
  Command registration / dispatch (command palette).

- `runtimeConfig.ts`
  Client/server accessors for the injected runtime config (section 5.2 of architecture.md).

- `constants.ts` and `errors.ts`
  Shared constants and error types.

These top-level files are shared client/application-layer code.

### `src/services/database`

Database access and migrations. See
[architecture.md](./architecture.md) section 6.1 — this is the app's one and
only persistence layer, untouched by any of the removal work.

- `webDatabaseService.ts`: the browser/web DB implementation actually used at runtime (Turso WASM)
- `nodeDatabaseService.ts`: a Node-native (`@tursodatabase/database`) implementation with no current caller — orphaned, not wired to anything
- `migrate.ts` and `migrations/`: schema and migration logic, shared by both

This is shared infrastructure code, not an HTTP backend directory.

### `src/services/wordlens`

Inline vocabulary-difficulty glossing: decides which words in a chapter are
worth glossing, sources definitions from bundled gloss packs, and hands off to
the reader's ruby-annotation rendering. See
[architecture.md](./architecture.md) 6.4.

### `src/services/metadata`

Book metadata lookup services.

- provider implementations for Google Books and Open Library
- shared metadata types and orchestration service

This is shared integration logic. Actual HTTP exposure happens via
`src/app/api/metadata/search`. See [architecture.md](./architecture.md) 6.5.

### `src/services/dictionaries`

Dictionary import, parsing, lookup, and provider registry.

- readers/parsers for StarDict, SLOB, mdict, BGL, and related formats
- provider adapters for dictionary/web-search/Wikipedia/Wiktionary sources
- dictionary service, deduplication, content ID, and lookup candidate generation

This is primarily client/application functionality.

### `src/services/annotation`

Annotation models and provider adapters.

- annotation types and normalization
- provider adapters: Foliate (default in-app representation), Readest, and MoonReader export/import

Mostly shared reader-side logic. See [architecture.md](./architecture.md) 6.6.

### `src/services/nav`

Navigation, fragments, grouping, locations, and lookup utilities for books.

Mostly client-side reader logic.

### `src/services/tts`

Read Aloud abstraction and implementations.

- `WebSpeechClient.ts`: browser TTS
- `EdgeTTSClient.ts`: remote/provider-backed TTS via `app/api/tts/edge` (unauthenticated)
- `mediaOverlay/`: a book's own recorded narration (EPUB 3 Media Overlays)
  played in place of synthesis — see
  [read-along-narration.md](read-along-narration.md)
- `NativeTTSClient.ts`, `NativeAudioPlayer.ts`: Tauri-only implementations, unreachable on web (see architecture.md section 4)
- controller/data/types/utilities (`TTSController`, `TTSData`, `SectionTimeline`, `WebAudioPlayer`, ...)

Mostly used by the reader frontend. No premium/quota gating remains anywhere
in this stack.

### `src/services/rsvp`

RSVP reader mode logic.

- controller, persistence, utilities, and types

Client-side reading feature code.

### `src/services/transformers`

Text/content transformation modules.

- language, punctuation, whitespace, proofread, sanitization, footnote, style, simplecc, warichu

Shared pure logic, usually frontend-facing but not tied to a single runtime.

### `src/services/statistics`

Reading-statistics tracking: local stats DB, the core tracker, and
TTS-specific stats recording. Fully local now — the server-sync half of this
subsystem was removed along with the rest of cloud sync. See
[architecture.md](./architecture.md) 6.9.

## Practical mental model

If you want a fast rule of thumb for this repo, use this:

- HTTP backend entrypoints: `src/app/api` (two routes), `workers` (unused leftover)
- frontend UI/routes: `src/app` except `api`, plus `src/components`, `src/hooks`, `src/store`
- shared app/domain logic: `src/services`, `src/utils`, `src/libs`, `src/types`
- durable data: always through `src/services/database` (Turso WASM), never a bespoke store

That model matches the codebase much better than "everything under `src` is client code."
