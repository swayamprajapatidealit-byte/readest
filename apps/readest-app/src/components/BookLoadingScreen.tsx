'use client';

import clsx from 'clsx';
import React, { useEffect, useState } from 'react';
import { MdAutoStories } from 'react-icons/md';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * Single shared "opening a book" loading screen — used both while the
 * Visualible pipeline fetch + EPUB import resolves (app/page.tsx) and while
 * the reader hydrates its view state afterward (ReaderContent.tsx). Same
 * component in both spots so the reader sees one continuous loading
 * experience instead of two visually different screens back to back.
 */
const BookLoadingScreen: React.FC<{ className?: string }> = ({ className }) => {
  const _ = useTranslation();
  // Calling `_()` with each literal up front (not by dynamic key) keeps the
  // i18n scanner able to extract these — see docs/i18n.md.
  const messages = [
    _('Opening your book…'),
    _('Getting characters and places ready…'),
    _('Almost there…'),
  ];
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % messages.length);
    }, 2600);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={clsx('flex flex-col items-center justify-center gap-5', className)}
      role='status'
    >
      <div className='not-eink:block eink:hidden relative flex h-16 w-16 items-center justify-center'>
        <span className='book-loader-spin border-primary/15 border-t-primary absolute inset-0 rounded-full border-[3px]' />
        <MdAutoStories className='book-loader-pulse text-primary' size={26} />
      </div>
      <span className='eink:block not-eink:hidden loading loading-lg loading-spinner text-primary' />
      <p className='text-base-content/60 min-h-[1.5em] text-sm'>{messages[messageIndex]}</p>
      <span className='sr-only'>{_('Loading...')}</span>
    </div>
  );
};

export default BookLoadingScreen;
