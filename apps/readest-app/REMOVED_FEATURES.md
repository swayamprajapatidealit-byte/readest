# Removed Features (Metadata Search & Edge TTS)

Two features were removed outright, rather than externalized, to unblock the
static-export migration described in [STATIC_EXPORT_ANALYSIS.md](STATIC_EXPORT_ANALYSIS.md):
**online metadata search** (Google Books / OpenLibrary lookup) and **Edge TTS**
(plus everything built on top of it). This is a temporary state — both are
meant to come back later, most likely re-hosted externally per
[API_EXTERNALIZATION.md](API_EXTERNALIZATION.md) — so this doc records exactly
what left, what's left behind, and what reinstating each one takes.

## 1. Metadata search

**What still works:** manual metadata editing (title/author/ISBN/etc. in the
book detail dialog) — untouched.

**What's gone:** the "Auto-Retrieve" button that searched Google
Books/OpenLibrary and let you pick a result to auto-fill fields.

**Deleted:**
- `src/app/api/metadata/search/route.ts` (the server route)
- `src/services/metadata/` (whole directory — `service.ts`, `types.ts`, `providers/{base,googlebooks,openlibrary,index}.ts`)
- `src/libs/metadata.ts` (`searchMetadata()`, the client-side caller)
- `src/components/metadata/SourceSelector.tsx` (the "pick a source" modal)

**Edited** (search-only code paths removed, manual editing left intact):
- `src/components/metadata/useMetadataEdit.ts` — dropped `handleAutoRetrieve`, `handleSourceSelection`, `handleCloseSourceSelection`, and their state (`searchLoading`, `showSourceSelection`, `availableSources`)
- `src/components/metadata/BookDetailModal.tsx` / `BookDetailEdit.tsx` — dropped the Auto-Retrieve button and the `SourceSelector` modal wiring
- `src/components/metadata/index.ts` — dropped the `SourceSelector`/`MetadataSource` exports

**`fieldSources`** (the "which provider filled this field" indicator) was left
in place — it's harmless now that nothing ever populates it (always empty),
and removing it would have meant also touching `FormField.tsx`'s
`SourceIndicator` for no functional gain.

