import { EnvConfigType } from '@/services/environment';
import { AppService } from '@/types/system';
import { BookDoc } from '@/libs/document';
import { stashPendingBookDoc, useBookDataStore } from '@/store/bookDataStore';
import { useLibraryStore } from '@/store/libraryStore';
import { useSessionStore } from '@/store/sessionStore';
import { getBookDetail } from './bookDetail';
import { getEbookContent } from './ebookContent';
import { getBlockedWords } from './excludeWords';
import { resolveEpubSource } from './epubSource';

// Fetches, imports, and registers a purchased book by slug, returning its
// content hash. Shared by the initial `?slug=&token=` open (src/app/page.tsx)
// and opening a not-yet-imported book from BookMenu's purchased-library list.
// Resolved hashes are cached per slug so re-opening an already-imported book
// skips the network round-trip and re-import.
export const openVisualibleBook = async (
  slug: string,
  token: string,
  appService: AppService,
  envConfig: EnvConfigType,
  pipelineIdOverride?: string,
): Promise<string> => {
  const cachedHash = useSessionStore.getState().getHashForSlug(slug);
  if (cachedHash && useBookDataStore.getState().booksData[cachedHash]) {
    return cachedHash;
  }

  // Speculatively start fetching/evaluating the renderer + zip-parser chunks
  // now, in parallel with the network round trip below, instead of only
  // starting them once the EPUB bytes are ready to parse/render.
  void import('foliate-js/view.js');
  void import('@zip.js/zip.js');

  const detail = await getBookDetail(slug, token);
  // The pipeline endpoint is keyed by pipeline id, not the book id — an explicit
  // `pipelineId` override (e.g. to pin an older run) overrides the book's latest.
  const pipelineId = pipelineIdOverride ? Number(pipelineIdOverride) : detail.latestPipelineId;
  const [source, ebookContent, excludedWords] = await Promise.all([
    resolveEpubSource(detail, token),
    // Feeds the reader's entity-icon matching + info panel (see setEbookContent
    // below, and src/app/reader/utils/entityIcons.ts).
    getEbookContent(pipelineId, token, detail.isSecure).catch((err) => {
      console.error('[ebookContent] failed to load', err);
      return null;
    }),
    // Suppresses entity icons for specific words (book-specific + site-wide) —
    // excludeVersion is 0 when there's nothing to exclude, per the API contract,
    // so the round trip is skipped entirely.
    detail.excludeVersion > 0
      ? getBlockedWords(detail.id, token).catch((err) => {
          console.error('[exclude-words] failed to load', err);
          return [] as string[];
        })
      : Promise.resolve([] as string[]),
  ]);

  const { library } = useLibraryStore.getState();
  let book =
    typeof source === 'string' ? library.find((b) => b.url === source && !b.deletedAt) : undefined;
  if (!book) {
    // Captures the doc importBook parses for metadata/hash/cover instead of
    // letting it destroy that parse — stashed below so the reader's
    // initViewState (readerStore.ts) can reuse it instead of re-parsing the file.
    let loadedDoc: { doc: BookDoc; file: File } | undefined;
    const imported = await appService.importBook(source, library, {
      ...(typeof source === 'string' ? { saveBook: false } : {}),
      onBookDocLoaded: (doc, file) => {
        loadedDoc = { doc, file };
      },
    });
    if (!imported) {
      throw new Error(`Unable to open book "${slug}"`);
    }
    book = imported;
    if (loadedDoc) {
      stashPendingBookDoc(book.hash, loadedDoc.file, loadedDoc.doc);
    }
    // skipSave: persistence is moving to the Visualible API (not built yet) —
    // this only needs to populate the in-memory library/hashIndex for this
    // session (BookMenu's "Parallel Read" picker, saveConfig's presence
    // guard), not write library.json to disk.
    await useLibraryStore.getState().updateBooks(envConfig, [book], { skipSave: true });
  }
  if (ebookContent) {
    useBookDataStore.getState().setEbookContent(book.hash, { ...ebookContent, excludedWords });
  }
  useSessionStore.getState().setHashForSlug(slug, book.hash);
  return book.hash;
};
