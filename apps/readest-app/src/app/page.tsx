'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useEnv } from '@/context/EnvContext';
import { useLibrary } from '@/hooks/useLibrary';
import { useSessionStore } from '@/store/sessionStore';
import { openVisualibleBook } from '@/services/visualible/openBook';
import { getSessionFromSearchParams } from '@/services/visualible/session';
import Reader from '@/app/reader/components/Reader';
import BookLoadingScreen from '@/components/BookLoadingScreen';

function HomeContent() {
  const searchParams = useSearchParams();
  const { envConfig, appService } = useEnv();
  const { libraryLoaded } = useLibrary();
  const [error, setError] = useState<string | null>(null);
  // Drives which book(s) to render, purely in memory — never reflected in the
  // URL. The URL stays `?slug=&token=` for the whole session; refreshing
  // re-resolves from scratch rather than restoring from a persisted `?ids=`.
  const [readyIds, setReadyIds] = useState<string | null>(null);
  const isOpening = useRef(false);

  const session = searchParams ? getSessionFromSearchParams(searchParams) : null;

  useEffect(() => {
    if (!session || !appService || !libraryLoaded || isOpening.current || readyIds) return;
    isOpening.current = true;
    useSessionStore.getState().setSession(session);

    openVisualibleBook(session.slug, session.token, appService, envConfig, session.pipelineId)
      .then(setReadyIds)
      .catch(() => setError('Unable to open book'));
  }, [session, appService, libraryLoaded, envConfig, readyIds]);

  if (readyIds) {
    return <Reader ids={readyIds} />;
  }

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

  if (error) {
    return (
      <div className='full-height flex items-center justify-center'>
        <p className='text-error'>{error}</p>
      </div>
    );
  }

  return <BookLoadingScreen className='full-height' />;
}

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}
