'use client';

import clsx from 'clsx';
import React, { useEffect } from 'react';

import { useTranslation } from '@/hooks/useTranslation';
import { usePanelResize } from '@/hooks/usePanelResize';
import useShortcuts from '@/hooks/useShortcuts';
import { useThemeStore } from '@/store/themeStore';
import { useBookDataStore } from '@/store/bookDataStore';
import { useReaderStore } from '@/store/readerStore';
import { useBookProgress } from '@/store/readerProgressStore';
import { useEntityPanelStore, type SelectedEntityRef } from '@/store/entityPanelStore';
import { eventDispatcher } from '@/utils/event';
import { getBookDirFromLanguage } from '@/utils/book';
import { getPanelTopInset } from '@/utils/insets';
import { Overlay } from '@/components/Overlay';
import EntityPanelHeader from './Header';
import { CharacterContent, FootnoteContent, GlossaryContent, PlaceContent } from './Content';

const MIN_ENTITY_PANEL_WIDTH = 0.2;
const MAX_ENTITY_PANEL_WIDTH = 0.45;

const isSelectedEntityRef = (detail: unknown): detail is SelectedEntityRef => {
  const value = detail as Partial<SelectedEntityRef> | null;
  return (
    !!value &&
    typeof value.bookKey === 'string' &&
    (value.category === 'character' ||
      value.category === 'place' ||
      value.category === 'glossary' ||
      value.category === 'footnote') &&
    typeof value.entityIndex === 'number'
  );
};

