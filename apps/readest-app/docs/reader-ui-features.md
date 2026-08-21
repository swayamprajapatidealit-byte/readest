# Reader UI Feature Map

Complete inventory of every reader-related screen, panel, menu, and option, organized
by where it lives in the UI. Use this as a checklist when touching reader UI so no
existing feature gets dropped or orphaned. Paths are relative to
`apps/readest-app/src/` unless noted.

Update this file whenever a reader UI feature is added, removed, or moved.

---

## 1. Reader Page Shell

- `app/reader/components/Reader.tsx` — page root
  - Mounts always-present overlays: `AboutWindow`, `KeyboardShortcutsHelp`, `ProofreadRulesManager`, `Toast`
- `app/reader/components/ReaderContent.tsx` — loads book(s), owns close/save-on-exit
  - Renders `SideBar`, `BooksGrid`, `SettingsDialog`, `Notebook`, `EntityPanel`, `BookDetailModal`
- `app/reader/components/BooksGrid.tsx` — multi-pane grid (split view / parallel read)
  - Per pane (`BookCell`): `HeaderBar`, `FoliateViewer`, `DoubleBorder`, `SectionInfo`, `HintInfo`, `ReadingRuler`, `ProgressBar`, `BookmarkPullDown` + `Ribbon`, `PageNavigationButtons`, `Annotator`, `SearchResultsNav`, `BooknotesNav`, `FootnotePopup`, `FooterBar`, `ReadingStatsTracker`
  - `SplitDivider` — draggable resize gutter between two panes (landscape, 2-pane only)
- `app/reader/components/FoliateViewer.tsx` — core pagination/rendering engine (not a control surface)
- `components/AtmosphereOverlay.tsx` — looping background video + day/night ambience audio (toggled via Theme > Mode selector re-click)

---

## 2. Header Bar — `app/reader/components/HeaderBar.tsx`

- [ ] Sidebar toggle (`SidebarToggler.tsx`)
- [ ] Close Book (secondary panes in split view only)
- [ ] Bookmark toggle (`BookmarkToggler.tsx`)
- [ ] Quick Action button (only if Behavior > Enable Quick Actions is on) → `QuickActionMenu.tsx`
- [ ] Book title display (+ Primary/Secondary badge in split view)
- [ ] Settings toggle (opens Settings dialog)
- [ ] Notebook toggle (`NotebookToggler.tsx`)
- [ ] View Options dropdown → `ViewMenu.tsx`
  - [ ] Zoom Level ± / reset (fixed-layout only)
  - [ ] Contrast ± / reset (fixed-layout only)
  - [ ] Zoom Mode: Single Page / Auto Spread / Vertical Scrolling / Horizontal Scrolling / Fit Page / Fit Width (fixed-layout only)
  - [ ] Separate Cover Page toggle (fixed-layout only)
  - [ ] Webtoon Mode toggle (fixed-layout only)
  - [ ] Font & Layout shortcut (opens Settings dialog)
  - [ ] Scrolled Mode toggle
  - [ ] Auto Scroll toggle (scrolled mode only)
  - [ ] Paragraph Mode toggle
  - [ ] Speed Reading Mode (starts RSVP)
  - [ ] Theme cycle: Auto / Light / Dark
  - [ ] Invert Image in Dark Mode toggle
  - [ ] Entity Icons submenu: Characters / Places / Glossary toggles

---

## 3. Footer Bar / Progress / Navigation

- `footerbar/FooterBar.tsx` — shell, desktop/mobile switch, nav handlers
- **Desktop** — `footerbar/DesktopFooterBar.tsx`
  - [ ] Prev Section / Next Section
  - [ ] Prev Page / Next Page
  - [ ] Go Back / Go Forward (history)
  - [ ] `PageJumpInput.tsx` — editable current/total page
  - [ ] Progress range slider
  - [ ] Speak (TTS) toggle
- **Mobile** — `footerbar/MobileFooterBar.tsx` + `NavigationBar.tsx` (bottom tabs)
  - [ ] TOC tab
  - [ ] Color tab → `ColorPanel.tsx` (theme swatches, light/dark/auto cycle)
  - [ ] Reading Progress tab → `NavigationPanel.tsx` (page jump, slider, prev/next section/page/history)
  - [ ] Font & Layout tab → `FontLayoutPanel.tsx` (quick Font Size / Page Margin / Line Spacing sliders)
  - [ ] Speak tab (TTS)
