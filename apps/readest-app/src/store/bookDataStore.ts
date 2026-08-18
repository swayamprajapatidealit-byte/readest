import { create } from 'zustand';
import { SystemSettings } from '@/types/settings';
import { Book, BookConfig, BookNote } from '@/types/book';
import { EnvConfigType } from '@/services/environment';
import { BookDoc } from '@/libs/document';
import { EbookContent } from '@/services/visualible/ebookContent';
import { useLibraryStore } from './libraryStore';
import { clearEntityViewMemory } from './entityViewMemoryStore';

// Ebook content (characters/places/glossary/footnotes) is fetched during import in
// `src/app/page.tsx`, before the book has a `BookData` entry in this store — that
// entry is only created once the reader actually mounts (readerStore.ts's
// `initViewState`), slightly later in the same page's lifecycle. `sessionStorage`
// is used for the handoff (rather than a plain in-memory variable) so it keeps
// working regardless of whether that transition happens to be a soft client-side
// update or a full reload — cheap insurance, scoped to this tab/session only
// (cleared on tab close, never synced/persisted long-term). Historical note: this
// was originally load-bearing when `/` and `/reader` were on different Next.js
// routers (App vs Pages) and that hop was *always* a hard reload — the two were
// merged into one App-Router page, so today's hop is a normal soft transition, but
// the sessionStorage handoff is left in place since it's harmless either way.
const PENDING_EBOOK_CONTENT_PREFIX = 'pendingEbookContent:';

const stashPendingEbookContent = (id: string, content: EbookContent): void => {
  try {
    sessionStorage.setItem(PENDING_EBOOK_CONTENT_PREFIX + id, JSON.stringify(content));
  } catch (err) {
    console.warn('Failed to stash pending ebook content:', err);
  }
};

export const consumePendingEbookContent = (id: string): EbookContent | null => {
  const key = PENDING_EBOOK_CONTENT_PREFIX + id;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    sessionStorage.removeItem(key);
    return JSON.parse(raw) as EbookContent;
  } catch (err) {
    console.warn('Failed to consume pending ebook content:', err);
    return null;
  }
};

// Same handoff problem as ebook content above, but for the BookDoc parsed
// during import (services/visualible/openBook.ts, via importBook's
// onBookDocLoaded) — a live object graph (zip reader, blob URLs), not
// JSON-serializable, so this uses an in-memory Map instead of sessionStorage.
// Only ever needs to survive a soft transition within the same tab, which is
// exactly what this covers.
const pendingBookDocs = new Map<string, { file: File; bookDoc: BookDoc }>();

export const stashPendingBookDoc = (id: string, file: File, bookDoc: BookDoc): void => {
  pendingBookDocs.set(id, { file, bookDoc });
};

export const consumePendingBookDoc = (id: string): { file: File; bookDoc: BookDoc } | null => {
  const pending = pendingBookDocs.get(id);
  if (!pending) return null;
  pendingBookDocs.delete(id);
  return pending;
};

// `saveConfig` no longer writes `library.json`/`config.json` to disk (see its
// own comment) — nothing schedules a library save anymore, so there's nothing
// to flush. Kept as a no-op rather than removed since `useProgressAutoSave.ts`
// still calls it on unmount/blur; safe to restore the throttled-write body
// here once real (API-backed) persistence comes back.
export const flushPendingLibrarySave = async () => {};

export interface BookData {
  /* Persistent data shared with different views of the same book */
  id: string;
  book: Book | null;
  file: File | null;
  config: BookConfig | null;
  bookDoc: BookDoc | null;
  isFixedLayout: boolean;
  /* Transient, in-memory only — never persisted or synced */
  ebookContent: EbookContent | null;
}

interface BookDataState {
  booksData: { [id: string]: BookData };
  getConfig: (key: string | null) => BookConfig | null;
  setConfig: (key: string, partialConfig: Partial<BookConfig>) => void;
  saveConfig: (
    envConfig: EnvConfigType,
    bookKey: string,
    config: BookConfig,
    settings: SystemSettings,
  ) => Promise<void>;
  updateBooknotes: (key: string, booknotes: BookNote[]) => BookConfig | undefined;
  getBookData: (keyOrId: string) => BookData | null;
  clearBookData: (keyOrId: string) => void;
  setEbookContent: (keyOrId: string, content: EbookContent) => void;
}

/**
 * Drop booknotes that carry no CFI. Such a note has no anchor in the book: it
 * can't be rendered, navigated to, or ordered against anything. Worse, it is
 * actively dangerous — `CFI.compare` dereferences both of its arguments, so a
 * null/undefined cfi reaching a sort comparator or `findNearestCfi` throws
 * during render and drops the whole app to the error boundary.
 *
 * `BookNote.cfi` is typed `string`, but that isn't enforced at runtime for data
 * we didn't create: file sync (`services/sync/file/wire.ts`), backup restore,
 * and the Foliate importer all parse foreign JSON straight into booknotes.
 * Every write to `config.booknotes` funnels through this store, so discard them
 * here rather than defending each of the many CFI comparison sites.
 */