const EntityPanel: React.FC = () => {
  const _ = useTranslation();
  const { safeAreaInsets } = useThemeStore();
  const getBookData = useBookDataStore((s) => s.getBookData);
  const getViewSettings = useReaderStore((s) => s.getViewSettings);

  const isEntityPanelVisible = useEntityPanelStore((s) => s.isEntityPanelVisible);
  const isEntityPanelPinned = useEntityPanelStore((s) => s.isEntityPanelPinned);
  const entityPanelWidth = useEntityPanelStore((s) => s.entityPanelWidth);
  const selectedEntityRef = useEntityPanelStore((s) => s.selectedEntityRef);
  const setEntityPanelVisible = useEntityPanelStore((s) => s.setEntityPanelVisible);
  const toggleEntityPanelPin = useEntityPanelStore((s) => s.toggleEntityPanelPin);
  const setEntityPanelWidth = useEntityPanelStore((s) => s.setEntityPanelWidth);
  const setSelectedEntityRef = useEntityPanelStore((s) => s.setSelectedEntityRef);

  // Reactive, unlike readerStore's imperative `getProgress` — so a pinned panel's
  // phased content (biography/facts/etc.) reveals more as the reader keeps going,
  // mirroring the icon's own live-updating gating (FoliateViewer.tsx).
  const progress = useBookProgress(selectedEntityRef?.bookKey ?? null);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  useEffect(() => {
    const handleOpen = (event: CustomEvent) => {
      if (!isSelectedEntityRef(event.detail)) return;
      setSelectedEntityRef(event.detail);
      setEntityPanelVisible(true);
    };
    // Dismiss an unpinned panel on navigation, same as Notebook — a popover
    // opened for one click shouldn't linger as the reader moves on.
    const handleNavigate = () => {
      const { isEntityPanelPinned } = useEntityPanelStore.getState();
      if (!isEntityPanelPinned) setEntityPanelVisible(false);
    };
    eventDispatcher.on('entity-panel-open', handleOpen);
    eventDispatcher.on('navigate', handleNavigate);
    return () => {
      eventDispatcher.off('entity-panel-open', handleOpen);
      eventDispatcher.off('navigate', handleNavigate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = () => setEntityPanelVisible(false);
  useShortcuts({ onEscape: handleClose }, [handleClose]);

  const { handleResizeStart, handleResizeKeyDown } = usePanelResize({
    side: 'end',
    minWidth: MIN_ENTITY_PANEL_WIDTH,
    maxWidth: MAX_ENTITY_PANEL_WIDTH,
    getWidth: () => entityPanelWidth,
    onResize: setEntityPanelWidth,
  });

  if (!isEntityPanelVisible || !selectedEntityRef) return null;

  const { bookKey, category, entityIndex } = selectedEntityRef;
  const bookData = getBookData(bookKey);
  const ebookContent = bookData?.ebookContent;
  if (!ebookContent) return null;

  const progressFraction = progress?.fraction ?? 0;
  const resolved = (() => {
    switch (category) {
      case 'character': {
        const entity = ebookContent.characters[entityIndex];
        if (!entity) return null;
        return {
          title: entity.name,
          content: <CharacterContent entity={entity} progressFraction={progressFraction} />,
        };
      }
      case 'place': {
        const entity = ebookContent.places[entityIndex];
        if (!entity) return null;
        return {
          title: entity.name,
          content: <PlaceContent entity={entity} progressFraction={progressFraction} />,
        };
      }
      case 'glossary': {
        const entity = ebookContent.glossary[entityIndex];
        if (!entity) return null;
        return { title: entity.term, content: <GlossaryContent entity={entity} /> };
      }
      case 'footnote': {
        const entity = ebookContent.footnotes[entityIndex];
        if (!entity) return null;
        return { title: entity.source_label, content: <FootnoteContent entity={entity} /> };
      }
    }
  })();
  if (!resolved) return null;

  const viewSettings = getViewSettings(bookKey);
  const languageDir = getBookDirFromLanguage(bookData?.book?.primaryLanguage);

  return (
    <>
      {!isEntityPanelPinned && (
        <Overlay
          className={clsx('z-[45]', viewSettings?.isEink ? '' : 'bg-black/50 sm:bg-black/20')}
          onDismiss={handleClose}
        />
      )}
      <div
        className={clsx(
          'entity-panel-container right-0 flex min-w-60 select-none flex-col',
          'full-height font-sans text-base font-normal sm:text-sm',
          viewSettings?.isEink ? 'bg-base-100' : 'bg-base-200',
          isEntityPanelPinned ? 'z-20' : 'z-[45] shadow-2xl',
          !isEntityPanelPinned && viewSettings?.isEink && 'border-base-content border-s',
        )}
        role='group'
        aria-label={_('Entity Info')}
        dir={viewSettings?.rtl && languageDir === 'rtl' ? 'rtl' : 'ltr'}
        style={{
          width: isMobile ? '100%' : entityPanelWidth,
          maxWidth: isMobile ? '100%' : `${MAX_ENTITY_PANEL_WIDTH * 100}%`,
          position: isMobile ? 'fixed' : isEntityPanelPinned ? 'relative' : 'absolute',
          paddingTop: `${getPanelTopInset({
            isMobile,
            isFullHeightInMobile: true,
            systemUIVisible: false,
            statusBarHeight: 0,
            safeAreaInsets,
          })}px`,
        }}
      >
        <div
          className={clsx(
            'drag-bar absolute -left-2 top-0 h-full w-0.5 cursor-col-resize bg-transparent p-2',
            isMobile && 'hidden',
          )}
          role='slider'
          tabIndex={0}
          aria-label={_('Resize Panel')}
          aria-orientation='horizontal'
          aria-valuenow={parseFloat(entityPanelWidth) || 0}
          onMouseDown={handleResizeStart}
          onTouchStart={handleResizeStart}
          onKeyDown={handleResizeKeyDown}
        />
        <EntityPanelHeader
          title={resolved.title}
          category={category}
          isPinned={isEntityPanelPinned}
          handleClose={handleClose}
          handleTogglePin={toggleEntityPanelPin}
        />
        <div className='flex-grow overflow-y-auto px-4 py-2'>{resolved.content}</div>
      </div>
    </>
  );
};

export default EntityPanel;
