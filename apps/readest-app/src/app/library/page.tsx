'use client';

import clsx from 'clsx';
import * as React from 'react';
import { MdChevronRight, MdClose } from 'react-icons/md';
import { useState, useRef, useEffect, Suspense, useCallback } from 'react';
import { ReadonlyURLSearchParams, useSearchParams } from 'next/navigation';

import { Book, BooksGroup, type LibrarySearchConfig } from '@/types/book';
import { AppService } from '@/types/system';
import { buildBookLookupIndex } from '@/services/bookService';
import { debounce } from '@/utils/debounce';
import { DEFAULT_NEARBY_WORDS } from '@/utils/searchConfig';
import { clearLibrarySearchHistory, loadLibrarySearchHistory } from './utils/searchHistory';
import type { LibrarySearchTarget } from '@/types/book';
import { navigateToLibrary, navigateToReader } from '@/utils/nav';
import { getBookWithUpdatedMetadata, listFormater } from '@/utils/book';
import { getImportErrorMessage } from '@/services/errors';
import { ingestFile } from '@/services/ingestService';
import { eventDispatcher } from '@/utils/event';
import { getFilename } from '@/utils/path';
import { parseOpenWithFiles } from '@/helpers/openWith';
import { isTauriAppPlatform, isWebAppPlatform } from '@/services/environment';

import { useEnv } from '@/context/EnvContext';
import { useThemeStore } from '@/store/themeStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useLibraryStore } from '@/store/libraryStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useResponsiveSize } from '@/hooks/useResponsiveSize';
import { useTheme } from '@/hooks/useTheme';
import { useUICSS } from '@/hooks/useUICSS';
import { useDemoBooks } from './hooks/useDemoBooks';
import { useBookDataStore } from '@/store/bookDataStore';
import { useBackgroundTexture } from '@/hooks/useBackgroundTexture';
import { getLibraryViewSettings } from '@/helpers/settings';
import { useAppUrlIngress } from '@/hooks/useAppUrlIngress';
import { useOpenWithBooks } from '@/hooks/useOpenWithBooks';
import { useOpenAnnotationLink } from '@/hooks/useOpenAnnotationLink';
import { useOpenBookLink } from '@/hooks/useOpenBookLink';
import { SelectedFile, useFileSelector } from '@/hooks/useFileSelector';
import { tauriHandleClose, tauriHandleToggleFullScreen, tauriQuitApp } from '@/utils/window';

import { LibraryGroupByType } from '@/types/settings';
import { BookMetadata } from '@/libs/document';
import { AboutWindow } from '@/components/AboutWindow';
import { KeyboardShortcutsHelp } from '@/components/KeyboardShortcutsHelp';
import { BookDetailModal } from '@/components/metadata';
import { BackupWindow } from './components/BackupWindow';
import { useDragDropImport } from './hooks/useDragDropImport';
import { useAppRouter } from '@/hooks/useAppRouter';
import { Toast } from '@/components/Toast';
import {
  createBookGroups,
  ensureLibraryGroupByType,
  findGroupById,
  getBreadcrumbs,
} from './utils/libraryUtils';
import Spinner from '@/components/Spinner';
import LibraryHeader from './components/LibraryHeader';
import Bookshelf from './components/Bookshelf';
import LibraryEmptyState from './components/LibraryEmptyState';
import ImportMenuPopup from './components/ImportMenuPopup';
import GroupHeader from './components/GroupHeader';
import FailedImportsDialog, { FailedImport } from './components/FailedImportsDialog';
import NowPlayingBar from './components/NowPlayingBar';
import { ttsSessionManager } from '@/services/tts';
import useShortcuts from '@/hooks/useShortcuts';
import { useCustomFonts } from '@/hooks/useCustomFonts';
import DropIndicator from '@/components/DropIndicator';
import SettingsDialog from '@/components/settings/SettingsDialog';

const LIBRARY_SEARCH_MODES: LibrarySearchConfig['mode'][] = [
  'contains',
  'whole-words',
  'regex',
  'nearby-words',
  'fuzzy',
];

const getLibrarySearchConfig = (
  searchParams: ReadonlyURLSearchParams | null,
): LibrarySearchConfig => {
  const modeParam = searchParams?.get('mode') as LibrarySearchConfig['mode'] | null;
  const nearbyParam = Number(searchParams?.get('nearby'));
  return {
    scope: 'book',
    mode: modeParam && LIBRARY_SEARCH_MODES.includes(modeParam) ? modeParam : 'contains',
    matchCase: searchParams?.get('matchCase') === 'true',
    matchDiacritics: searchParams?.get('matchDiacritics') === 'true',
    nearbyWords:
      Number.isFinite(nearbyParam) && nearbyParam > 0 ? nearbyParam : DEFAULT_NEARBY_WORDS,
  };
};

const LibraryPageWithSearchParams = () => {
  const searchParams = useSearchParams();
  return <LibraryPageContent searchParams={searchParams} />;
};

