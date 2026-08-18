import clsx from 'clsx';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { VscClose } from 'react-icons/vsc';
import { MdOutlineMenu } from 'react-icons/md';

import { Insets } from '@/types/misc';
import { useEnv } from '@/context/EnvContext';
import { useThemeStore } from '@/store/themeStore';
import { useReaderStore } from '@/store/readerStore';
import { useSidebarStore } from '@/store/sidebarStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useSettingsStore } from '@/store/settingsStore';
import { useResponsiveSize } from '@/hooks/useResponsiveSize';
import { useSpatialNavigation } from '@/app/reader/hooks/useSpatialNavigation';
import { getHighlightColorHex } from '../utils/annotatorUtil';
import { annotationToolQuickActions } from './annotator/AnnotationTools';
import { AnnotationToolType } from '@/types/annotator';
import { saveViewSettings } from '@/helpers/settings';
import { getHeaderTriggerHeight } from '@/utils/insets';
import { HighlighterIcon } from '@/components/HighlighterIcon';
import Dropdown from '@/components/Dropdown';
import QuickActionMenu from './annotator/QuickActionMenu';
import SidebarToggler from './SidebarToggler';
import BookmarkToggler from './BookmarkToggler';
import NotebookToggler from './NotebookToggler';
import SettingsToggler from './SettingsToggler';
import ViewMenu from './ViewMenu';

interface HeaderBarProps {
  bookKey: string;
  bookTitle: string;
  isHoveredAnim: boolean;
  gridInsets: Insets;
  screenInsets: Insets;
  onCloseBook: (bookKey: string) => void;
  onDropdownOpenChange?: (isOpen: boolean) => void;
}

