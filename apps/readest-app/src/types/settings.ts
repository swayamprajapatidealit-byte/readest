import { CustomTheme } from '@/styles/themes';
import { CustomFont } from '@/styles/fonts';
import { CustomTexture } from '@/styles/textures';
import { HighlightColor, HighlightStyle, UserHighlightColor, ViewSettings } from './book';
import type { DictionarySettings, ImportedDictionary } from '@/services/dictionaries/types';

export type ThemeType = 'light' | 'dark' | 'auto';
export type LibraryViewModeType = 'grid' | 'list';
export const LibrarySortByType = {
  Title: 'title',
  Author: 'author',
  Updated: 'updated',
  Created: 'created',
  Series: 'series',
  Size: 'size',
  Published: 'published',
  Progress: 'progress',
  TimeRemaining: 'timeRemaining',
} as const;

export type LibrarySortByType = (typeof LibrarySortByType)[keyof typeof LibrarySortByType];

/**
 * Secondary sort key. Same options as the primary sort key plus `'none'` which
 * disables the secondary sort. When set to `'none'` and a smart default applies
 * (e.g. groupBy=Author -> series), the resolver in `libraryUtils` substitutes
 * the implicit default at sort time without persisting it. See
 * `resolveEffectiveSecondarySort`.
 */
export type LibrarySecondarySortByType = LibrarySortByType | 'none';

export type LibraryCoverFitType = 'crop' | 'fit';

export const LibraryGroupByType = {
  None: 'none',
  Group: 'group',
  Series: 'series',
  Author: 'author',
  Tag: 'tag',
  Subject: 'subject',
} as const;

export type LibraryGroupByType = (typeof LibraryGroupByType)[keyof typeof LibraryGroupByType];

export interface ReadSettings {
  sideBarWidth: string;
  isSideBarPinned: boolean;
  notebookWidth: string;
  isNotebookPinned: boolean;
  /**
   * Global Word Lens toggle: auto-download a gloss pack on demand when the
   * pair isn't cached locally. When off, the reader never fetches packs
   * silently; users download them explicitly from the Word Lens sub-page.
   */
  wordLensAutoDownload: boolean;
  highlightStyle: HighlightStyle;
  highlightStyles: Record<HighlightStyle, HighlightColor>;

  customHighlightColors: Record<HighlightColor, string>;
  userHighlightColors: UserHighlightColor[];
  defaultHighlightLabels: Partial<Record<HighlightColor, string>>;
  customTtsHighlightColors: string[];
  customThemes: CustomTheme[];
}

/**
 * Readest Cloud's own library-sync switch. Readest Cloud used to be the
 * derived fallback — "on" whenever no third-party provider was enabled —
 * because exactly one provider could own the library channels. Providers are
 * now independently selectable (#5062), so Readest Cloud needs a flag of its
 * own.
 *
 * `enabled` is DELIBERATELY optional with no default (this slice must never
 * enter `DEFAULT_SYSTEM_SETTINGS`): an absent value falls back to the old
 * derivation, so upgrading users keep exactly the behaviour they had and no
 * migration has to rewrite anyone's settings. It is written only once the user
 * touches a Cloud Sync checkbox.
 *
 * Device-local, like the other providers' `enabled` flags.
 */
export interface ReadestCloudSettings {
  enabled?: boolean;
  /**
   * Device-local wall-clock millis of when this device turned Readest Cloud
   * off. Anchors the mixed-fleet probe: a native /api/sync row newer than this
   * means another device is still writing the channels this one stopped
   * writing. Excluded from cross-device restore.
   */
  disabledAt?: number;
}

export interface KeyBinding {
  /** `native` = media keys forwarded by the OS bridge; `dom` = keyboard/D-pad keys. */
  source: 'native' | 'dom';
  /** Native key name (e.g. `MediaNext`) or DOM `event.code` (e.g. `ArrowLeft`). */
  id: string;
  /** Human-readable label shown in settings. */
  label: string;
}

export interface HardwarePageTurnerSettings {
  enabled: boolean;
  bindings: {
    pagePrev: KeyBinding | null;
    pageNext: KeyBinding | null;
    sectionPrev: KeyBinding | null;
    sectionNext: KeyBinding | null;
    /** E-ink full screen refresh (clears ghosting). Optional: absent on settings persisted before the feature existed. */
    refresh?: KeyBinding | null;
  };
}