- Ambient overlays (always mounted, separate from FooterBar)
  - [ ] `ProgressBar.tsx` — `StickyProgressBar.tsx` fill + chapter ticks, remaining time/pages, `StatusInfo.tsx` (clock/battery), tap to dismiss
  - [ ] `PageNavigationButtons.tsx` — large edge tap zones for prev/next page & section
  - [ ] `SectionInfo.tsx` — chapter/section title band
  - [ ] `HintInfo.tsx` — transient hint toast
  - [ ] `BookmarkPullDown.tsx` + `Ribbon.tsx` — pull-to-bookmark gesture with ribbon flag
- `ZoomControls.tsx` — zoom/close/save rail (used by Image/Table viewers)

---

## 4. Sidebar — `app/reader/components/sidebar/`

- `SideBar.tsx` — pinned or floating panel, resizable, mobile full-screen sheet
- `Header.tsx`
  - [ ] Close (mobile)
  - [ ] Sidebar toggle
  - [ ] Search toggle
  - [ ] Book Menu dropdown (see below)
  - [ ] Pin/unpin
- `BookCard.tsx`
  - [ ] Cover/title/author display
  - [ ] "More Info" → `BookDetailModal`
- `SearchBar.tsx` — in-book text search
  - [ ] Clear
  - [ ] Options dropdown → `SearchOptions.tsx`
    - [ ] Scope: Book / Chapter
    - [ ] Mode: Contains / Whole Words / Regex / Nearby Words (+ within-N-words presets)
    - [ ] Match Case
    - [ ] Match Diacritics
  - [ ] Search history pill chips
- `TabNavigation.tsx` — TOC / Annotate / Bookmark tabs
- `TOCView.tsx` / `TOCItem.tsx`
  - [ ] Virtualized tree, expand/collapse
  - [ ] Jump to chapter
  - [ ] Current-position indicator row
- `BooknoteView.tsx` / `BooknoteItem.tsx` — grouped bookmarks/annotations
  - [ ] Copy (Markdown deep-link)
  - [ ] Delete
  - [ ] Edit / Add Note (inline or opens Notebook)
  - [ ] `AnnotationsToolbar.tsx` (Annotate tab only): kind filter (All/Highlights/Notes), text search, color/style facet filters, reset
- `SearchResults.tsx` — collapsible per-chapter hit list with match highlighting
- `ContentNavBar.tsx` (shared) → `BooknotesNav.tsx` / `SearchResultsNav.tsx` — floating in-text prev/next steppers
- `BookMenu.tsx` — header hamburger dropdown
  - [ ] Parallel Read (submenu of recent books)
  - [ ] Split View toggle
  - [ ] Enter/Exit Parallel Read
  - [ ] Proofread → opens `ProofreadRules.tsx` manager
  - [ ] Export Annotations
  - [ ] Import Annotations
  - [ ] Clear Annotations
  - [ ] Sort TOC by Page toggle
  - [ ] Reload Page
  - [ ] Download Readest (web build only)
  - [ ] About Readest

---

## 5. Notebook Panel — `app/reader/components/notebook/`

- `Notebook.tsx` — resizable/pinnable slide-in panel
  - [ ] Excerpts list (collapsible, delete)
  - [ ] Active note editor
- `Header.tsx` — pin/unpin, close, search toggle
- `NoteEditor.tsx` — rich-text editor, quoted excerpt preview, Cancel/Save
- `SearchBar.tsx` — debounced note search with clear

---

## 6. Entity Panel — `app/reader/components/entity/`

- `EntityPanel.tsx` — resizable/pinnable, opened from in-text character/place/glossary/footnote markers
- `Header.tsx` — pin/unpin, close
- `Content.tsx`
  - [ ] `CharacterContent` — bio/motivations/conflicts/events, sources
  - [ ] `PlaceContent` — geography/context/significance
  - [ ] `GlossaryContent` — definition, in-book meaning, meaning-shift
  - [ ] `FootnoteContent`
  - [ ] Progressive fresh-vs-seen fact disclosure

---

## 7. Settings Dialog — `components/settings/SettingsDialog.tsx`

Shell: tab strip, search icon (opens Command Palette), overflow `DialogMenu.tsx`
(Global-vs-book-only toggle, Reset Panel, and on the Font tab: Clear/Manage Custom
Fonts), deep-linkable via `data-setting-id`.

