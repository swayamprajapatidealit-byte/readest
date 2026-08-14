# Static Export (`out/`) Dependency Analysis

Goal: identify every feature in `apps/readest-app` that currently depends on a
running Next.js server (Node/Edge runtime), since none of these work with
`output: 'export'` (`next build` → static `out/` folder, no server process).

Current `next.config.js` sets `output: standaloneOutput ? 'standalone' : undefined`
— there is **no** `output: 'export'` path today. This doc is the checklist of
what has to be removed, replaced, or re-hosted before that flag can be turned on.

## Summary table

| # | Feature | File(s) | Blocks static export because | Needs |
|---|---|---|---|---|
| 1 | Global middleware (CORS + COOP/COEP headers) | [src/middleware.ts](src/middleware.ts) | Middleware requires a server runtime; silently does not run against static files | Move COOP/COEP to host-level headers config; drop or externalize CORS logic |
| 2 | Metadata search API route | ~~`src/app/api/metadata/search/route.ts`~~ | **Resolved — removed.** Was a server route handler holding a **secret** (`GOOGLE_BOOKS_API_KEYS`) server-side | ✅ done, see [REMOVED_FEATURES.md](REMOVED_FEATURES.md#1-metadata-search). To bring the feature back: externalize per [API_EXTERNALIZATION.md](API_EXTERNALIZATION.md#1-metadata-search--post-apimetadatasearch) |
| 3 | Edge TTS proxy route | ~~`src/app/api/tts/edge/route.ts`~~ | **Resolved — removed.** Was a server route handler (`GET`+`POST`) proxying to Microsoft Edge TTS | ✅ done, see [REMOVED_FEATURES.md](REMOVED_FEATURES.md#2-edge-tts--and-everything-built-on-it). To bring the feature back: externalize per [API_EXTERNALIZATION.md](API_EXTERNALIZATION.md#2-edge-tts-proxy--apittsedge-post--get) |
| 4 | `rewrites()` in Next config | [next.config.js](next.config.js) (`/reader/:ids`, `/o/book/:hash/annotation/:id`) | `rewrites` is server-only config; ignored under `output: 'export'` | Convert to client-side routing, or drop (the `/o` target route doesn't exist yet — dead config) |
| 5 | `headers()` in Next config | [next.config.js](next.config.js) (apple-app-site-association content-type, `_next/static` cache-control) | `headers` is server-only config; ignored under `output: 'export'` | Set via static host config (e.g. `_headers` file, CDN rules) instead |
| 6 | Image optimization | [next.config.js](next.config.js) (`images.unoptimized: true`) | Already disabled — **no action needed** | ✅ compatible as-is |
| 7 | PWA service worker (Serwist) | [src/sw.ts](src/sw.ts), `withSerwistInit` in next.config.js | Generates `public/sw.js` at build time from the compiled output; needs verification under export mode | Confirm Serwist's manifest injection still runs against `out/` (untested) |
| 8 | `standalone` output toggle | [next.config.js](next.config.js) (`BUILD_STANDALONE` env) | Mutually exclusive with `output: 'export'` — `output` can only be one value | Decide: export replaces standalone, doesn't compose with it |
| 9 | `outputFileTracingRoot` (Docker monorepo tracing) | [next.config.js](next.config.js) | Only meaningful for the standalone server tree | No-op under export, safe to leave conditional as-is |

## Detail

### 1. Middleware — `src/middleware.ts`
Runs on every request (`matcher` excludes only static assets) and does two things:
- Answers CORS preflight (`OPTIONS`) and sets `Access-Control-Allow-*` headers for `/api/*` requests from allow-listed origins (`web.readest.com`, `tauri://localhost`, `localhost:3000/3001`).
- Sets `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` on **every** document response — required for `crossOriginIsolated`/`SharedArrayBuffer`, which the Turso WASM thread pool needs to boot.

Static export has no server to run this on. The COOP/COEP headers are the
critical one — without them the WASM thread pool hangs. These must be
replicated at whatever layer serves the static files (Cloudflare Pages
`_headers`, Nginx, S3+CloudFront response-headers policy, Netlify `_headers`,
etc.). The CORS logic only matters if the two API routes below are kept
reachable cross-origin from the exported app.

### 2 & 3. API routes — resolved by removal
Both were live server endpoints reached via relative `/api/...` paths through
`getAPIBaseUrl()` in [src/services/environment.ts](src/services/environment.ts):
metadata search (title/ISBN/author lookup against Google Books/OpenLibrary,
guarding a `GOOGLE_BOOKS_API_KEYS` secret) and the Edge TTS proxy (voice
synthesis + word-boundary data via Microsoft's Edge TTS service). Neither was
a "static-friendly" route handler — both took request bodies and called out to
third-party services at request time, so `next export` could never ship them
into `out/`.

Rather than stand up an external backend for these before flipping on static
export, both features (and, for Edge TTS, several things built on top of it —
offline audio download, the sentence-gap control, an Edge-first path in
dictionary word pronunciation) were removed outright. Full list of what left
and what's left working: [REMOVED_FEATURES.md](REMOVED_FEATURES.md). The
externalization contract for reinstating either one later — payload shapes,
hosting options — is unchanged and still lives in
[API_EXTERNALIZATION.md](API_EXTERNALIZATION.md).

### 4 & 5. `rewrites()` / `headers()` — `next.config.js`
Both are async functions Next only evaluates when running its own server;
they're a no-op (with a build warning) under `output: 'export'`.
- `rewrites()` maps `/reader/:ids` → `/reader?ids=:ids` and `/o/book/:hash/annotation/:id` → `/o?book=:hash&note=:id`. The `/reader` target exists as a client page ([src/app/page.tsx](src/app/page.tsx) area uses `useSearchParams`); the `/o` target route **does not exist anywhere in `src/app`** — this half of the rewrite is currently dead config regardless of export.
- `headers()` sets `Content-Type: application/json` for `.well-known/apple-app-site-association` and long-lived immutable caching for `_next/static/*`. Both are easy to replicate via static-host header rules.

### 6. Images — already fine
`images.unoptimized: true` is already set, which is the documented requirement
for using `next/image` under static export. No change needed.

### 7. Service worker / PWA — `src/sw.ts` via `@serwist/next`
`withSerwistInit` injects a precache manifest into `public/sw.js` from the
production build output. This is disabled in dev and only wraps the config in
production builds. Whether Serwist's manifest-injection step correctly finds
all assets when the build target is `out/` instead of `.next/` has not been
verified — flag as a build-time risk to test, not a hard blocker.

### 8. `standalone` vs `export`
`output` accepts a single value. The current conditional
(`standaloneOutput ? 'standalone' : undefined`) would need a third branch for
`'export'`, and it's mutually exclusive with the Docker/OpenNext deploy paths
that rely on `standalone`/the Cloudflare adapter — i.e. static export becomes
a distinct build target, not something layered on top of the existing ones.

## Decisions to make

Open questions that need an answer before (or while) flipping on
`output: 'export'`. None of these are code — they're choices that determine
what the code change even looks like.

1. ~~Where do the two API routes live?~~ **Resolved for now — removed instead of externalized** (see [REMOVED_FEATURES.md](REMOVED_FEATURES.md)). This decision only resurfaces if/when either feature comes back: fold into the existing Visualible backend (same place `NEXT_PUBLIC_MARKETPLACE_HOST`/`NEXT_PUBLIC_AWS_HOST` already point), or stand up a separate Worker/Lambda just for `metadata/search` + `tts/edge`? Details/options in [API_EXTERNALIZATION.md](API_EXTERNALIZATION.md).

2. **Where do COOP/COEP (and the other static headers) get set now that middleware can't run?**
   Depends on the static host: Cloudflare Pages `_headers`, an Nginx/Caddy config in front of a bucket, a CloudFront response-headers policy, Netlify `_headers`, etc. Pick the host first — the header mechanism follows from that. This is the one that must not be dropped: no COOP/COEP → the Turso WASM thread pool hangs.

3. **Does the CORS allow-list in `src/middleware.ts` still need `tauri://localhost` / `http://tauri.localhost`?**
   This fork is web-only — no Android/desktop app target (per [CLAUDE.md](CLAUDE.md)). If that still holds, the allow-list shrinks to just the web origins (`web.readest.com`, local dev ports), which simplifies whatever re-implements CORS on the externalized API routes. Confirm before carrying Tauri origins forward into new infra.

4. **What replaces the `/reader/:ids` rewrite?**
   Options: (a) keep it query-string-only (`/reader?ids=...`) and update whatever currently links to `/reader/:ids` to build that URL directly — no rewrite needed; (b) reproduce the path→query mapping at the static host's redirect/rewrite layer if the host supports it (Cloudflare Pages `_redirects`, CloudFront function, etc.). (a) is simpler and removes a moving part.

5. **Drop the `/o/book/:hash/annotation/:id` rewrite outright?**
   Its target route (`/o`) doesn't exist in `src/app` today — this is currently dead config independent of static export. Worth confirming it's not mid-flight/planned work before deleting; if it is planned, it needs the same "how does routing work without a server" treatment as #4 once built.

6. **Does static export replace or sit alongside the existing build targets?**
   Today there are three: default server build (`build-web`), Docker `standalone` (`BUILD_STANDALONE=true`, for self-hosting per [docker/README.md](../../docker/README.md)), and the primary deploy target — Cloudflare Workers via OpenNext (`deploy`/`preview`/`upload` scripts, per [CLAUDE.md](CLAUDE.md)). `output` only takes one value, so static export is a fourth, separate target — decide whether it's meant to replace Cloudflare Workers as the main deploy target, replace the Docker self-host path, or just add a cheaper CDN-only option alongside both.

7. **`trailingSlash` and routing shape for the exported output.**
   Static export writes one HTML file per route (e.g. `out/reader.html` or `out/reader/index.html` depending on `trailingSlash`). Whichever static host is chosen needs its routing behavior (clean URLs, trailing slash handling) matched to this setting — worth deciding alongside #2/#6 rather than after the first failed deploy.

8. **Verify Serwist's manifest injection against `out/` before committing to this path.**
   Untested today (see item 7 in the table above) — if `@serwist/next` can't correctly precache against a static export's output, that's either a blocker or means hand-rolling the service-worker manifest step.

## Net takeaway

Everything under `src/app/**` that renders is already client components
(`'use client'`) reading query params via `useSearchParams` — the page layer
itself is static-export-friendly. The two API routes are no longer a
blocker — both were removed (see [REMOVED_FEATURES.md](REMOVED_FEATURES.md))
rather than externalized. The remaining blocker is
**server-side glue in `src/middleware.ts`**: the COOP/COEP headers the WASM
thread pool needs, plus CORS handling for `/api/*` (now moot unless a
reinstated feature brings an API route back). Its behavior needs to move to
host-level headers config before `output: 'export'` can be turned on safely.
