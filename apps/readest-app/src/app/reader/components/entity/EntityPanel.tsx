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
import { markEntityInfoSeen } from '@/store/entityViewMemoryStore';
import { getVisibleFactIds, resolveEntity } from '@/app/reader/utils/entityFacts';
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
    typeof value.entityIndex === 'number' &&
    (value.side === 'left' || value.side === 'right')
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

  // Marks the entity's currently-visible facts as seen so its icon can
  // suppress once opened, and re-fires as progress advances while the panel
  // stays open (e.g. pinned across page turns) to pick up newly-unlocked facts.
  useEffect(() => {
    if (!isEntityPanelVisible || !selectedEntityRef) return;
    const { bookKey, category, entityIndex } = selectedEntityRef;
    if (category === 'footnote') return;
    const ebookContent = getBookData(bookKey)?.ebookContent;
    if (!ebookContent) return;
    const entity = resolveEntity(ebookContent, category, entityIndex);
    if (!entity) return;
    const visibleIds = getVisibleFactIds(entity, category, entityIndex, progress?.fraction ?? 0);
    if (visibleIds.length === 0) return;
    const bookId = bookKey.split('-')[0]!;
    const entityKey = `${category}:${entityIndex}`;
    const changed = markEntityInfoSeen(
      bookId,
      entityKey,
      visibleIds,
      progress?.index ?? 0,
      entityKey,
    );
    // The icon's suppression state can flip without progress moving at all
    // (e.g. open the panel, then close it) — nothing else would re-run the
    // icon refresh for an unchanged progress value, so ask for one directly.
    if (changed) eventDispatcher.dispatch('entity-seen-changed', { bookKey });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEntityPanelVisible, selectedEntityRef, progress]);

  const handleClose = () => setEntityPanelVisible(false);
  useShortcuts({ onEscape: handleClose }, [handleClose]);

  // Opens opposite the icon/marker that was clicked (see getEntityPanelSide,
  // utils/sel.ts) so the panel doesn't cover it — falls back to 'right' (the
  // pre-existing fixed side) before any entity has been selected yet.
  const panelSide: 'left' | 'right' = selectedEntityRef?.side === 'left' ? 'right' : 'left';

  // Document direction is always ltr in this app (no live RTL layout flip —
  // see store/themeStore.ts's theme handling), so 'start'/'end' map directly
  // to physical left/right here.
  const { handleResizeStart, handleResizeKeyDown } = usePanelResize({
    side: panelSide === 'right' ? 'end' : 'start',
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
  const content = (() => {
    switch (category) {
      case 'character': {
        const entity = ebookContent.characters[entityIndex];
        if (!entity) return null;
        return (
          <CharacterContent
            entity={entity}
            entityIndex={entityIndex}
            bookKey={bookKey}
            progressFraction={progressFraction}
          />
        );
      }
      case 'place': {
        const entity = ebookContent.places[entityIndex];
        if (!entity) return null;
        return (
          <PlaceContent
            entity={entity}
            entityIndex={entityIndex}
            bookKey={bookKey}
            progressFraction={progressFraction}
          />
        );
      }
      case 'glossary': {
        const entity = ebookContent.glossary[entityIndex];
        if (!entity) return null;
        return <GlossaryContent entity={entity} />;
      }
      case 'footnote': {
        const entity = ebookContent.footnotes[entityIndex];
        if (!entity) return null;
        return <FootnoteContent entity={entity} />;
      }
    }
  })();
  if (!content) return null;

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
          'entity-panel-container flex min-w-60 select-none flex-col',
          panelSide === 'right' ? 'right-0' : 'left-0',
          'full-height font-sans text-base font-normal',
          viewSettings?.isEink ? 'bg-base-100' : 'bg-base-200',
          isEntityPanelPinned ? 'z-20' : 'z-[45] shadow-2xl',
          // Explicit physical border (not logical border-s/border-e) — the
          // panel's screen side is independent of the book's own text
          // direction, which is what `dir` below governs instead.
          !isEntityPanelPinned &&
            viewSettings?.isEink &&
            (panelSide === 'right'
              ? 'border-base-content border-l'
              : 'border-base-content border-r'),
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
            'drag-bar absolute top-0 h-full w-0.5 cursor-col-resize bg-transparent p-2',
            panelSide === 'right' ? '-left-2' : '-right-2',
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
          isPinned={isEntityPanelPinned}
          handleClose={handleClose}
          handleTogglePin={toggleEntityPanelPin}
        />
        <div className='flex-grow overflow-y-auto px-4 py-2'>{content}</div>
      </div>
    </>
  );
};

export default EntityPanel;
