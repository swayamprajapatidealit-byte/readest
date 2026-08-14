# APIs to Externalize for Static Export

This is the detailed companion to [STATIC_EXPORT_ANALYSIS.md](STATIC_EXPORT_ANALYSIS.md#2--3-api-routes--srcapproutets),
covering the two Next.js route handlers that must be re-hosted somewhere else
before `output: 'export'` can ship — a static `out/` build carries no server,
so these simply won't exist in the output at all.

Both are currently reached by the client via **relative** paths, resolved by
[`getAPIBaseUrl()`](src/services/environment.ts):

```ts
export const getAPIBaseUrl = () => (isWebDevMode() ? '/api' : `${getBaseUrl()}/api`);
```

That's the one seam that has to change: point it at wherever these move to,
instead of assuming "same origin, `/api/...`".

---

## 1. Metadata search — `POST /api/metadata/search`

**File:** [src/app/api/metadata/search/route.ts](src/app/api/metadata/search/route.ts)
**Called from:** [src/libs/metadata.ts](src/libs/metadata.ts) → `searchMetadata()`

### What it does
Looks up book metadata (title, author, cover, ISBN, etc.) by title/ISBN/author,
querying two providers in parallel and merging/sorting by confidence:
- [OpenLibraryProvider](src/services/metadata/providers/openlibrary.ts) — no key required.
- [GoogleBooksProvider](src/services/metadata/providers/googlebooks.ts) — **requires `GOOGLE_BOOKS_API_KEYS`**.

### Why it can't just move client-side
`GOOGLE_BOOKS_API_KEYS` is a real secret, currently read server-side only
(`process.env['GOOGLE_BOOKS_API_KEYS']` in the route handler, never a
`NEXT_PUBLIC_*` var). Baking it into a static client bundle would expose it to
anyone who opens devtools. It must stay behind a server of some kind.

### Contract to preserve
```
POST <base>/metadata/search
Content-Type: application/json

Request body (SearchRequest):
{ title?: string, isbn?: string, author?: string, language?: string }
  — either title or isbn is required (non-empty string)
  — isbn must be 10 or 13 digits after stripping "-" and whitespace

Response 200 (ApiResponse<MetadataResult[]>):
{ success: true, data: MetadataResult[], timestamp, responseTime }

MetadataResult:
{ metadata: Metadata, providerName: string, providerLabel: string, confidence: number }

Error responses: 400 (validation), 403 (bad/forbidden API key), 404 (not found),
429 (provider rate limit), 500 (unexpected) — same ApiResponse envelope with
success: false and an error string.
```
Full types: [src/services/metadata/types.ts](src/services/metadata/types.ts).

### Externalization options
| Option | Notes |
|---|---|
| **Fold into the existing Visualible backend** | The app already talks to an external API for auth/marketplace/EPUB storage (`NEXT_PUBLIC_MARKETPLACE_HOST`, `NEXT_PUBLIC_AWS_HOST` — see [src/services/visualible/](src/services/visualible/)). Adding a `/metadata/search` endpoint there keeps one external dependency instead of two, and keeps `GOOGLE_BOOKS_API_KEYS` alongside the rest of the backend's secrets. |
| **Standalone Cloudflare Worker / Node service** | Lift `MetadataService` + its two providers almost verbatim (they're already framework-agnostic — no Next.js imports inside `src/services/metadata/**`). Lowest code-diff option. |
| **Vendor-hosted function (Vercel/Netlify/Lambda)** | Same code lift as above, different deploy target. |

**Recommendation:** fold into the Visualible backend if that's where new
backend work is already landing (per the ongoing auth/EPUB migration) —
otherwise the standalone-Worker path is a near-zero-rewrite lift of
`src/services/metadata/`.

---

## 2. Edge TTS proxy — `/api/tts/edge` (`POST` + `GET`)

**File:** [src/app/api/tts/edge/route.ts](src/app/api/tts/edge/route.ts)
**Library:** [src/libs/edgeTTS.ts](src/libs/edgeTTS.ts) (`EdgeSpeechTTS`, 358+ lines — voice list, WebSocket protocol to Microsoft's Edge TTS service, word-boundary parsing)
**Called from:** [src/services/tts/EdgeTTSClient.ts](src/services/tts/EdgeTTSClient.ts), [src/services/tts/wordPronouncer.ts](src/services/tts/wordPronouncer.ts)

### What it does
- `POST` — takes `{ input, voice, speed?, rate?, lang? }`, calls
  `EdgeSpeechTTS.createWithBoundaries()`, and streams back an MP3
  (`audio/mpeg`) with a custom `x-word-boundaries`-style header
  (`WORD_BOUNDARIES_HEADER`) carrying word-timing data — dropped if it would
  exceed ~8KB (proxy header-size limits).
- `GET` — lists available voices, optionally filtered by `?lang=`.

### Why it can't just move client-side
It's not a secret-holding endpoint like metadata search, but it talks to
Microsoft's Edge TTS service over a **WebSocket protocol** that isn't
callable directly from a browser the same way the server does it (and moving
that protocol logic client-side would re-implement a fair chunk of
`edgeTTS.ts`'s server-side plumbing in the browser, plus lose the "single
choke point to rate-limit/monitor TTS usage" property). Treat it the same as
the metadata route: a small stateless proxy that has to live somewhere with a
server runtime.

### Contract to preserve
```
POST <base>/tts/edge
Content-Type: application/json
{ input: string, voice: string, speed?: number (0.25–4.0), rate?: number, lang?: string }
  → 200, Content-Type: audio/mpeg, body = MP3 bytes
    header "x-word-boundaries" (name per WORD_BOUNDARIES_HEADER) present when small enough
  → 400 on missing/invalid input/voice, or unknown voice id
  → 500 on synthesis failure

GET <base>/tts/edge?lang=<optional>
  → 200 { voices: [{ id, name, language }] }
  → 500 on unexpected failure
```

### Externalization options
Same three options as the metadata route. This one is more self-contained
(no external secret), so it's an easy first candidate to lift into a
standalone Worker/Lambda if the team wants to validate the externalization
pattern before doing the metadata route too.

---

## Client-side follow-up (both routes)

Once both are moved, update [src/services/environment.ts](src/services/environment.ts)
so `getAPIBaseUrl()` (or a new dedicated getter, if the TTS/metadata backends
end up at different hosts) points at the new location instead of assuming
same-origin `/api`. Everything downstream (`searchMetadata()`, `EdgeTTSClient`)
already goes through that one function, so this is a single-seam change.

If CORS becomes cross-origin for real (client on `web.readest.com`, API on a
different host), the allow-list currently enforced in
[src/middleware.ts](src/middleware.ts) needs to be re-implemented on
whichever server ends up hosting these two routes — see the "Decisions to
make" section in STATIC_EXPORT_ANALYSIS.md for the origin list itself.