**To reinstate:** rebuild `/metadata/search` per
[API_EXTERNALIZATION.md §1](API_EXTERNALIZATION.md#1-metadata-search--post-apimetadatasearch)
(fold into the Visualible backend or a standalone Worker), then restore
`searchMetadata()` + the `handleAutoRetrieve`/`handleSourceSelection` flow in
`useMetadataEdit.ts` and the button/modal in `BookDetailModal.tsx`/`BookDetailEdit.tsx`.
`git log --diff-filter=D -- apps/readest-app/src/components/metadata/SourceSelector.tsx`
(and the same for `src/libs/metadata.ts`) finds the commit that deleted them.

## 2. Edge TTS — and everything built on it

This one cascaded further than "remove one engine option." Edge TTS wasn't
just swappable through the generic `TTSClient` interface — several features
were hard-wired to the Edge client specifically, so removing it took those
down too:

- **Offline audio download** ("podcast"-style pre-download of chapters for
  offline playback) — it only ever worked because Edge TTS produced cacheable
  MP3s; no other engine supports it.
- **"Audio Cache" settings** (Settings → Read Aloud → Cache Synthesized Audio /
  Storage Limit) — configured the same Edge-only cache the downloader used.
- **Inter-sentence gap control** (`ttsSentenceGap`) — a passthrough that only
  the Edge client ever implemented; `WebSpeechClient`/`NativeTTSClient`/
  `MediaOverlayClient` all hardcoded it off.
- **Dictionary word-pronunciation's Edge-first path** — `wordPronouncer.ts`
  tried Edge (wss, then an authenticated https proxy through our own
  `/api/tts/edge`) before falling back to the platform speech client. Only the
  https leg needed our server; the wss leg talks straight to Microsoft from
  the browser. Removed anyway, per the "remove Edge TTS" decision — dictionary
  word pronunciation now always uses the platform speech client
  (`WebSpeechClient`/`NativeTTSClient`), the same fallback it used before.

**What still works:** Read Aloud with Web Speech, native platform TTS
(mobile), and recorded narration (EPUB 3 Media Overlays) — all untouched.
Paragraph-gap control (engine-agnostic, unlike sentence-gap) still works.
Dictionary word pronunciation still works, just without the Edge-quality
voice.

**Deleted:**
- `src/app/api/tts/edge/route.ts` (the server route)
- `src/libs/edgeTTS.ts` (`EdgeSpeechTTS`, the WebSocket/https client for Microsoft's Edge TTS service)
- `src/services/tts/EdgeTTSClient.ts`, `BufferedTTSClient.ts`, `NativeAudioPlayer.ts` (the Edge engine + its iOS AVPlayer playout path)
- `src/services/tts/providers/` (whole directory — `edge.ts`, `cache.ts`, `bookCacheStore.ts`, `sqliteCacheStore.ts`, `cacheSweep.ts`, `opfsPackFs.ts`, `types.ts` — all Edge-only cache/provider infrastructure)
- `src/services/tts/TTSDownloader.ts`, `downloadChapters.ts` (offline-download engine + chapter derivation)
- `src/app/reader/hooks/useTTSDownloads.ts`, `src/app/reader/components/tts/TTSChaptersView.tsx`, `DownloadBadge.tsx` (offline-download UI)
- `src/services/tts/TTSAudioPlayer.ts`, and the `WebAudioPlayer` class in `src/services/tts/WebAudioPlayer.ts` — a consequence, not a target: this gapless chunk scheduler existed solely to feed Edge audio into the Web Audio API. With `BufferedTTSClient` gone it had zero remaining instantiators, so it was dead code. `WebAudioPlayer.ts` still exists for the shared-AudioContext + background-keep-alive-tone utilities (`ensureSharedAudioContext`/`startAudioKeepAlive`/`stopAudioKeepAlive`), which are unrelated and still used by every engine.

**Edited:**
- `src/services/tts/wordPronouncer.ts` — dropped the Edge attempt; always goes straight to `WebSpeechClient`/`NativeTTSClient`
- `src/app/reader/components/annotator/DictionaryResultsView.tsx` — dropped the now-unnecessary `warmWordAudio()` call
- `src/services/tts/index.ts` — dropped the `EdgeTTSClient` export
- `src/services/tts/TTSController.ts` — removed `ttsEdgeClient`/`ttsEdgeVoices`, and every method that only existed to proxy to it: `canDownload()`, `getTTSDownloader()`, `getSectionCacheStatuses()`, `getCacheBytes()`, `supportsGapControl()`, `setSentenceGap()`. `getVoices()`/`setVoice()`/`setPrimaryLang()`/`shutdown()`/`init()` lost their Edge branches.
- `src/services/tts/ttsDuration.ts` — dropped `hydrateProvisionalDurations` (only ever called to hydrate the now-deleted download cache into the scrubber timeline)
- `src/services/tts/TTSClient.ts` (+ `WebSpeechClient.ts`, `NativeTTSClient.ts`, `mediaOverlay/MediaOverlayClient.ts`) — dropped the `gapControl` capability flag and the `registerSectionManifest?`/`getSectionDurations?` optional hooks (only `BufferedTTSClient` ever implemented any of the three)
- `src/app/reader/hooks/useTTSControl.ts` — dropped `handleSetSentenceGap`, the `setSentenceGap` call in the speak path, and `getController` (its only consumer was `useTTSDownloads`)
- `src/app/reader/components/tts/TTSPlayerSheet.tsx` / `TTSControl.tsx` — dropped the `downloads`/`activeSectionIndex` props, the "Offline Audio" row and `chapters` sub-view, and the sentence-gap half of the rate-change handler (paragraph-gap half kept)
- `src/components/settings/TTSPanel.tsx` — dropped the "Audio Cache" `BoxedList` section
- `src/services/constants.ts`, `src/types/book.ts` — dropped `ttsSentenceGap` from `TTSConfig`/`DEFAULT_TTS_CONFIG`

**Left in place, now dormant (not removed):** word-level highlighting
(`TTSCapabilities.wordBoundaries`, `TTSController#prepareSpeakWords`/`#dispatchSpeakWord`,
the "Highlight: word vs sentence" setting) was already gated purely on a
generic capability flag, never on Edge's identity — Edge just happened to be
the only client that ever set `wordBoundaries: true`. It's architecturally
ready for any future word-boundary-capable engine, so it was left alone rather
than ripped out; today it simply never activates (every remaining client
reports `wordBoundaries: false`), and the "word" highlight setting silently
behaves like "sentence."

**To reinstate:**
1. Rebuild `/api/tts/edge` per
   [API_EXTERNALIZATION.md §2](API_EXTERNALIZATION.md#2-edge-tts-proxy--apittsedge-post--get).
2. Restore `libs/edgeTTS.ts`, `EdgeTTSClient.ts`, `BufferedTTSClient.ts`,
   `NativeAudioPlayer.ts`, `TTSAudioPlayer.ts`, and `services/tts/providers/`
   from git history — `git log --diff-filter=D --oneline -- 'apps/readest-app/src/services/tts/EdgeTTSClient.ts'`
   finds the deleting commit; `git show <commit>^:apps/readest-app/src/services/tts/EdgeTTSClient.ts`
   recovers the pre-deletion content for any of the files above.
3. Re-wire `TTSController` (constructor, `init()`, `getVoices()`, `setVoice()`,
   `setPrimaryLang()`, `shutdown()`) the same way `ttsWebClient`/`ttsNativeClient`
   are wired today — the removal diff is the wiring pattern to reverse.
4. Offline audio download and the Audio Cache settings panel have no
   surviving stub to restore from within this repo — they'd need rebuilding
   from the deleted files' git history (`TTSDownloader.ts`, `downloadChapters.ts`,
   `useTTSDownloads.ts`, `TTSChaptersView.tsx`, `DownloadBadge.tsx`, and the
   "Audio Cache" block in `TTSPanel.tsx`), re-wired the same way.
5. Sentence-gap control: restore `gapControl`/`setSentenceGap`/`ttsSentenceGap`
   the same way, or reconsider whether it's worth keeping Edge-exclusive again.