### 7.1 Font — `FontPanel.tsx`
- [ ] Override Book Font
- [ ] Default Font Size
- [ ] Minimum Font Size
- [ ] Font Weight
- [ ] Default Font family (Serif/Sans dropdown — `FontDropDown.tsx`)
- [ ] CJK Font
- [ ] Serif Font Face
- [ ] Sans-Serif Font Face
- [ ] Monospace Font Face
- [ ] Manage Fonts → `CustomFonts.tsx` (import .ttf/.otf/.woff(2), grid select/delete)

### 7.2 Layout — `LayoutPanel.tsx`
- [ ] Override Book Layout
- [ ] Writing Mode: Default / Horizontal / Vertical / RTL
- [ ] Double Border toggle + color (vertical books)
- **Paragraph group**
  - [ ] Use Book Layout
  - [ ] Margin
  - [ ] Line Spacing
  - [ ] Word Spacing
  - [ ] Letter Spacing
  - [ ] Text Indent
  - [ ] Full Justification
  - [ ] Hyphenation
- **Page group**
  - [ ] Top/Bottom/Left/Right margins
  - [ ] Additional Margin %
  - [ ] Max Columns
  - [ ] Max Column Width / Height
- **Header & Footer group**
  - [ ] Show Header / Show Footer
  - [ ] Remaining Time
  - [ ] Remaining Pages
  - [ ] Reading Progress + style select + reference page count
  - [ ] Sticky Progress Bar
  - [ ] Current Time + 24h toggle
  - [ ] Battery Status + percentage display

### 7.3 Behavior (tab label "Control") — `ControlPanel.tsx`
- **Scroll group**
  - [ ] Scrolled Mode
  - [ ] Single-section scroll
  - [ ] Overlap px
  - [ ] Hide scrollbar
- **Pagination group**
  - [ ] Click to paginate
  - [ ] Swipe to paginate
  - [ ] Click both sides
  - [ ] Swap click sides
  - [ ] Disable double-click
  - [ ] Show nav buttons
  - [ ] `PageTurnerSettings.tsx` — custom hardware key bindings for prev/next page/section
- **Annotation Tools group**
  - [ ] Enable Quick Actions
  - [ ] Quick Action select
  - [ ] Copy to Notebook
  - [ ] Customize Toolbar → `AnnotationToolbarCustomizer.tsx` (drag-and-drop tool list)
- **Animation group**
  - [ ] Paging Animation toggle
  - [ ] Animation style: Push / Slide / Curl
- **Device group**
  - [ ] E-Ink Mode
  - [ ] Color E-Ink
  - [ ] Keep Screen Awake
  - [ ] Auto-hide Cursor
- **Security group**
  - [ ] Allow JavaScript
- **Privacy group**
  - [ ] Telemetry opt-in

### 7.4 Theme — `ThemePanel.tsx`
- [ ] `ThemeModeSelector.tsx` — Auto / Light / Dark (re-click active = atmosphere easter egg)
- [ ] Invert Image in Dark Mode
- [ ] Override Book Color
- [ ] `ThemeColorSelector.tsx` — swatch grid + `ThemeEditor.tsx` custom text/background/link colors per light/dark
- [ ] `BackgroundTextureSelector.tsx` — scope (Library/Reader), texture grid, opacity, size
- [ ] `HighlightColorsEditor.tsx` — 5 default + up to 10 custom colors, opacity
- [ ] `ReadingRulerSettings.tsx` — enable, lines-to-highlight, color, opacity
- [ ] `CodeHighlightingSettings.tsx` — enable, language
- [ ] `BookCoverSettings.tsx` — skeuomorphic covers toggle

### 7.5 Language — `LangPanel.tsx`
- [ ] UI Language select
- [ ] Manage Dictionaries → `CustomDictionaries.tsx`
  - [ ] Drag-sortable provider list: System / Wiktionary / Wikipedia / imported (StarDict, MDict, DICT, Slob, Babylon) / custom Web Search
  - [ ] Enable/edit/delete per provider
  - [ ] Font-size scale
- [ ] Word Lens → `WordLensPanel.tsx`
  - [ ] Enable
  - [ ] CEFR level slider
  - [ ] Target language
  - [ ] Hint size / color
  - [ ] Gloss data-pack download/delete
  - [ ] Auto-download toggle
