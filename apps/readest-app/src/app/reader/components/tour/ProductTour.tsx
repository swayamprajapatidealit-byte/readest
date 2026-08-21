'use client';

import React, { useEffect, useState } from 'react';
import { MdClose, MdPerson, MdLocationOn, MdMenuBook } from 'react-icons/md';

import { useTranslation } from '@/hooks/useTranslation';
import { useEnv } from '@/context/EnvContext';
import { useReaderStore } from '@/store/readerStore';
import { eventDispatcher } from '@/utils/event';
import { saveViewSettings } from '@/helpers/settings';
import { FoliateView } from '@/types/view';

// Reuses the exact icons the entity panel itself uses (entity/Content.tsx) so
// the legend matches what the reader will actually see. Footnotes are
// deliberately excluded — they use the book's own footnote markers, not this
// icon, so they're outside the scope of this tour.
const ICON_LEGEND = [
  { Icon: MdPerson, label: 'Person' },
  { Icon: MdLocationOn, label: 'Place' },
  { Icon: MdMenuBook, label: 'Term' },
];

const ENTITY_ICON_CATEGORIES = new Set(['character', 'place', 'glossary']);

/**
 * Locate a currently-rendered entity icon inside the book's iframe(s) and
 * return its bounding box translated into top-document viewport coordinates
 * (icon rects from `getBoundingClientRect()` are relative to the iframe's own
 * viewport, so the iframe's own offset has to be added back in).
 */
const findLiveEntityIconRect = (view: FoliateView | null): DOMRect | null => {
  const docs = view?.renderer.getContents() ?? [];
  for (const { doc } of docs) {
    const icon = doc?.querySelector('[data-entity-icon]');
    const iframeEl = doc?.defaultView?.frameElement as HTMLIFrameElement | null;
    if (icon && iframeEl) {
      const iframeRect = iframeEl.getBoundingClientRect();
      const iconRect = icon.getBoundingClientRect();
      return new DOMRect(
        iframeRect.left + iconRect.left,
        iframeRect.top + iconRect.top,
        iconRect.width,
        iconRect.height,
      );
    }
  }
  return null;
};

type TourPhase = 'find-icon' | 'panel-open';