const discardUnanchoredBooknotes = (booknotes: BookNote[]): BookNote[] =>
  booknotes.filter((booknote) => booknote.cfi);

export const useBookDataStore = create<BookDataState>((set, get) => ({
  booksData: {},
  getBookData: (keyOrId: string) => {
    const id = keyOrId.split('-')[0]!;
    return get().booksData[id] || null;
  },
  clearBookData: (keyOrId: string) => {
    const id = keyOrId.split('-')[0]!;
    clearEntityViewMemory(id);
    set((state) => {
      const newBooksData = { ...state.booksData };
      delete newBooksData[id];
      return {
        booksData: newBooksData,
      };
    });
  },
  setEbookContent: (keyOrId: string, content: EbookContent) => {
    const id = keyOrId.split('-')[0]!;
    set((state) => {
      const existing = state.booksData[id];
      if (!existing) {
        // Reader hasn't created this book's BookData entry yet (fetch ran during
        // import, before navigation) — hand off via sessionStorage instead.
        stashPendingEbookContent(id, content);
        return state;
      }
      return {
        booksData: {
          ...state.booksData,
          [id]: { ...existing, ebookContent: content },
        },
      };
    });
  },
  getConfig: (key: string | null) => {
    if (!key) return null;
    const id = key.split('-')[0]!;
    return get().booksData[id]?.config || null;
  },
  setConfig: (key: string, partialConfig: Partial<BookConfig>) => {
    set((state: BookDataState) => {
      const id = key.split('-')[0]!;
      const config = state.booksData[id]?.config;
      if (!config) {
        console.warn('No config found for book', id);
        return state;
      }
      const update = partialConfig.booknotes
        ? { ...partialConfig, booknotes: discardUnanchoredBooknotes(partialConfig.booknotes) }
        : partialConfig;
      return {
        booksData: {
          ...state.booksData,
          [id]: {
            ...state.booksData[id]!,
            config: { ...config, ...update },
          },
        },
      };
    });
  },
  // Disk/IndexedDB writes are disabled for now: progress, annotations,
  // bookmarks, proofread rules, and Word Lens settings will move to their own
  // Visualible API endpoints (not built yet). Until then this only updates
  // in-memory state — every feature above keeps working normally for the
  // current visit, it just doesn't survive a refresh. `envConfig`/`settings`
  // are unused for now but kept in the signature so real persistence can drop
  // back in later without touching any of this function's ~20 call sites.
  saveConfig: async (
    _envConfig: EnvConfigType,
    bookKey: string,
    config: BookConfig,
    _settings: SystemSettings,
  ) => {
    const { library, hashIndex, setLibrary } = useLibraryStore.getState();
    const hash = bookKey.split('-')[0]!;
    const idx = hashIndex.get(hash);
    if (idx === undefined) return;

    // Immutably move the book to the front of the library with updated
    // progress and timestamps. We do NOT mutate the existing book object or
    // the existing library array — Zustand subscribers see fresh references
    // and the visibleLibrary cache stays in sync via setLibrary's full update.
    const now = Date.now();
    const original = library[idx]!;
    const updatedBook: Book = {
      ...original,
      progress: config.progress,
      updatedAt: now,
      downloadedAt: original.downloadedAt || now,
    };
    const newLibrary = [updatedBook, ...library.slice(0, idx), ...library.slice(idx + 1)];
    setLibrary(newLibrary);

    // Refresh updatedAt immutably via the store rather than mutating the
    // caller-provided object. This notifies Zustand subscribers and works
    // regardless of whether the caller passed the shared store config.
    get().setConfig(bookKey, { updatedAt: now });
  },
  updateBooknotes: (key: string, booknotes: BookNote[]) => {
    let updatedConfig: BookConfig | undefined;
    set((state) => {
      const id = key.split('-')[0]!;
      const book = state.booksData[id];
      if (!book) return state;
      const dedupedBooknotes = Array.from(
        new Map(
          discardUnanchoredBooknotes(booknotes).map((item) => [
            `${item.id}-${item.type}-${item.cfi}`,
            item,
          ]),
        ).values(),
      );
      updatedConfig = {
        ...book.config,
        updatedAt: Date.now(),
        booknotes: dedupedBooknotes,
      };
      return {
        booksData: {
          ...state.booksData,
          [id]: {
            ...book,
            config: {
              ...book.config,
              updatedAt: Date.now(),
              booknotes: dedupedBooknotes,
            },
          },
        },
      };
    });
    return updatedConfig;
  },
}));