- [ ] Replace Quotation Marks (CJK only)
- [ ] Simplified/Traditional Chinese conversion mode (CJK only)

### 7.6 TTS — `TTSPanel.tsx`
- [ ] `TTSHighlightStyleEditor.tsx` — granularity (Word/Sentence), style (Highlighter/Underline/Strikethrough/Squiggly/Outline), color + quick swatches
- [ ] Media Info: Player Style (Full/Minimal)
- [ ] Media Info: Update Frequency

### 7.7 Custom — `MiscPanel.tsx`
- [ ] Custom Content CSS editor
- [ ] Custom Reader UI CSS editor

Shared primitives: `components/settings/primitives/` (BoxedList, NavigationRow,
SectionTitle, SettingLabel, SettingsInput, SettingsRow, SettingsSelect,
SettingsSwitchRow, Tips), `NumberInput.tsx`, `SubPageHeader.tsx`.

---

## 8. Text Selection / Annotation / Dictionary — `app/reader/components/annotator/`

- `Annotator.tsx` — per-pane orchestrator for all selection-driven actions
- `AnnotationPopup.tsx` — selection toolbar shell, hosts one of:
  - `AnnotationTools.tsx` / `AnnotationToolButton.tsx`:
    - [ ] Copy
    - [ ] Copy Link
    - [ ] Highlight
    - [ ] Annotate
    - [ ] Search
    - [ ] Dictionary
    - [ ] Speak (TTS)
    - [ ] Proofread
    - [ ] Share
  - `HighlightOptions.tsx`:
    - [ ] Style: Highlight / Underline / Squiggly
    - [ ] Color strip (incl. custom colors)
    - [ ] Global-apply toggle
  - `AnnotationNotes.tsx` — existing note cards for the selection
- `AnnotationRangeEditor.tsx` / `SelectionRangeEditor.tsx` — drag handles to resize selection/highlight range, `MagnifierLoupe.tsx` on mobile
- Dictionary lookup — `DictionaryPopup.tsx` (desktop) / `DictionarySheet.tsx` (mobile) via `DictionaryResultsView.tsx`
  - [ ] Multi-provider parallel lookup
  - [ ] In-popup back/forward history
  - [ ] Pronounce/speak headword
  - [ ] "Search the web" provider section
  - [ ] Gear icon → jump to Language settings
- Proofread
  - [ ] `ProofreadPopup.tsx` — create replacement rule from selection (replace-with text, case-sensitive/whole-word/regex/only-for-TTS, scope selection/book/library)
  - [ ] `ProofreadRules.tsx` — full rules manager (add/edit/delete/reorder/enable-disable across Selected-Text and Book-Specific lists)
- `ExportMarkdownDialog.tsx`
  - [ ] Format: Markdown / Plain Text / JSON
  - [ ] Field toggles
  - [ ] Color/style filters
  - [ ] Custom template editor (Nunjucks-style) with reference panel + live preview
- `ImportAnnotationsDialog.tsx`
  - [ ] Readest JSON import
  - [ ] Moon+ Reader `.mrexpt` import
- `QuickActionMenu.tsx` — pick instant long-press action (also surfaced from HeaderBar)
- `FootnotePopup.tsx` (top-level, sibling dir)
  - [ ] Internal-link/footnote popup with nested embedded view
  - [ ] In-popup back navigation
  - [ ] Ctrl/Cmd+click → opens in new split-view pane
- `ImageViewer.tsx`
  - [ ] Zoom/pan/pinch
  - [ ] Double-click 1:1
  - [ ] Save image
  - [ ] Share
  - [ ] Prev/next (multi-image)
  - [ ] Caption toggle
- `TableViewer.tsx` — zoom/pan for embedded HTML tables (no save/share/pinch)

---

## 9. Text-to-Speech (Read Aloud) — `app/reader/components/tts/`

- `TTSControl.tsx` — orchestrator, "Back to Read Aloud" drift-reconnect pill
- `TTSMiniPlayer.tsx`
  - [ ] Full style: cover/title, prev/play-pause/next sentence, stop, sleep timer
  - [ ] Minimal style: speed gear, prev/next paragraph + sentence (no stop)
- `TTSPlayerSheet.tsx` — full bottom sheet
  - [ ] Main view: `TTSScrubber.tsx` seek bar, transport row, Speed/Voice/Sleep-Timer quick buttons
  - [ ] Speed sub-view: `SpeedRuler.tsx` / `TickRuler.tsx` (0.5×–3.0×)
  - [ ] Voice list, grouped by engine (incl. media-overlay narration)
  - [ ] Sleep Timer presets (No Timeout … 8 hours)
