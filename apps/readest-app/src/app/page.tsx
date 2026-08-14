'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEnv } from '@/context/EnvContext';
import { useLibrary } from '@/hooks/useLibrary';
import { useLibraryStore } from '@/store/libraryStore';
import { navigateToReader } from '@/utils/nav';
import type { BooksDirEntry } from './api/books/route';

const buildFileUrl = (name: string) =>
  new URL(`/api/books/${encodeURIComponent(name)}`, window.location.origin).toString();

function BooksList() {
  const [books, setBooks] = useState<BooksDirEntry[] | null>(null);

  useEffect(() => {
    fetch('/api/books')
      .then((res) => res.json())
      .then((data: { books: BooksDirEntry[] }) => setBooks(data.books))
      .catch(() => setBooks([]));
  }, []);

  return (
    <div className='flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center'>
      <h1 className='text-xl font-semibold'>Readest</h1>
      <p className='text-base-content/70'>
        Open a book with <code>?book=filename.epub</code>
      </p>
      {books?.length ? (
        <ul className='flex flex-col gap-2'>
          {books.map((book) => (
            <li key={book.name}>
              <a className='link' href={`/?book=${encodeURIComponent(book.name)}`}>
                {book.name}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        books !== null && (
          <p className='text-base-content/50'>No books found in the data directory.</p>
        )
      )}
    </div>
  );
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { envConfig, appService } = useEnv();
  const { libraryLoaded } = useLibrary();
  const [error, setError] = useState<string | null>(null);
  const isOpening = useRef(false);

  const bookName = searchParams?.get('book') ?? null;

  useEffect(() => {
    if (!bookName || !appService || !libraryLoaded || isOpening.current) return;
    isOpening.current = true;

    const open = async () => {
      const fileUrl = buildFileUrl(bookName);
      const { library } = useLibraryStore.getState();
      let book = library.find((b) => b.url === fileUrl && !b.deletedAt);
      if (!book) {
        const imported = await appService.importBook(fileUrl, library, { saveBook: false });
        if (!imported) {
          setError('Unable to open book');
          return;
        }
        book = imported;
        await useLibraryStore.getState().updateBooks(envConfig, [book]);
      }
      navigateToReader(router, [book.hash]);
    };

    open().catch(() => setError('Unable to open book'));
  }, [bookName, appService, libraryLoaded, envConfig, router]);

  if (!bookName) return <BooksList />;

  return (
    <div className='flex min-h-screen items-center justify-center'>
      <p className={error ? 'text-error' : 'text-base-content/70'}>{error ?? 'Opening book…'}</p>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}
