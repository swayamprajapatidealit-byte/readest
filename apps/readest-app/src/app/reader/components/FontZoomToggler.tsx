import clsx from 'clsx';
import React from 'react';
import { MdZoomIn, MdZoomOut } from 'react-icons/md';

import { useEnv } from '@/context/EnvContext';
import { useReaderStore } from '@/store/readerStore';
import { useBookDataStore } from '@/store/bookDataStore';
import { useTranslation } from '@/hooks/useTranslation';
import { saveViewSettings } from '@/helpers/settings';
import {
  DEFAULT_BOOK_FONT,
  MAX_FONT_ZOOM_SIZE,
  MIN_FONT_ZOOM_SIZE,
  FONT_ZOOM_STEP,
} from '@/services/constants';
import Button from '@/components/Button';

interface FontZoomTogglerProps {
  bookKey: string;
}

// Reflowable books have no real "zoom" — this steps `defaultFontSize` up/down
// instead but is presented as zoom in/out, since that's the intuitive analog
// for making the page look bigger/smaller. Fixed-layout books get the real
// zoomLevel-based controls in View Options instead, so this stays hidden there.
const FontZoomToggler: React.FC<FontZoomTogglerProps> = ({ bookKey }) => {
  const _ = useTranslation();
  const { envConfig } = useEnv();
  const { getViewSettings } = useReaderStore();
  const { getBookData } = useBookDataStore();
  const bookData = getBookData(bookKey);
  const viewSettings = getViewSettings(bookKey);

  if (bookData?.isFixedLayout || !viewSettings) return null;

  const fontSize = viewSettings.defaultFontSize ?? DEFAULT_BOOK_FONT.defaultFontSize;
  const minFontSize = Math.max(
    viewSettings.minimumFontSize ?? MIN_FONT_ZOOM_SIZE,
    MIN_FONT_ZOOM_SIZE,
  );
  const zoomPercent = Math.round((fontSize / DEFAULT_BOOK_FONT.defaultFontSize) * 100);

  const applyFontSize = (value: number) => {
    const clamped = Math.min(MAX_FONT_ZOOM_SIZE, Math.max(minFontSize, value));
    if (clamped === fontSize) return;
    saveViewSettings(envConfig, bookKey, 'defaultFontSize', clamped, true, true);
  };

  const resetFontSize = () => applyFontSize(DEFAULT_BOOK_FONT.defaultFontSize);

  return (
    <div className='font-zoom-toggler flex items-center'>
      <Button
        icon={<MdZoomOut size={20} />}
        onClick={() => applyFontSize(fontSize - FONT_ZOOM_STEP)}
        label={_('Zoom Out')}
        disabled={fontSize <= minFontSize}
      />
      <button
        title={_('Reset Font Size')}
        aria-label={_('Reset Font Size')}
        onClick={resetFontSize}
        disabled={zoomPercent === 100}
        className={clsx(
          'hover:bg-base-300 text-base-content min-w-10 rounded-md px-1 py-1 text-center text-sm',
          zoomPercent === 100 && 'text-base-content/50',
        )}
      >
        {zoomPercent}%
      </button>
      <Button
        icon={<MdZoomIn size={20} />}
        onClick={() => applyFontSize(fontSize + FONT_ZOOM_STEP)}
        label={_('Zoom In')}
        disabled={fontSize >= MAX_FONT_ZOOM_SIZE}
      />
    </div>
  );
};

export default FontZoomToggler;