const HeaderBar: React.FC<HeaderBarProps> = ({
  bookKey,
  bookTitle,
  isHoveredAnim,
  gridInsets,
  screenInsets,
  onCloseBook,
  onDropdownOpenChange,
}) => {
  const _ = useTranslation();
  const { envConfig } = useEnv();
  const { settings } = useSettingsStore();
  const headerRef = useRef<HTMLDivElement>(null);
  const { isSideBarVisible } = useSidebarStore();
  const { hoveredBookKey } = useReaderStore();
  const { isDarkMode, systemUIVisible, statusBarHeight } = useThemeStore();
  const { getView, getViewSettings, setHoveredBookKey } = useReaderStore();
  const viewSettings = getViewSettings(bookKey);
  const bookKeys = useReaderStore((s) => s.bookKeys);
  const isPrimary = useReaderStore((s) => s.viewStates[bookKey]?.isPrimary ?? true);
  // Multiple panes open (split view / parallel read): the primary pane keeps
  // its progress, so it can't be closed away individually while a secondary
  // pane is still open — only secondary panes get a close button then. A
  // single open book (always primary) is unaffected and keeps its button.
  const isSplitView = bookKeys.length > 1;
  const showCloseButton = !isSplitView || !isPrimary;

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [headerWidth, setHeaderWidth] = useState(0);
  const view = getView(bookKey);
  const iconSize18 = useResponsiveSize(18);

  const docs = view?.renderer.getContents() ?? [];
  const pointerInDoc = docs.some(({ doc }) => doc?.body?.style.cursor === 'pointer');

  const enableAnnotationQuickActions = viewSettings?.enableAnnotationQuickActions;
  const annotationQuickActionButton =
    annotationToolQuickActions.find(
      (button) => button.type === viewSettings?.annotationQuickAction,
    ) || annotationToolQuickActions[0]!;
  const annotationQuickAction = viewSettings?.annotationQuickAction;
  const AnnotationToolQuickActionIcon = annotationQuickActionButton.Icon;
  const highlightStyle = settings.globalReadSettings.highlightStyle;
  const highlightColor = settings.globalReadSettings.highlightStyles[highlightStyle];
  const highlightHexColor = getHighlightColorHex(settings, highlightColor);

  const handleToggleDropdown = (isOpen: boolean) => {
    setIsDropdownOpen(isOpen);
    onDropdownOpenChange?.(isOpen);
    if (!isOpen) setHoveredBookKey('');
  };

  const handleAnnotationQuickActionSelect = (action: AnnotationToolType | null) => {
    if (viewSettings?.annotationQuickAction === action) action = null;
    saveViewSettings(envConfig, bookKey, 'annotationQuickAction', action, false, true);
  };

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setHeaderWidth(entry.contentRect.width);
    });
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  // Check if mouse is outside header area to avoid false positive event of MouseLeave when clicking inside header on Windows
  const isMouseOutsideHeader = useCallback((clientX: number, clientY: number) => {
    if (!headerRef.current) return true;

    const rect = headerRef.current.getBoundingClientRect();
    return (
      clientX <= rect.left || clientX >= rect.right || clientY <= rect.top || clientY >= rect.bottom
    );
  }, []);

  const isHeaderCompact = headerWidth > 0 && headerWidth < 350;
  const insets = window.innerWidth < 640 ? screenInsets : gridInsets;
  const isHeaderVisible = hoveredBookKey === bookKey || isDropdownOpen;
  const isMobile = window.innerWidth < 640;
  const triggerHeight = viewSettings ? getHeaderTriggerHeight(gridInsets.top, viewSettings) : 0;

  useSpatialNavigation(headerRef, isHeaderVisible);

  return (
    <div
      className={clsx(
        // pointer-events-none: the wrapper is as tall as its safe-area
        // padding, so on notch devices its box covers the top inset strip and
        // swallowed long presses on text rendered there (#5429) — children
        // that take input restore pointer-events themselves.
        'pointer-events-none left-0 top-0 w-full',
        isHeaderVisible && 'bg-base-100',
        window.innerWidth < 640 ? 'fixed z-20' : 'absolute',
      )}
      style={{
        paddingTop: `${insets.top}px`,
      }}
    >
      {/*
        Hover trigger area. Mobile has no hover and toggles the bars by tapping
        the page (usePagination), so this must not take pointer events there —
        it used to be a fixed 44px tall, the same as the default page-header
        margin, so with the page header off (compact 16px margin) it covered the
        first line of text and swallowed long presses on it (#5429). Mirrors the
        footer's trigger. Its height now tracks the content top on every
        platform, so the strip can never reach past where the text starts and
        block a selection (#4977).
      */}
      <div
        role='none'
        tabIndex={-1}
        className={clsx(
          'absolute top-0 z-10 w-full',
          isMobile || pointerInDoc ? 'pointer-events-none' : 'pointer-events-auto',
        )}
        style={{ height: `${triggerHeight}px` }}
        onClick={() => setHoveredBookKey(bookKey)}
        onMouseEnter={() => setHoveredBookKey(bookKey)}
        onTouchStart={() => setHoveredBookKey(bookKey)}
      />
      <div
        className={clsx(
          'bg-base-100 absolute left-0 right-0 top-0 z-10',
          isHeaderVisible ? 'visible' : 'hidden',
        )}
        style={{
          height: systemUIVisible ? `${Math.max(insets.top, statusBarHeight)}px` : '0px',
        }}
      />
      <div
        ref={headerRef}
        role='banner'
        aria-label={_('Header Bar')}
        className={clsx(
          `header-bar bg-base-100 absolute top-0 z-10 flex h-11 w-full items-center pr-4`,
          `shadow-xs transition-[opacity,margin-top] duration-300`,
          isSideBarVisible ? 'ps-4' : 'ps-4 sm:ps-1.5',
          isHoveredAnim && 'hover-bar-anim',
          isHeaderVisible ? 'pointer-events-auto visible' : 'pointer-events-none opacity-0',
          isDropdownOpen && 'header-bar-pinned',
        )}
        style={{
          marginTop: systemUIVisible
            ? `${Math.max(insets.top, statusBarHeight)}px`
            : `${insets.top}px`,
        }}
        onFocus={() => setHoveredBookKey(bookKey)}
        onMouseLeave={(e) => {
          if (isMouseOutsideHeader(e.clientX, e.clientY)) {
            setHoveredBookKey('');
          }
        }}
      >
        <div className='header-tools-start bg-base-100 sidebar-bookmark-toggler z-20 flex h-full min-w-0 items-center gap-x-4 pe-2 max-[350px]:gap-x-2'>
          {/* h-full so this scroller spans the whole bar: `overflow-x-auto`
              also clips vertically, and shrink-wrapped to the 32px icons it
              cut the buttons' touch halos back down to 32px (#5401). */}
          {/* no-scrollbar: the overlay scrollbar of `overflow-x-auto` owns a
              hit-test strip at the scroller's bottom edge on Android, which
              cut the touch halos short of the 44px target (#5401) —
              `scrollbar-width: none` alone does not remove that strip. */}
          <div className='no-scrollbar flex h-full min-w-0 items-center gap-x-4 overflow-x-auto max-[350px]:gap-x-2'>
            {!isSideBarVisible && (
              <div className='hidden sm:flex'>
                <SidebarToggler bookKey={bookKey} />
              </div>
            )}
            {showCloseButton && (
              <button
                title={_('Close Book')}
                className='btn btn-ghost hidden h-8 min-h-8 w-8 p-0 sm:flex'
                onClick={() => onCloseBook(bookKey)}
              >
                <VscClose size={iconSize18} className='fill-base-content' />
              </button>
            )}
            <BookmarkToggler bookKey={bookKey} />
          </div>
          {enableAnnotationQuickActions && (
            <Dropdown
              label={
                annotationQuickAction
                  ? _('Disable Quick Action')
                  : _('Enable Quick Action on Selection')
              }
              className='exclude-title-bar-mousedown dropdown-bottom dropdown-center'
              menuClassName='!relative'
              buttonClassName={clsx(
                'btn btn-ghost h-8 min-h-8 w-8 p-0',
                viewSettings?.annotationQuickAction && 'bg-base-300/50',
              )}
              toggleButton={
                annotationQuickAction === 'highlight' || annotationQuickAction === null ? (
                  <HighlighterIcon
                    size={iconSize18}
                    tipColor={annotationQuickAction === null ? '#8F8F8F' : highlightHexColor}
                    tipStyle={{
                      opacity: annotationQuickAction === null ? 0.5 : 0.8,
                      mixBlendMode: isDarkMode ? 'screen' : 'multiply',
                    }}
                  />
                ) : (
                  <AnnotationToolQuickActionIcon size={iconSize18} />
                )
              }
              onToggle={handleToggleDropdown}
            >
              <QuickActionMenu
                selectedAction={viewSettings.annotationQuickAction}
                onActionSelect={handleAnnotationQuickActionSelect}
              />
            </Dropdown>
          )}
        </div>

        <div
          role='contentinfo'
          aria-label={_('Title') + ' - ' + bookTitle}
          className={clsx(
            'header-title z-15 bg-base-100 pointer-events-none hidden flex-1 items-center justify-center sm:flex',
            'absolute inset-0',
            isHeaderCompact && '!hidden',
          )}
        >
          <div
            aria-hidden='true'
            className={clsx(
              'flex max-w-[50%] items-center justify-center gap-x-1.5',
              'line-clamp-1 text-center text-xs font-semibold',
            )}
          >
            {isSplitView && (
              <span className='badge badge-sm shrink-0'>
                {isPrimary ? _('Primary') : _('Secondary')}
              </span>
            )}
            <span className='line-clamp-1'>{bookTitle}</span>
          </div>
        </div>

        <div className='header-tools-end bg-base-100 z-20 ms-auto flex h-full min-w-max items-center gap-x-4 ps-2 max-[350px]:gap-x-2'>
          {!isHeaderCompact && <SettingsToggler bookKey={bookKey} />}
          <NotebookToggler bookKey={bookKey} />
          <Dropdown
            label={_('View Options')}
            containerClassName='h-8'
            className='exclude-title-bar-mousedown dropdown-bottom dropdown-end'
            buttonClassName='btn btn-ghost h-8 min-h-8 w-8 p-0 mt-0'
            toggleButton={<MdOutlineMenu />}
            onToggle={handleToggleDropdown}
          >
            <ViewMenu bookKey={bookKey} />
          </Dropdown>
        </div>
      </div>
    </div>
  );
};

export default HeaderBar;
