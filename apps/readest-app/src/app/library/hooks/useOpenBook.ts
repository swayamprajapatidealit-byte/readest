import { useCallback } from 'react';
import { Book } from '@/types/book';
import { useEnv } from '@/context/EnvContext';
import { useLibraryStore } from '@/store/libraryStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useAppRouter } from '@/hooks/useAppRouter';
import { eventDispatcher } from '@/utils/event';
import { navigateToReader } from '@/utils/nav';

/**
 * Shared "open this book" flow used both by per-item taps (`BookshelfItem`) and
 * the recently-read shelf. Centralizing it keeps the availability handling in
 * one place: a stale in-place record (file moved or deleted on disk) is
 * dropped instead of bouncing the user into a broken reader.
 */
export const useOpenBook = () => {
  const _ = useTranslation();
  const router = useAppRouter();
  const { envConfig, appService } = useEnv();
  const { updateBook } = useLibraryStore();

  const makeBookAvailable = useCallback(
    async (book: Book) => {
      // The row's `downloadedAt` is not proof that the file is still here: an
      // in-place original can be moved or deleted behind our back. Probe, and
      // stamp the bookkeeping fields once confirmed present.
      if (await appService?.isBookAvailable(book)) {
        if (!book.downloadedAt || !book.coverDownloadedAt) {
          book.downloadedAt = Date.now();
          book.coverDownloadedAt = Date.now();
          await updateBook(envConfig, book);
        }
        return true;
      }
      return false;
    },
    [appService, envConfig, updateBook],
  );

  const openBook = useCallback(
    async (book: Book, cfi?: string, options?: { highlightSearchResult?: boolean }) => {
      // A book's file may have been moved or deleted on disk between sessions.
      // Probe before navigating: if it's gone, drop the stale record instead of
      // opening the reader only to fail and bounce back.
      const available = await makeBookAvailable(book);
      if (!available) {
        eventDispatcher.dispatch('toast', {
          message: _('Book file no longer exists. Confirm deletion to remove it from the library.'),
          type: 'info',
        });
        eventDispatcher.dispatch('delete-books', { ids: [book.hash] });
        return;
      }
      const params = new URLSearchParams();
      if (cfi) params.set('cfi', cfi);
      if (cfi && options?.highlightSearchResult) params.set('highlight', 'search');
      const queryParams = params.size ? params.toString() : undefined;
      setTimeout(() => {
        navigateToReader(router, [book.hash], queryParams);
      }, 0);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [makeBookAvailable],
  );

  return { openBook, makeBookAvailable };
};