const LibraryPageContent = ({ searchParams }: { searchParams: ReadonlyURLSearchParams | null }) => {
  const router = useAppRouter();
  const { envConfig, appService } = useEnv();
  const {
    library: libraryBooks,
    libraryLoaded: libraryLoadedFromDisk,
    updateBook,
    updateBooks,
    setLibrary,
    getGroupId,
    getGroupName,
    checkOpenWithBooks,
    checkLastOpenBooks,
    setCheckOpenWithBooks,
    setCheckLastOpenBooks,
  } = useLibraryStore();
  const _ = useTranslation();
  const { selectFiles } = useFileSelector(_);
  const { safeAreaInsets: insets } = useThemeStore();
  const { clearBookData } = useBookDataStore();
  const { settings, setSettings } = useSettingsStore();
  const { isSettingsDialogOpen, setSettingsDialogOpen } = useSettingsStore();
  // Hydrate the custom-font store from persisted settings so the Font
  // panel sees imported fonts even when opened straight from the
  // library — the reader's FoliateViewer hydration never runs without a
  // book open.
  useCustomFonts();
  const [importMenuAnchor, setImportMenuAnchor] = useState<HTMLElement | null>(null);
  const [loading, setLoading] = useState(false);
  // Seed from the library store: if we already have books in memory (the
  // common reader → library return path), treat the page as loaded
  // immediately. This prevents `showBookshelf` from briefly being false on
  // remount, which used to flash a placeholder before `initLibrary` finished.
  const [libraryLoaded, setLibraryLoaded] = useState(() => libraryBooks.length > 0);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [isSelectAll, setIsSelectAll] = useState(false);
  const [isSelectNone, setIsSelectNone] = useState(false);
  const [librarySearchQuery, setLibrarySearchQuery] = useState(searchParams?.get('q') ?? '');
  const pendingLibrarySearchQueryRef = useRef<string | null>(null);
  const [librarySearchProgress, setLibrarySearchProgress] = useState<number | null>(null);
  const [librarySearchHistory, setLibrarySearchHistory] = useState<string[]>([]);
  const [librarySearchTarget, setLibrarySearchTarget] = useState<LibrarySearchTarget>(() =>
    ['contents', 'text'].includes(searchParams?.get('search') ?? '') ? 'text' : 'books',
  );
  const [librarySearchConfig, setLibrarySearchConfig] = useState<LibrarySearchConfig>(() =>
    getLibrarySearchConfig(searchParams),
  );
  useEffect(() => {
    if (librarySearchTarget === 'text' && !librarySearchQuery.trim()) {
      setLibrarySearchHistory(loadLibrarySearchHistory());
    }
  }, [librarySearchTarget, librarySearchQuery]);
  const librarySearchTargetRef = useRef(librarySearchTarget);
  const librarySearchConfigRef = useRef(librarySearchConfig);
  const [showDetailsBook, setShowDetailsBook] = useState<Book | null>(null);
  const [failedImportsModal, setFailedImportsModal] = useState<FailedImport[] | null>(null);
  const [currentGroupPath, setCurrentGroupPath] = useState<string | undefined>(undefined);
  const [currentVirtualGroup, setCurrentVirtualGroup] = useState<{
    groupBy:
      | typeof LibraryGroupByType.Series
      | typeof LibraryGroupByType.Author
      | typeof LibraryGroupByType.Tag
      | typeof LibraryGroupByType.Subject;
    groupName: string;
  } | null>(null);
  const [pendingNavigationBookIds, setPendingNavigationBookIds] = useState<string[] | null>(null);
  const isInitiating = useRef(false);

  const iconSize = useResponsiveSize(18);
  const viewSettings = settings.globalViewSettings;
  const demoBooks = useDemoBooks();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const handleScrollerRef = useCallback((el: HTMLDivElement | null) => {
    scrollRef.current = el;
  }, []);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  const getScrollKey = (group: string) => `library-scroll-${group || 'all'}`;

  const saveScrollPosition = (group: string) => {
    if (scrollRef.current) {
      sessionStorage.setItem(getScrollKey(group), scrollRef.current.scrollTop.toString());
    }
  };

  const restoreScrollPosition = useCallback((group: string) => {
    const savedPosition = sessionStorage.getItem(getScrollKey(group));
    if (savedPosition && scrollRef.current) {
      scrollRef.current.scrollTop = parseInt(savedPosition, 10);
    }
  }, []);

  useTheme({ appThemeColor: 'base-200' });
  useUICSS();

  // Apply the library's own background texture (separate from the reader's,
  // issue #4743). Re-applies on mount so returning from a textured book
  // restores the library background, and whenever the library texture — or the
  // reader/global texture it inherits when unset — changes from the Color panel.
  const { applyBackgroundTexture } = useBackgroundTexture();
  useEffect(() => {
    applyBackgroundTexture(envConfig, getLibraryViewSettings(settings));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    envConfig,
    applyBackgroundTexture,
    settings.libraryBackgroundTextureId,
    settings.libraryBackgroundOpacity,
    settings.libraryBackgroundSize,
    settings.globalViewSettings?.backgroundTextureId,
    settings.globalViewSettings?.backgroundOpacity,
    settings.globalViewSettings?.backgroundSize,
  ]);

  useAppUrlIngress();
  useOpenWithBooks();
  useOpenAnnotationLink();
  useOpenBookLink();

  const { isDragging } = useDragDropImport();

  useShortcuts({
    onToggleFullscreen: async () => {
      if (isTauriAppPlatform()) {
        await tauriHandleToggleFullScreen();
      }
    },
    onCloseWindow: async () => {
      if (isTauriAppPlatform()) {
        await tauriHandleClose();
      }
    },
    onQuitApp: async () => {
      if (isTauriAppPlatform()) {
        await tauriQuitApp();
      }
    },
    onOpenFontLayoutSettings: () => {
      setSettingsDialogOpen(true);
    },
    onOpenBooks: () => {
      handleImportBooksFromFiles();
    },
  });

  useEffect(() => {
    const snapshot = searchParams?.toString() || '';
    if (snapshot !== new URLSearchParams(window.location.search).toString()) return;
    sessionStorage.setItem('lastLibraryParams', snapshot);
  }, [searchParams]);

  // Strip the empty `group=` param that `handleLibraryNavigation` sets as a
  // workaround for a Next.js 16.2 static-export regression (see the NOTE
  // above `handleLibraryNavigation` for full context). This effect runs
  // after the router.replace() has committed, so React has already
  // re-rendered with the new (empty) group state; we're only rewriting the
  // URL cosmetically via window.history.replaceState — Next.js' patched
  // replaceState will pick up the new canonical URL without triggering
  // another navigation.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (searchParams?.get('group') !== '') return;
    const url = new URL(window.location.href);
    url.searchParams.delete('group');
    const cleanHref = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(null, '', cleanHref);
  }, [searchParams]);

  // Unified navigation function that handles scroll position and direction.
  // Workaround for a Next.js 16.2 static-export regression: navigating to a
  // same-pathname URL with an empty search string causes `router.replace()`
  // to silently no-op (e.g. `/library?group=foo` -> `/library`), which broke
  // the breadcrumb "All" button. By always calling `params.set('group',
  // targetGroup)` — including when `targetGroup` is an empty string — the
  // resulting URL becomes `/library?group=` instead of `/library`, which
  // Next.js does commit. The trailing empty `group=` is stripped via a
  // cleanup effect below (purely cosmetic URL rewrite). See
  // https://github.com/readest/readest/issues/3782.
  const handleLibraryNavigation = useCallback(
    (targetGroup: string) => {
      const params = new URLSearchParams(window.location.search);
      const currentGroup = params.get('group') || '';

      // Save current scroll position BEFORE navigation
      saveScrollPosition(currentGroup);

      // Detect and set navigation direction
      const direction = currentGroup && !targetGroup ? 'back' : 'forward';
      document.documentElement.setAttribute('data-nav-direction', direction);

      // Build query params — always `set` so the search string is non-empty
      // even when targetGroup is '' (the Next.js 16.2 workaround).
      params.set('group', targetGroup);

      navigateToLibrary(router, `${params.toString()}`);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router],
  );

  const handleImportBookFiles = useCallback(async (event: CustomEvent) => {
    const selectedFiles: SelectedFile[] = event.detail.files;
    const groupId: string = event.detail.groupId || '';
    if (selectedFiles.length === 0) return;
    await importBooks(selectedFiles, groupId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    eventDispatcher.on('import-book-files', handleImportBookFiles);
    return () => {
      eventDispatcher.off('import-book-files', handleImportBookFiles);
    };
  }, [handleImportBookFiles]);

  useEffect(() => {
    if (!libraryBooks.some((book) => !book.deletedAt)) {
      handleSetSelectMode(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryBooks]);

  const processOpenWithFiles = useCallback(
    async (appService: AppService, openWithFiles: string[], libraryBooks: Book[]) => {
      const settings = await appService.loadSettings();
      const bookIds: string[] = [];
      for (const file of openWithFiles) {
        console.log('Open with book:', file);
        try {
          const temp = appService.isMobile ? false : !settings.autoImportBooksOnOpen;
          const book = await ingestFile(
            {
              file,
              books: libraryBooks,
              transient: temp,
            },
            { appService, settings },
          );
          if (book) {
            bookIds.push(book.hash);
          }
        } catch (error) {
          console.log('Failed to import book:', file, error);
        }
      }
      setLibrary(libraryBooks);
      appService.saveLibraryBooks(libraryBooks);

      console.log('Opening books:', bookIds);
      if (bookIds.length > 0) {
        setPendingNavigationBookIds(bookIds);
        return true;
      }
      return false;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleOpenLastBooks = async (
    appService: AppService,
    lastBookIds: string[],
    libraryBooks: Book[],
  ) => {
    if (lastBookIds.length === 0) return false;
    const bookIds: string[] = [];
    for (const bookId of lastBookIds) {
      const book = libraryBooks.find((b) => b.hash === bookId && b.readingStatus !== 'finished');
      if (book && (await appService.isBookAvailable(book))) {
        bookIds.push(book.hash);
      }
    }
    console.log('Opening last books:', bookIds);
    if (bookIds.length > 0) {
      setPendingNavigationBookIds(bookIds);
      return true;
    }
    return false;
  };

  const libraryInitKey = (() => {
    const params = new URLSearchParams(searchParams?.toString());
    for (const key of ['q', 'search', 'mode', 'matchCase', 'matchDiacritics', 'nearby']) {
      params.delete(key);
    }
    return params.toString();
  })();

  useEffect(() => {
    if (pendingNavigationBookIds) {
      const bookIds = pendingNavigationBookIds;
      setPendingNavigationBookIds(null);
      if (bookIds.length > 0) {
        navigateToReader(router, bookIds);
      }
    }
  }, [pendingNavigationBookIds, appService, router]);

  useEffect(() => {
    if (isInitiating.current) return;
    isInitiating.current = true;

    // Reuse the in-store library only when it was actually loaded from disk.
    // Gating on `length > 0` was unsafe: a transient "Open with" entry made the
    // store non-empty before any disk load, so this skipped loadLibraryBooks and
    // a later save persisted the partial library (wiping library.json).
    const hasCachedLibrary = libraryLoadedFromDisk;
    const loadingTimeout = hasCachedLibrary ? null : setTimeout(() => setLoading(true), 500);
    const initLibrary = async () => {
      const appService = await envConfig.getAppService();
      const settings = await appService.loadSettings();
      setSettings(settings);

      // Re-grant fs_scope / asset_protocol_scope for every external
      // library folder the user registered in a previous session, so
      // in-place books under those roots are immediately readable
      // through both `dir_scanner::read_dir` and the fs plugin.
      // Best-effort — `allowPathsInScopes` swallows its own errors.
      // On iOS the corresponding native-bridge plugin separately
      // re-acquires security-scoped resources via persisted
      // bookmarks (see InPlaceFolderBookmarkStore in
      // NativeBridgePlugin.swift); here we just sync Tauri's in-memory
      // scope set with the persisted intent.
      const externalRoots = settings.externalLibraryFolders ?? [];
      if (externalRoots.length > 0 && appService.allowPathsInScopes) {
        await appService.allowPathsInScopes(externalRoots, true);
      }

      // Reuse the library from the store when we return from the reader
      const library = hasCachedLibrary ? libraryBooks : await appService.loadLibraryBooks();
      let opened = false;
      if (checkOpenWithBooks) {
        opened = await handleOpenWithBooks(appService, library);
      }
      setCheckOpenWithBooks(opened);
      if (!opened && checkLastOpenBooks && settings.openLastBooks) {
        opened = await handleOpenLastBooks(appService, settings.lastOpenBooks, library);
      }
      setCheckLastOpenBooks(opened);

      // Skip the redundant setLibrary on the cached path: the store already
      // contains the same array reference, and a no-op set would still
      // trigger refreshGroups (O(n) MD5) and a full Bookshelf re-render.
      // The cold path or the openWith / openLast path may have produced a
      // different `library` reference (intent-imported books) — only then
      // do we commit it.
      if (!hasCachedLibrary || library !== libraryBooks) {
        setLibrary(library);
      }
      setLibraryLoaded(true);
      if (loadingTimeout) clearTimeout(loadingTimeout);
      setLoading(false);
    };

    const handleOpenWithBooks = async (appService: AppService, library: Book[]) => {
      const openWithFiles = (await parseOpenWithFiles()) || [];

      if (openWithFiles.length > 0) {
        return await processOpenWithFiles(appService, openWithFiles, library);
      }
      return false;
    };

    initLibrary();
    return () => {
      setCheckOpenWithBooks(false);
      setCheckLastOpenBooks(false);
      isInitiating.current = false;
    };
    // Non-search URL changes trigger parsing OPEN_WITH_FILES without reinitializing on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryInitKey]);

  useEffect(() => {
    const group = searchParams?.get('group') || '';
    const groupName = getGroupName(group);
    setCurrentGroupPath(groupName);
  }, [libraryBooks, searchParams, getGroupName]);

  useEffect(() => {
    if (
      (searchParams?.toString() || '') !== new URLSearchParams(window.location.search).toString()
    ) {
      return;
    }
    const urlQuery = searchParams?.get('q') ?? '';
    if (pendingLibrarySearchQueryRef.current === urlQuery) {
      pendingLibrarySearchQueryRef.current = null;
    }
    if (pendingLibrarySearchQueryRef.current === null) setLibrarySearchQuery(urlQuery);
    const target = ['contents', 'text'].includes(searchParams?.get('search') ?? '')
      ? 'text'
      : 'books';
    const config = getLibrarySearchConfig(searchParams);
    librarySearchTargetRef.current = target;
    librarySearchConfigRef.current = config;
    setLibrarySearchTarget(target);
    setLibrarySearchConfig(config);
  }, [searchParams]);

  useEffect(() => {
    const group = searchParams?.get('group') || '';
    restoreScrollPosition(group);
  }, [searchParams, restoreScrollPosition]);

  // Track the current virtual group for the navigation header.
  useEffect(() => {
    const groupId = searchParams?.get('group') || '';
    const groupByParam = searchParams?.get('groupBy');
    const groupBy = ensureLibraryGroupByType(groupByParam, settings.libraryGroupBy);

    if (
      groupId &&
      (groupBy === LibraryGroupByType.Series ||
        groupBy === LibraryGroupByType.Author ||
        groupBy === LibraryGroupByType.Tag ||
        groupBy === LibraryGroupByType.Subject)
    ) {
      // Find the group to get its name
      const allGroups = createBookGroups(
        libraryBooks.filter((b) => !b.deletedAt),
        groupBy,
      );
      const targetGroup = findGroupById(allGroups, groupId);

      if (targetGroup) {
        setCurrentVirtualGroup({
          groupBy,
          groupName: targetGroup.displayName || targetGroup.name,
        });
      } else {
        setCurrentVirtualGroup(null);
      }
    } else {
      setCurrentVirtualGroup(null);
    }
  }, [libraryBooks, searchParams, settings.libraryGroupBy]);

  useEffect(() => {
    if (demoBooks.length > 0 && libraryLoaded) {
      const newLibrary = [...libraryBooks];
      for (const book of demoBooks) {
        const idx = newLibrary.findIndex((b) => b.hash === book.hash);
        if (idx === -1) {
          newLibrary.push(book);
        } else {
          newLibrary[idx] = book;
        }
      }
      setLibrary(newLibrary);
      appService?.saveLibraryBooks(newLibrary);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoBooks, libraryLoaded]);

  const importBooks = async (
    files: SelectedFile[],
    groupId?: string,
    options: { silent?: boolean } = {},
  ): Promise<{ failedPaths: string[] }> => {
    setLoading(true);
    const { library } = useLibraryStore.getState();
    // Build the lookup index ONCE per import batch so each book lookup is
    // O(1) instead of O(n) over the existing library. importBook also keeps
    // the index updated as new books are appended, so subsequent files in
    // the same batch see the additions.
    //
    // `osPlatform` is required for the `byFilePath` arm: on case-insensitive
    // filesystems (macOS / iOS / Windows) two paths that differ only in
    // casing must hash to the same key, so the in-place fast path in
    // importBook can recognize a re-import of the same file.
    const lookupIndex = buildBookLookupIndex(library, appService?.osPlatform);
    const failedImports: Array<{ filename: string; errorMessage: string }> = [];
    const failedPaths: string[] = [];
    const successfulImports: string[] = [];

    // Readest's own Books/ prefix is resolved once at app init and persisted
    // in `settings.localBooksDir`. We hand it to `ingestFile` so the in-place
    // decision can exclude files that already live inside our managed hash
    // store WITHOUT misclassifying user-owned folders that happen to be
    // named "Books" (e.g. Baidu Netdisk's default `Books/` directory
    // directly under the user's library root).
    const appBooksPrefix: string | null =
      useSettingsStore.getState().settings.localBooksDir || null;

    const processFile = async (selectedFile: SelectedFile): Promise<Book | null> => {
      // A path-only entry (e.g. a native file path from Tauri drag-drop)
      // carries no File — reading its contents requires native filesystem
      // access the web build doesn't have.
      const file = 'file' in selectedFile ? selectedFile.file : undefined;
      if (!file) return null;
      if (!appService) return null;
      try {
        // `groupId` is treated as a tri-state:
        //   - undefined  → caller didn't specify; leave existing grouping alone.
        //   - '' (empty) → caller explicitly wants the library root.
        //   - any string → caller explicitly wants that group.
        // Distinguishing '' from undefined matters for re-imports of an
        // already-known book: without it, a falsy check would silently
        // keep the existingBook's stale groupId/groupName from a prior
        // import instead of moving the book to the root.
        const resolvedGroupId = groupId;
        const resolvedGroupName = groupId !== undefined ? getGroupName(groupId) : undefined;
        // Read settings from the store at call-time rather than the
        // component closure, so a settings write that landed after this
        // render (but before this async import runs) isn't missed by
        // `shouldImportInPlace`.
        const liveSettings = useSettingsStore.getState().settings;
        const book = await ingestFile(
          {
            file,
            books: library,
            lookupIndex,
            groupId: resolvedGroupId,
            groupName: resolvedGroupName,
          },
          { appService, settings: liveSettings, appBooksPrefix },
        );
        if (!book) return null;
        successfulImports.push(book.title);
        return book;
      } catch (error) {
        const filename = typeof file === 'string' ? file : file.name;
        if (typeof file === 'string') failedPaths.push(file);
        const baseFilename = getFilename(filename);
        const errorMessage = error instanceof Error ? _(getImportErrorMessage(error.message)) : '';
        failedImports.push({ filename: baseFilename, errorMessage });
        console.error('Failed to import book:', filename, error);
        return null;
      }
    };

    const concurrency = 4;
    for (let i = 0; i < files.length; i += concurrency) {
      const batch = files.slice(i, i + concurrency);
      const importedBooks = (await Promise.all(batch.map(processFile))).filter((book) => !!book);
      // Update store state per batch (so the UI can render imported books
      // incrementally) but defer disk persistence until the entire batch is
      // done — saving library.json once per batch of 4 books was the dominant
      // cost for large imports.
      await updateBooks(envConfig, importedBooks, { skipSave: true });
    }

    // Persist the full library once after every file in the batch is done.
    if (successfulImports.length > 0) {
      const finalLibrary = useLibraryStore.getState().library;
      const finalAppService = await envConfig.getAppService();
      await finalAppService.saveLibraryBooks(finalLibrary);
    }

    if (!options.silent && failedImports.length > 1) {
      setFailedImportsModal(failedImports);
    } else if (!options.silent && failedImports.length === 1) {
      const { filename, errorMessage } = failedImports[0]!;
      eventDispatcher.dispatch('toast', {
        message:
          _('Failed to import book(s): {{filenames}}', {
            filenames: listFormater(false).format([filename]),
          }) + (errorMessage ? `\n${errorMessage}` : ''),
        timeout: 5000,
        type: 'error',
      });
    }
    // Surface the success toast when books were imported. In silent (auto-import)
    // mode failures are suppressed, so show success independently of them; in
    // interactive mode keep the original behaviour (only when nothing failed).
    if (successfulImports.length > 0 && (options.silent || failedImports.length === 0)) {
      eventDispatcher.dispatch('toast', {
        message: _('Successfully imported {{count}} book(s)', {
          count: successfulImports.length,
        }),
        timeout: 2000,
        type: 'success',
      });
    }

    setLoading(false);
    return { failedPaths };
  };

  // Single local delete flow: 'both' fully removes the book (tombstone +
  // managed files + cover); 'purge' additionally wipes the app-generated
  // Books/<hash>/ dir and the TTS audio cache (see appService.deleteBook).
  const handleBookDelete = (deleteAction: 'both' | 'purge') => {
    return async (book: Book) => {
      const deletionMessages = {
        both: _('Book deleted: {{title}}', { title: book.title }),
        purge: _('Purged book data: {{title}}', { title: book.title }),
      };
      const deletionFailMessages = {
        both: _('Failed to delete book: {{title}}', { title: book.title }),
        purge: _('Failed to purge book data: {{title}}', { title: book.title }),
      };

      try {
        await appService?.deleteBook(book, deleteAction);
        book.deletedAt = Date.now();
        book.downloadedAt = null;
        book.coverDownloadedAt = null;
        await updateBook(envConfig, book);
        if (ttsSessionManager.getSessionByHash(book.hash)) {
          await ttsSessionManager.stopActive('deleted');
        }
        clearBookData(book.hash);

        eventDispatcher.dispatch('toast', {
          type: 'info',
          timeout: 1000,
          message: deletionMessages[deleteAction],
        });
        return true;
      } catch {
        eventDispatcher.dispatch('toast', {
          message: deletionFailMessages[deleteAction],
          type: 'error',
        });
        return false;
      }
    };
  };

  const handleUpdateMetadata = async (book: Book, metadata: BookMetadata, tags: string[]) => {
    // Build a NEW book object instead of mutating `book` in place. <BookCover>
    // is memoized and compares fields off the book, so mutating the existing
    // object (which React holds as the previous snapshot) makes the comparator
    // see no change and the library cover only refreshes after a full reload.
    const updatedBook = getBookWithUpdatedMetadata(book, metadata, tags);
    if (metadata.coverImageBlobUrl || metadata.coverImageUrl || metadata.coverImageFile) {
      try {
        await appService?.updateCoverImage(
          updatedBook,
          metadata.coverImageBlobUrl || metadata.coverImageUrl,
          metadata.coverImageFile,
        );
        // Recompute the cover's content hash so `book.coverHash` stays in sync
        // with the file on disk (used for local dedup — see bookService).
        // computeCoverHash returns null for a '_blank' deletion — we skip the
        // bump there.
        const newCoverHash = (await appService?.computeCoverHash(updatedBook)) ?? null;
        if (newCoverHash && newCoverHash !== book.coverHash) {
          updatedBook.coverHash = newCoverHash;
          updatedBook.coverUpdatedAt = Date.now();
        }
      } catch (error) {
        console.warn('Failed to update cover image:', error);
      }
    }
    if (isWebAppPlatform()) {
      // Clear HTTP cover image URL if cover is updated with a local file
      if (metadata.coverImageBlobUrl) {
        metadata.coverImageUrl = undefined;
      }
    } else {
      metadata.coverImageUrl = undefined;
    }
    metadata.coverImageBlobUrl = undefined;
    metadata.coverImageFile = undefined;
    await updateBook(envConfig, updatedBook);
  };

  const handleMetadataValueClick = (type: 'tag' | 'subject', value: string) => {
    const groupBy = type === 'tag' ? LibraryGroupByType.Tag : LibraryGroupByType.Subject;
    const targetGroup = createBookGroups(libraryBooks, groupBy).find(
      (item): item is BooksGroup => 'books' in item && item.name === value,
    );
    if (!targetGroup) return;
    const params = new URLSearchParams(window.location.search);
    params.set('groupBy', groupBy);
    params.set('group', targetGroup.id);
    params.delete('q');
    setShowDetailsBook(null);
    navigateToLibrary(router, params.toString());
  };

  const getImportTargetGroupId = () => {
    const groupBy = ensureLibraryGroupByType(searchParams?.get('groupBy'), settings.libraryGroupBy);
    return groupBy === LibraryGroupByType.Group ? searchParams?.get('group') || '' : '';
  };

  const handleImportBooksFromFiles = async () => {
    setIsSelectMode(false);
    console.log('Importing books from files...');
    selectFiles({ type: 'books', multiple: true }).then((result) => {
      if (result.files.length === 0 || result.error) return;
      importBooks(result.files, getImportTargetGroupId());
    });
  };

  const handleSetSelectMode = (selectMode: boolean) => {
    setIsSelectMode(selectMode);
    setIsSelectAll(false);
    setIsSelectNone(false);
  };

  const updateLibrarySearchUrl = (target: LibrarySearchTarget, config: LibrarySearchConfig) => {
    const params = new URLSearchParams(window.location.search);
    const query = pendingLibrarySearchQueryRef.current ?? librarySearchQuery;
    if (query) params.set('q', query);
    else params.delete('q');
    if (target === 'text') params.set('search', 'text');
    else params.delete('search');
    if (config.mode !== 'contains') params.set('mode', config.mode);
    else params.delete('mode');
    if (config.matchCase) params.set('matchCase', 'true');
    else params.delete('matchCase');
    if (config.matchDiacritics) params.set('matchDiacritics', 'true');
    else params.delete('matchDiacritics');
    if (config.mode === 'nearby-words' && config.nearbyWords !== DEFAULT_NEARBY_WORDS) {
      params.set('nearby', String(config.nearbyWords));
    } else {
      params.delete('nearby');
    }
    const value = params.toString();
    window.history.replaceState(null, '', `?${value}`);
    sessionStorage.setItem('lastLibraryParams', value);
  };

  const handleSearchTargetChange = (target: LibrarySearchTarget) => {
    librarySearchTargetRef.current = target;
    setLibrarySearchTarget(target);
    debouncedSearchUrlUpdate.cancel();
    updateLibrarySearchUrl(target, librarySearchConfigRef.current);
    if (target === 'text') handleSetSelectMode(false);
  };

  // The input itself stays instant; applying the query (URL, shelf filter,
  // content scans) debounces so typing does not re-filter the library or
  // restart searches on every keystroke.
  const updateLibrarySearchUrlRef = useRef<typeof updateLibrarySearchUrl>(null!);
  updateLibrarySearchUrlRef.current = updateLibrarySearchUrl;
  const debouncedSearchUrlUpdate = React.useMemo(
    () =>
      debounce(() => {
        updateLibrarySearchUrlRef.current(
          librarySearchTargetRef.current,
          librarySearchConfigRef.current,
        );
      }, 500),
    [],
  );
  useEffect(() => () => debouncedSearchUrlUpdate.cancel(), [debouncedSearchUrlUpdate]);

  // Immediate variant for history pills and other one-shot applications.
  const handleSearchQueryApply = (query: string) => {
    debouncedSearchUrlUpdate.cancel();
    const urlQuery = new URLSearchParams(window.location.search).get('q') ?? '';
    pendingLibrarySearchQueryRef.current = query === urlQuery ? null : query;
    setLibrarySearchQuery(query);
    updateLibrarySearchUrl(librarySearchTargetRef.current, librarySearchConfigRef.current);
  };

  const handleSearchQueryChange = (query: string) => {
    const urlQuery = new URLSearchParams(window.location.search).get('q') ?? '';
    pendingLibrarySearchQueryRef.current = query === urlQuery ? null : query;
    setLibrarySearchQuery(query);
    debouncedSearchUrlUpdate();
  };

  const handleSearchConfigChange = (config: LibrarySearchConfig) => {
    librarySearchConfigRef.current = config;
    React.startTransition(() => {
      setLibrarySearchConfig(config);
    });
    debouncedSearchUrlUpdate.cancel();
    updateLibrarySearchUrl(librarySearchTargetRef.current, config);
  };

  const handleSelectAll = () => {
    setIsSelectAll(true);
    setIsSelectNone(false);
  };

  const handleDeselectAll = () => {
    setIsSelectNone(true);
    setIsSelectAll(false);
  };

  const handleShowDetailsBook = (book: Book) => {
    setShowDetailsBook(book);
  };

  const handleNavigateToPath = (path: string | undefined) => {
    const group = path ? getGroupId(path) || '' : '';
    setIsSelectAll(false);
    setIsSelectNone(false);
    handleLibraryNavigation(group);
  };

  if (!appService || !insets || checkOpenWithBooks || checkLastOpenBooks) {
    return <div className='full-height bg-base-200' />;
  }

  const showBookshelf = libraryLoaded || libraryBooks.length > 0;

  return (
    <div
      ref={pageRef}
      aria-label={_('Your Library')}
      className={clsx(
        'library-page text-base-content full-height flex select-none flex-col overflow-hidden',
        viewSettings?.isEink ? 'bg-base-100' : 'bg-base-200',
      )}
    >
      <div
        className='relative top-0 z-40 w-full'
        role='banner'
        tabIndex={-1}
        aria-label={_('Library Header')}
      >
        <LibraryHeader
          isSelectMode={isSelectMode}
          isSelectAll={isSelectAll}
          onImportBooksFromFiles={handleImportBooksFromFiles}
          onToggleSelectMode={() => handleSetSelectMode(!isSelectMode)}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          searchQuery={librarySearchQuery}
          searchTarget={librarySearchTarget}
          searchConfig={librarySearchConfig}
          onSearchConfigChange={handleSearchConfigChange}
          onSearchQueryChange={handleSearchQueryChange}
          onSearchTargetChange={handleSearchTargetChange}
        />
        <progress
          aria-label={_('Library Search Progress')}
          aria-hidden={librarySearchProgress != null ? 'false' : 'true'}
          className={clsx(
            'progress progress-success absolute bottom-0 left-0 right-0 h-1 translate-y-[2px] transition-opacity duration-200 sm:translate-y-[4px]',
            librarySearchProgress != null ? 'opacity-100' : 'opacity-0',
          )}
          value={librarySearchProgress ?? 0}
          max={100}
        />
      </div>
      {loading && (
        <div className='fixed inset-0 z-50 flex items-center justify-center'>
          <Spinner loading />
        </div>
      )}
      {librarySearchTarget === 'text' &&
        !librarySearchQuery.trim() &&
        librarySearchHistory.length > 0 && (
          <div className='relative my-1 flex shrink-0 items-center px-4 sm:px-6'>
            <div className='no-scrollbar not-eink:[mask-image:linear-gradient(to_right,transparent,black_12px,black_calc(100%_-_12px),transparent)] flex flex-1 gap-1.5 overflow-x-auto'>
              {librarySearchHistory.map((term) => (
                <button
                  key={term}
                  type='button'
                  onClick={() => handleSearchQueryApply(term)}
                  className='bg-base-300/45 hover:bg-base-300/70 text-base-content/70 max-w-[60%] flex-shrink-0 whitespace-nowrap rounded-full px-3 py-0.5 text-xs'
                >
                  <p className='truncate'>{term}</p>
                </button>
              ))}
            </div>
            <button
              type='button'
              onClick={() => {
                clearLibrarySearchHistory();
                setLibrarySearchHistory([]);
              }}
              title={_('Clear search history')}
              aria-label={_('Clear search history')}
              className='text-base-content/50 hover:text-base-content/80 flex h-6 w-8 shrink-0 items-center justify-center'
            >
              <MdClose className='h-4 w-4' />
            </button>
          </div>
        )}
      {currentGroupPath && (
        <div
          className={`transition-all duration-300 ease-in-out ${
            currentGroupPath ? 'opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className='flex flex-wrap items-center gap-y-1 px-4 text-base'>
            <button
              onClick={() => handleNavigateToPath(undefined)}
              className='hover:bg-base-300 text-base-content/85 rounded px-2 py-1'
            >
              {_('All')}
            </button>
            {getBreadcrumbs(currentGroupPath).map((crumb, index, array) => {
              const isLast = index === array.length - 1;
              return (
                <React.Fragment key={index}>
                  <MdChevronRight size={iconSize} className='text-neutral-content' />
                  {isLast ? (
                    <span className='truncate rounded px-2 py-1'>{crumb.name}</span>
                  ) : (
                    <button
                      onClick={() => handleNavigateToPath(crumb.path)}
                      className='hover:bg-base-300 text-base-content/85 truncate rounded px-2 py-1'
                    >
                      {crumb.name}
                    </button>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}
      {currentVirtualGroup && (
        <GroupHeader
          groupBy={currentVirtualGroup.groupBy}
          groupName={currentVirtualGroup.groupName}
        />
      )}
      {showBookshelf &&
        (libraryBooks.some((book) => !book.deletedAt) ? (
          <div aria-label={_('Your Bookshelf')} className='flex min-h-0 flex-grow flex-col'>
            <div
              ref={containerRef}
              className={clsx(
                'scroll-container drop-zone flex min-h-0 flex-grow flex-col',
                isDragging && 'drag-over',
              )}
              style={{
                paddingRight: `${insets.right}px`,
                paddingLeft: `${insets.left}px`,
              }}
            >
              <DropIndicator />
              <Bookshelf
                libraryBooks={libraryBooks}
                isSelectMode={isSelectMode}
                isSelectAll={isSelectAll}
                isSelectNone={isSelectNone}
                onScrollerRef={handleScrollerRef}
                handleImportBooks={setImportMenuAnchor}
                handleBookDelete={handleBookDelete('both')}
                handleBookPurge={handleBookDelete('purge')}
                handleSetSelectMode={handleSetSelectMode}
                handleShowDetailsBook={handleShowDetailsBook}
                handleLibraryNavigation={handleLibraryNavigation}
                onSearchContents={() => handleSearchTargetChange('text')}
                onSearchProgress={setLibrarySearchProgress}
                contentSearch={
                  librarySearchTarget === 'text'
                    ? { query: searchParams?.get('q') ?? '', config: librarySearchConfig }
                    : null
                }
              />
            </div>
          </div>
        ) : (
          <div className='hero drop-zone h-screen items-center justify-center'>
            <DropIndicator />
            <LibraryEmptyState onImport={setImportMenuAnchor} />
          </div>
        ))}
      {importMenuAnchor && (
        <ImportMenuPopup
          anchor={importMenuAnchor}
          onClose={() => setImportMenuAnchor(null)}
          onImportBooksFromFiles={handleImportBooksFromFiles}
        />
      )}
      <NowPlayingBar isSelectMode={isSelectMode} />
      {showDetailsBook && (
        <BookDetailModal
          isOpen={!!showDetailsBook}
          book={showDetailsBook}
          onClose={() => setShowDetailsBook(null)}
          handleBookDelete={handleBookDelete('both')}
          handleBookPurge={handleBookDelete('purge')}
          handleBookMetadataUpdate={handleUpdateMetadata}
          onMetadataValueClick={handleMetadataValueClick}
        />
      )}
      <AboutWindow />
      <KeyboardShortcutsHelp />
      <BackupWindow />
      {isSettingsDialogOpen && <SettingsDialog bookKey={''} />}
      {failedImportsModal && (
        <FailedImportsDialog
          failedImports={failedImportsModal}
          onClose={() => setFailedImportsModal(null)}
        />
      )}
      <Toast />
    </div>
  );
};

const LibraryPage = () => {
  return (
    <Suspense fallback={<div className='full-height' />}>
      <LibraryPageWithSearchParams />
    </Suspense>
  );
};

export default LibraryPage;