const ProductTour: React.FC = () => {
  const _ = useTranslation();
  const { envConfig } = useEnv();
  const getView = useReaderStore((s) => s.getView);
  const getViewSettings = useReaderStore((s) => s.getViewSettings);
  const [isActive, setIsActive] = useState(false);
  const [bookKey, setBookKey] = useState('');
  const [phase, setPhase] = useState<TourPhase>('find-icon');
  const [iconRect, setIconRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const handleStart = (event: CustomEvent) => {
      const detail = event.detail as { bookKey?: string } | undefined;
      if (!detail?.bookKey) return;
      // Entity icons default to on, but this pane may have had one or more
      // categories switched off (EntityIconsToggler) — force them all on so
      // the tour isn't waiting for an icon that can never appear.
      const viewSettings = getViewSettings(detail.bookKey);
      if (viewSettings && !(viewSettings.entityIconsCharactersEnabled ?? true)) {
        saveViewSettings(
          envConfig,
          detail.bookKey,
          'entityIconsCharactersEnabled',
          true,
          true,
          false,
        );
      }
      if (viewSettings && !(viewSettings.entityIconsPlacesEnabled ?? true)) {
        saveViewSettings(envConfig, detail.bookKey, 'entityIconsPlacesEnabled', true, true, false);
      }
      if (viewSettings && !(viewSettings.entityIconsGlossaryEnabled ?? true)) {
        saveViewSettings(
          envConfig,
          detail.bookKey,
          'entityIconsGlossaryEnabled',
          true,
          true,
          false,
        );
      }
      eventDispatcher.dispatch('entity-icon-settings-changed', { bookKey: detail.bookKey });

      setBookKey(detail.bookKey);
      setPhase('find-icon');
      setIsActive(true);
    };
    eventDispatcher.on('start-product-tour', handleStart);
    return () => {
      eventDispatcher.off('start-product-tour', handleStart);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While waiting for the reader to spot and click a real icon, keep
  // re-locating one: pages turn, icons re-render as progress advances.
  useEffect(() => {
    if (!isActive || phase !== 'find-icon') {
      setIconRect(null);
      return;
    }
    const update = () => setIconRect(findLiveEntityIconRect(getView(bookKey)));
    update();
    const interval = window.setInterval(update, 400);
    window.addEventListener('resize', update);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('resize', update);
    };
  }, [isActive, phase, bookKey, getView]);

  // The actual gate: only a real click on a real entity icon — the same
  // 'entity-panel-open' event iframeEventHandlers.ts dispatches from
  // [data-entity-icon] — advances the tour. There is no "Next" button here.
  useEffect(() => {
    if (!isActive || phase !== 'find-icon') return;
    const handleEntityOpen = (event: CustomEvent) => {
      const detail = event.detail as { bookKey?: string; category?: string } | undefined;
      if (detail?.bookKey !== bookKey) return;
      if (!detail.category || !ENTITY_ICON_CATEGORIES.has(detail.category)) return;
      setPhase('panel-open');
    };
    eventDispatcher.on('entity-panel-open', handleEntityOpen);
    return () => {
      eventDispatcher.off('entity-panel-open', handleEntityOpen);
    };
  }, [isActive, phase, bookKey]);

  if (!isActive) return null;

  const handleClose = () => setIsActive(false);

  return (
    <>
      {phase === 'find-icon' && iconRect && (
        <div
          aria-hidden='true'
          className='pointer-events-none fixed z-[48] rounded-full'
          style={{
            left: iconRect.left - 6,
            top: iconRect.top - 6,
            width: iconRect.width + 12,
            height: iconRect.height + 12,
          }}
        >
          <span className='border-primary absolute inset-0 rounded-full border-2' />
          <span className='border-primary not-eink:animate-ping absolute inset-0 rounded-full border-2' />
        </div>
      )}
      <div
        role='dialog'
        aria-label={_('Product Tour')}
        className='bg-base-100 eink-bordered fixed inset-x-0 bottom-0 z-[48] mx-auto max-w-md rounded-t-lg border p-4 shadow-2xl sm:bottom-6 sm:rounded-lg'
      >
        <button
          type='button'
          aria-label={_('Close')}
          onClick={handleClose}
          className='btn btn-ghost btn-circle btn-sm absolute right-2 top-2'
        >
          <MdClose size={16} />
        </button>
        {phase === 'find-icon' ? (
          <>
            <h3 className='text-base-content mb-1.5 pr-8 text-base font-semibold'>
              {_('Find and tap an icon')}
            </h3>
            <p className='text-base-content/80 mb-3 text-sm leading-relaxed'>
              {_(
                'Small icons like this appear next to character names, places, and terms. Keep reading until you spot one, then tap it to continue.',
              )}
            </p>
            <div className='mb-1 flex flex-wrap gap-3'>
              {ICON_LEGEND.map(({ Icon, label }) => (
                <span
                  key={label}
                  className='text-base-content/70 flex items-center gap-1.5 text-xs'
                >
                  <span className='bg-primary/10 text-primary eink-bordered flex h-6 w-6 items-center justify-center rounded-full'>
                    <Icon size={14} />
                  </span>
                  {_(label)}
                </span>
              ))}
            </div>
            <p className='text-base-content/50 mt-2 text-xs'>{_('Step 1 of 2')}</p>
          </>
        ) : (
          <>
            <h3 className='text-base-content mb-1.5 pr-8 text-base font-semibold'>
              {_('This is the entity panel')}
            </h3>
            <p className='text-base-content/80 mb-3 text-sm leading-relaxed'>
              {_(
                'Tapping an icon opens this panel with more detail. Information you’ve already seen collapses under "Previously seen" so new content stands out as you keep reading.',
              )}
            </p>
            <div className='flex items-center justify-between'>
              <span className='text-base-content/50 text-xs'>{_('Step 2 of 2')}</span>
              <button className='btn btn-contrast btn-sm' onClick={handleClose}>
                {_('Got it')}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default ProductTour;