export interface SystemSettings {
  version: number;
  migrationVersion: number;
  localBooksDir: string;
  customRootDir?: string;
  /**
   * Absolute paths the user has registered as "external library folders" —
   * directories managed by the user (or another reader app, e.g. Duokan,
   * Calibre, Moon+ Reader) that Readest should read in place instead of
   * copying into Books/<hash>/. Each entry must be an absolute path; entries
   * are matched as path-prefix roots when ingesting a file. Device-local
   * (path is meaningful only on this filesystem) and excluded from cloud
   * settings backups via `BACKUP_SETTINGS_BLACKLIST`.
   */
  externalLibraryFolders?: string[];
  /**
   * Absolute paths of the external library folders the user has opted into
   * auto-import for. On library open and whenever the app regains focus,
   * Readest re-scans each of these and imports any newly-added book files.
   * A subset of {@link externalLibraryFolders} (auto-import requires the
   * folder to be read in place). Set per-folder from the Import-from-Folder
   * dialog. Desktop + Android only. Device-local (paths are meaningful only
   * on this filesystem) and excluded from cloud settings backups via
   * `BACKUP_SETTINGS_BLACKLIST`.
   */
  autoImportFolders?: string[];
  /**
   * The subset of {@link autoImportFolders} the user imported with "Import all
   * into library" (flatten). Auto-imported books from those folders go straight
   * to the library root; every other watched folder mirrors its subfolders as
   * groups, matching the dialog's default "Create groups from subfolders" —
   * which is also what a folder watched before this list existed falls back to.
   * Device-local, and excluded from cloud settings backups alongside
   * {@link autoImportFolders}.
   */
  autoImportFlattenFolders?: string[];

  alwaysOnTop: boolean;
  openBookInNewWindow: boolean;
  autoCheckUpdates: boolean;
  updateChannel: 'stable' | 'nightly';
  screenWakeLock: boolean;
  autohideCursor: boolean;
  screenBrightness: number;
  hardwarePageTurner: HardwarePageTurnerSettings;
  openLastBooks: boolean;
  lastOpenBooks: string[];
  autoImportBooksOnOpen: boolean;
  savedBookCoverForLockScreen: string;
  savedBookCoverForLockScreenPath: string;
  telemetryEnabled: boolean;
  libraryViewMode: LibraryViewModeType;
  librarySortBy: LibrarySortByType;
  librarySortAscending: boolean;
  /**
   * Whether the primary sort uses a smart default derived from `libraryGroupBy`.
   * When `true` and grouping by Series, the effective primary sort becomes
   * Series at sort time (the stored `librarySortBy` is left unchanged so users
   * who later turn auto off keep their previous explicit pick). Flipped to
   * `false` the moment the user picks any primary sort in the menu.
   */
  librarySortByAuto: boolean;
  libraryThenSortBy: LibrarySecondarySortByType;
  /** Sort order of the secondary ("Then by") key, independent of `librarySortAscending` (#5119). */
  libraryThenSortAscending: boolean;
  libraryGroupBy: LibraryGroupByType;
  libraryCoverFit: LibraryCoverFitType;
  libraryAutoColumns: boolean;
  libraryColumns: number;
  librarySkeuomorphicCovers: boolean;
  /** Show the recently-read carousel at the top of the library (issue #3797). */
  libraryRecentShelfEnabled: boolean;
  /**
   * Library page background texture, configured independently from the reader
   * background (issue #4743). When any of these is undefined the library
   * inherits the corresponding `globalViewSettings.background*` value, so an
   * existing user's bookshelf looks unchanged until they pick a library
   * texture. Device-local (the texture *selection* never syncs, matching the
   * reader's `backgroundTextureId`); only the imported image binaries sync via
   * the `texture` replica kind. Resolved by `getLibraryViewSettings`.
   */
  libraryBackgroundTextureId?: string;
  libraryBackgroundOpacity?: number;
  libraryBackgroundSize?: string;
  customFonts: CustomFont[];
  customTextures: CustomTexture[];
  customDictionaries: ImportedDictionary[];
  dictionarySettings: DictionarySettings;
  metadataSeriesCollapsed: boolean;
  metadataOthersCollapsed: boolean;
  metadataDescriptionCollapsed: boolean;

  /** Optional by design — see {@link ReadestCloudSettings}. Never defaulted. */
  readestCloud?: ReadestCloudSettings;

  /**
   * Per-device id used as the deviceId portion of every HLC this device
   * mints. Lazy-generated on first sync init via uuidv4.
   */
  replicaDeviceId?: string;

  // Global read settings that apply to the reader page
  globalReadSettings: ReadSettings;
  // Global view settings that apply to all books, and can be overridden by book-specific view settings
  globalViewSettings: ViewSettings;
}
