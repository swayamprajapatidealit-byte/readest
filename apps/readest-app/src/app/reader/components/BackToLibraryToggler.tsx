import React from 'react';
import { MdArrowBack } from 'react-icons/md';

import { useTranslation } from '@/hooks/useTranslation';
import { eventDispatcher } from '@/utils/event';
import Button from '@/components/Button';

// Saves/closes every open pane's config, then navigates home — see
// ReaderContent.tsx's `handleCloseReaderToHome` (the 'close-reader' listener).
const BackToLibraryToggler: React.FC = () => {
  const _ = useTranslation();

  return (
    <Button
      icon={<MdArrowBack className='text-base-content' size={20} />}
      onClick={() => eventDispatcher.dispatch('close-reader')}
      label={_('Back to Library')}
    />
  );
};

export default BackToLibraryToggler;
