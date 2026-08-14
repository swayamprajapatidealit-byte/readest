'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEnv } from '@/context/EnvContext';
import { useLibrary } from '@/hooks/useLibrary';
import { useLibraryStore } from '@/store/libraryStore';
import { navigateToReader } from '@/utils/nav';
import { getBookDetail } from '@/services/visualible/bookDetail';
import { resolveEpubSource } from '@/services/visualible/epubSource';
import { getSessionFromSearchParams } from '@/services/visualible/session';

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { envConfig, appService } = useEnv();
  const { libraryLoaded } = useLibrary();
  const [error, setError] = useState<string | null>(null);
  const isOpening = useRef(false);

  const session = searchParams ? getSessionFromSearchParams(searchParams) : null;

  useEffect(() => {
    if (!session || !appService || !libraryLoaded || isOpening.current) return;
    isOpening.current = true;

    const open = async () => {
      const detail = await getBookDetail(session.slug, session.token);
      const source = await resolveEpubSource(detail, session.token);
      const { library } = useLibraryStore.getState();

      let book =
        typeof source === 'string'
          ? library.find((b) => b.url === source && !b.deletedAt)
          : undefined;
      if (!book) {
        const imported = await appService.importBook(
          source,
          library,
          typeof source === 'string' ? { saveBook: false } : {},
        );
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
  }, [session, appService, libraryLoaded, envConfig, router]);

  if (!session) {
    return (
      <div className='flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center'>
        <h1 className='text-xl font-semibold'>Readest</h1>
        <p className='text-base-content/70'>
          Open a book with <code>?slug=&lt;book-slug&gt;&amp;token=&lt;jwt&gt;</code>
        </p>
      </div>
    );
  }

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
