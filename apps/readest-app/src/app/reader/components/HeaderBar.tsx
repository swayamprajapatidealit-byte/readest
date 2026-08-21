import clsx from 'clsx';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { VscClose } from 'react-icons/vsc';
import { MdOutlineMenu, MdPushPin, MdOutlinePushPin } from 'react-icons/md';

import { Insets } from '@/types/misc';
import { useEnv } from '@/context/EnvContext';
import { useThemeStore } from '@/store/themeStore';
import { useReaderStore } from '@/store/readerStore';
import { useSidebarStore } from '@/store/sidebarStore';
import { useBookDataStore } from '@/store/bookDataStore';
import { useHeaderPinStore } from '@/store/headerPinStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useResponsiveSize } from '@/hooks/useResponsiveSize';
import { useSpatialNavigation } from '@/app/reader/hooks/useSpatialNavigation';
import { getHeaderTriggerHeight } from '@/utils/insets';
import { getOrdinal } from '@/utils/misc';
import { saveViewSettings } from '@/helpers/settings';
import Dropdown from '@/components/Dropdown';
import Button from '@/components/Button';
import BackToLibraryToggler from './BackToLibraryToggler';
import SidebarToggler from './SidebarToggler';
import BookmarkToggler from './BookmarkToggler';
import EntityIconsToggler from './EntityIconsToggler';
import FontZoomToggler from './FontZoomToggler';
import DisplaySettingsToggler from './DisplaySettingsToggler';
import HeaderSearchInput from './HeaderSearchInput';
import HeaderMenu from './HeaderMenu';
import PageJumpInput from './footerbar/PageJumpInput';

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
  const headerRef = useRef<HTMLDivElement>(null);
  const { isSideBarVisible } = useSidebarStore();
  const { hoveredBookKey } = useReaderStore();
  const { systemUIVisible, statusBarHeight } = useThemeStore();
  const { getView, getViewSettings, setHoveredBookKey } = useReaderStore();
  const viewSettings = getViewSettings(bookKey);
  const bookKeys = useReaderStore((s) => s.bookKeys);
  const isPrimary = useReaderStore((s) => s.viewStates[bookKey]?.isPrimary ?? true);
  const isPinned = useHeaderPinStore((s) => s.isHeaderPinned(bookKey));
  const toggleHeaderPin = useHeaderPinStore((s) => s.toggleHeaderPin);
  const iconSize = useResponsiveSize(20);
  // Multiple panes open (split view / parallel read): the primary pane keeps
  // its progress, so it can't be closed away individually while a secondary
  // pane is still open — only secondary panes get a close button then. A
  // single open book (always primary) is unaffected. In split view the back-
  // to-library button doesn't make sense (there's more than one book open),
  // so that slot reverts to the plain "close this pane" button instead.
  const isSplitView = bookKeys.length > 1;
  const showCloseButton = isSplitView && !isPrimary;

  const bookDetail = useBookDataStore((s) => s.getBookData(bookKey))?.bookDetail;
  const editionHistory = bookDetail?.editionHistory;
  const editionMajorVersion = editionHistory?.length
    ? parseInt(editionHistory[0]!.version.split('.')[0]!, 10)
    : 0;
  const editionOrdinal = editionMajorVersion > 0 ? getOrdinal(editionMajorVersion) : '1st';
  const editionLabel = _('{{ordinal}} MeBook Edition', { ordinal: editionOrdinal });

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [headerWidth, setHeaderWidth] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0);
  const view = getView(bookKey);

  const docs = view?.renderer.getContents() ?? [];
  const pointerInDoc = docs.some(({ doc }) => doc?.body?.style.cursor === 'pointer');

  const handleToggleDropdown = (isOpen: boolean) => {
    setIsDropdownOpen(isOpen);
    onDropdownOpenChange?.(isOpen);
    if (!isOpen) setHoveredBookKey('');
  };

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setHeaderWidth(entry.contentRect.width);
      setHeaderHeight(entry.contentRect.height);
    });
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  // Pinning keeps the header permanently on screen instead of only on hover —
  // it would otherwise sit on top of the first line(s) of text, since the
  // reserved top margin is normally sized for the transient hover chrome
  // only. Bump the margin up (never down — same one-way convention as
  // LayoutPanel's own showHeader/showFooter margin bumps) to fully clear it.
  useEffect(() => {
    if (!isPinned || !headerHeight || !viewSettings) return;
    if (viewSettings.marginTopPx >= headerHeight) return;
    saveViewSettings(envConfig, bookKey, 'marginTopPx', Math.ceil(headerHeight), false, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPinned, headerHeight, bookKey]);

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
  const isHeaderVisible = isPinned || hoveredBookKey === bookKey || isDropdownOpen;
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
        isHeaderVisible && 'bg-base-200',
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
        block a selection (#4977). Skipped entirely while pinned — the header
        is already always on, so there's nothing left for a hover strip to do.
      */}
      {!isPinned && (
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
      )}
      <div
        className={clsx(
          'bg-base-200 absolute left-0 right-0 top-0 z-10',
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
          `header-bar bg-base-200 absolute top-0 z-10 flex w-full flex-col`,
          `shadow-sm transition-[opacity,margin-top] duration-300`,
          isHoveredAnim && 'hover-bar-anim',
          isHeaderVisible ? 'pointer-events-auto visible' : 'pointer-events-none opacity-0',
          (isDropdownOpen || isPinned) && 'header-bar-pinned',
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
        {/* Purely decorative accent — a colorful gradient in normal mode,
            collapsing to a flat solid bar under e-ink (no gradients there). */}
        <div
          aria-hidden='true'
          className='not-eink:bg-gradient-to-r not-eink:from-primary not-eink:via-secondary not-eink:to-accent eink:bg-base-content absolute inset-x-0 top-0 z-20 h-[3px]'
        />
        <div
          className={clsx(
            'flex h-16 w-full items-center pr-3',
            isSideBarVisible ? 'ps-4' : 'ps-4 sm:ps-2',
          )}
        >
          <div className='header-tools-start bg-base-200 sidebar-bookmark-toggler z-20 flex h-full min-w-0 items-center gap-x-3 pe-3 max-[350px]:gap-x-2'>
            {isSplitView ? (
              showCloseButton && (
                <button
                  title={_('Close Book')}
                  className='btn btn-ghost hidden h-8 min-h-8 w-8 p-0 sm:flex'
                  onClick={() => onCloseBook(bookKey)}
                >
                  <VscClose size={iconSize} className='fill-base-content' />
                </button>
              )
            ) : (
              <BackToLibraryToggler />
            )}
            {!isSideBarVisible && <SidebarToggler bookKey={bookKey} />}
            <HeaderSearchInput bookKey={bookKey} />
            <PageJumpInput
              bookKey={bookKey}
              showFraction
              className='eink-bordered bg-primary/10 text-primary pointer-events-auto shrink-0 px-2.5 py-1 text-sm font-medium tabular-nums'
            />
          </div>

          <div
            role='contentinfo'
            aria-label={_('Title') + ' - ' + bookTitle}
            className={clsx(
              'header-title z-15 bg-base-200 pointer-events-none hidden flex-1 items-center justify-center sm:flex',
              'absolute inset-0',
              isHeaderCompact && '!hidden',
            )}
          >
            <div aria-hidden='true' className='flex max-w-[65%] flex-col items-center gap-y-1'>
              <div className='flex min-w-0 items-center justify-center gap-x-2 text-center text-xl font-semibold'>
                {isSplitView && (
                  <span className='badge badge-sm shrink-0'>
                    {isPrimary ? _('Primary') : _('Secondary')}
                  </span>
                )}
                <span className='line-clamp-1 min-w-0'>{bookTitle}</span>
              </div>
              <span className='eink-bordered bg-secondary/10 text-secondary line-clamp-1 rounded-full px-2.5 py-1 text-center text-xs font-medium'>
                {editionLabel}
              </span>
            </div>
          </div>

          <div className='header-tools-end bg-base-200 z-20 ms-auto flex h-full min-w-max items-center gap-x-3 ps-3 max-[350px]:gap-x-2'>
            <BookmarkToggler bookKey={bookKey} />
            <FontZoomToggler bookKey={bookKey} />
            <EntityIconsToggler bookKey={bookKey} onToggle={handleToggleDropdown} />
            <Button
              icon={
                isPinned ? (
                  <MdPushPin className='text-primary' size={iconSize} />
                ) : (
                  <MdOutlinePushPin className='text-base-content' size={iconSize} />
                )
              }
              onClick={() => toggleHeaderPin(bookKey)}
              label={isPinned ? _('Unpin Header') : _('Pin Header')}
            />
            <DisplaySettingsToggler bookKey={bookKey} onToggle={handleToggleDropdown} />
            <Dropdown
              label={_('Menu')}
              containerClassName='h-8'
              className='exclude-title-bar-mousedown dropdown-bottom dropdown-end'
              buttonClassName='btn btn-ghost h-8 min-h-8 w-8 p-0 mt-0'
              toggleButton={<MdOutlineMenu size={22} />}
              onToggle={handleToggleDropdown}
            >
              <HeaderMenu bookKey={bookKey} />
            </Dropdown>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeaderBar;