- `TTSFollowIndicator.tsx` — shared status pill (idle/following/paused/syncing/decoupled) — also used by RSVP and Paragraph mode

---

## 10. RSVP / Speed Reading — `app/reader/components/rsvp/`

- `RSVPControl.tsx` — orchestrator, incl. TTS read-along sync (word- or sentence-level)
- `RSVPStartDialog.tsx`
  - [ ] From Chapter Start
  - [ ] Resume
  - [ ] From Current Page
  - [ ] From Selection
- `RSVPOverlay.tsx` — full-screen
  - [ ] Chapter selector
  - [ ] WPM / audio-pace selector
  - [ ] TTS follow indicator
  - [ ] Collapsible context panel with click-to-seek + selection dictionary lookup
  - [ ] ORP-highlighted word display
  - [ ] Seekable progress bar
  - [ ] Transport: audio toggle, skip ±15 words, speed ±, prev/next word, play/pause
  - **Settings row**
    - [ ] Punctuation Delay
    - [ ] Start Delay
    - [ ] Font Size
    - [ ] Split Hyphenated Words
    - [ ] Character Mode
    - [ ] Highlight Word
    - [ ] Focus/ORP color

---

## 11. Paragraph Mode — `app/reader/components/paragraph/`

- `ParagraphControl.tsx` — orchestrator
- `ParagraphBar.tsx` — auto-hiding pill
  - [ ] Prev/next paragraph
  - [ ] Progress readout
  - [ ] TTS audio toggle
  - [ ] Font-size stepper
  - [ ] Exit
- `ParagraphOverlay.tsx` — full-screen single-paragraph focus view
  - [ ] Chapter-transition indicator
  - [ ] TTS follow indicator
  - [ ] Tap / wheel / swipe / keyboard navigation

---

## 12. Auto Scroll & Reading Ruler

- `AutoScrollControl.tsx` — auto-hiding pill
  - [ ] Slower / faster
  - [ ] Percentage readout
  - [ ] Play/pause
  - [ ] Exit
- `AutoScrollSpeedOverlay.tsx` — transient edge speed gauge during swipe-adjust gesture
- `ReadingRuler.tsx` — draggable reading-guide band
  - [ ] Line-snapping
  - [ ] Persisted position
  - [ ] Configurable line count / opacity / color (see Theme > Reading Ruler settings)

---

## 13. Global / Cross-Cutting Dialogs & Menus

- [ ] `components/KeyboardShortcutsHelp.tsx` — two-column shortcuts reference (toggle via `?`), link to online wiki
- [ ] `components/AboutWindow.tsx` — version info (copy to clipboard), support/legal links
- [ ] `components/command-palette/CommandPalette.tsx` + `CommandPaletteProvider.tsx` — fuzzy global launcher (settings/actions/navigation categories), recent items, keyboard nav
- [ ] `components/metadata/BookDetailModal.tsx` — view/edit metadata, delete/purge confirm, tag/subject click-through
- Shared chrome primitives: `components/Toast.tsx`, `components/Popup.tsx` (triangle-anchored popup base for all selection popups), `components/Dialog.tsx`, `components/Dropdown.tsx`, `components/Menu.tsx` / `MenuItem.tsx`
- `app/reader/hooks/useBookShortcuts.ts` — full in-reader keyboard shortcut map (page/section nav, zoom, TTS transport, bookmark/paragraph/RSVP/auto-scroll toggles, sidebar/notebook toggles, fullscreen, command palette, shortcuts help, reading-ruler move, etc.)

---

## 14. Ancillary / Background Behaviors

Not interactive panels, but user-visible and easy to forget when refactoring:

- [ ] `ReadingStatsTracker.tsx` — headless per-book reading-time/page-event tracker
- [ ] `DoubleBorder.tsx` — vertical-writing decorative page frame
- [ ] `Ribbon.tsx` — bookmark corner-flag indicator (paired with pull-to-bookmark gesture)

---

## Maintenance

When you add, remove, rename, or relocate a reader UI feature:
1. Update the corresponding checkbox/line in this file in the same PR.
2. If a whole panel or dialog is added, give it its own numbered section following
   the pattern above (component paths, then a checklist of its options).
