import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Insets } from '@/types/misc';
import { useThemeStore } from '@/store/themeStore';
import { useReaderStore } from '@/store/readerStore';
import { useBookProgress } from '@/store/readerProgressStore';
import { useSidebarStore } from '@/store/sidebarStore';
import { useBookDataStore } from '@/store/bookDataStore';
import { useTranslation } from '@/hooks/useTranslation';
import { getGridTemplate, getInsetEdges } from '@/utils/grid';
import { useContentInsets } from '../hooks/useContentInsets';
import { useSplitDividerResize } from '../hooks/useSplitDividerResize';
import SearchResultsNav from './sidebar/SearchResultsNav';
import BooknotesNav from './sidebar/BooknotesNav';
import FoliateViewer from './FoliateViewer';
import SectionInfo from './SectionInfo';
import HeaderBar from './HeaderBar';
import PageNavigationButtons from './PageNavigationButtons';
import FooterBar from './footerbar/FooterBar';
import ProgressBar from './ProgressBar';
import BookmarkPullDown from './BookmarkPullDown';
import Annotator from './annotator/Annotator';
import FootnotePopup from './FootnotePopup';
import HintInfo from './HintInfo';
import ReadingRuler from './ReadingRuler';
import DoubleBorder from './DoubleBorder';
import ReadingStatsTracker from './ReadingStatsTracker';
import Spinner from '@/components/Spinner';
import SplitDivider from './SplitDivider';

interface BooksGridProps {
  bookKeys: string[];
  onCloseBook: (bookKey: string) => void;
}

/**
 * Per-book cell rendered inside the parent grid.
 *
 * Why this is its own component:
 *   - Previously BooksGrid subscribed to the *entire* `progresses` map
 *     and rendered every book inline. The map changes on every page
 *     turn, so the whole `bookKeys.map(...)` body re-ran for every
 *     swipe and every grandchild had to be re-reconciled.
 *   - On top of that, inset-related objects (`gridInsets`,
 *     `contentInsets`) were rebuilt every render and threaded into
 *     7+ children as props. React saw a fresh reference every time,
 *     so even unchanged children couldn't bail out — the commit
 *     traversal (the `up` / `ud` / `iv` recursion in the React
 *     reconciler) ran through the entire BooksGrid subtree per turn
 *     and accounted for 27% main-thread time in the Bottom-Up profile
 *     ("Animation Frame Fired" 2.6 s / 27 %).
 *
 * What this fixes:
 *   - Each BookCell subscribes only to its own book's progress via
 *     `useBookProgress(bookKey)`. A page turn re-renders one BookCell,
 *     not the entire grid.
 *   - `gridInsets` and `contentInsets` are memoized off their numeric
 *     inputs so children get stable prop references across renders.
 *   - The dropdown handler is built via useCallback so HeaderBar's
 *     props object stays stable.
 *   - The component is wrapped in React.memo at export so the parent
 *     can re-render (e.g. when bookKeys changes) without forcing this
 *     cell to.
 */
interface BookCellProps {
  bookKey: string;
  gridInsets: Insets;
  screenInsets: Insets;
  isHoveredAnim: boolean;
  hoveredBookKey: string | null;
  isDropdownOpen: boolean;
  setDropdownOpenForBook: (bookKey: string, isOpen: boolean) => void;
  onCloseBook: (bookKey: string) => void;
  // True while a split-view divider drag is being committed and this pane's
  // content is re-paginating for its new width (see useSplitDividerResize).
  isResizingSplit?: boolean;
}

const BookCellInner: React.FC<BookCellProps> = ({
  bookKey,
  gridInsets,
  screenInsets,
  isHoveredAnim,
  hoveredBookKey,
  isDropdownOpen,
  setDropdownOpenForBook,
  onCloseBook,
  isResizingSplit,
}) => {
  // Per-field selectors — see store/readerProgressStore.ts header for the
  // "destructure-subscribes-the-whole-store" rationale.
  const getConfig = useBookDataStore((s) => s.getConfig);
  const getBookData = useBookDataStore((s) => s.getBookData);

  // Per-cell reactive subscriptions. This cell re-renders when THIS book's
  // progress changes (page turns) OR its view state changes. Both are
  // needed: viewState carries `viewSettings` and `ribbonVisible`, which
  // gate the chrome this cell mounts (Show Header / Show Footer, Double
  // Border, bookmark Ribbon). Those settings save with applyStyles=false
  // and the ribbon toggle writes no progress, so without a viewState
  // subscription the toggles wouldn't take effect until the next page turn.
  //
  // Subscribing to the per-book slice is safe now that progress lives in
  // its own store: `viewStates[key]` only bumps on low-frequency events
  // (settings toggles, ribbon, init, sync), never on the per-swipe
  // relocate path — so this does NOT reintroduce the commit storm the
  // progress-store split removed.
  const progress = useBookProgress(bookKey);
  const viewState = useReaderStore((s) => s.viewStates[bookKey]);
  const viewSettings = viewState?.viewSettings ?? null;

  // config / bookData are read imperatively: their relevant fields are
  // written alongside progress (setProgress / saveConfig), so the
  // subscriptions above already drive the re-render that picks them up.
  const bookData = getBookData(bookKey);
  const config = getConfig(bookKey);
  const { book, bookDoc } = bookData || {};

  // viewInsets/contentInsets stay stable while the user is just turning pages
  // (margins are unchanged) but update when a margin setting changes — even
  // though saveViewSettings mutates viewSettings in place (#4898).
  const { viewInsets, contentInsets } = useContentInsets(viewSettings, gridInsets);

  // The page content (viewer + its header/footer chrome) that the pull-down
  // bookmark gesture slides as one block.
  const slideRef = useRef<HTMLDivElement | null>(null);

  // Stable callback so HeaderBar doesn't see a new prop reference per
  // BooksGrid render.
  const onDropdownOpenChange = useCallback(
    (isOpen: boolean) => setDropdownOpenForBook(bookKey, isOpen),
    [bookKey, setDropdownOpenForBook],
  );

  if (!book || !config || !bookDoc || !viewSettings || !viewState) return null;

  const { section, pageinfo, sectionLabel } = progress || {};
  const viewerKey = viewState.viewerKey;
  const horizontalGapPercent = viewSettings.gapPercent;
  const showHeader = viewSettings.showHeader;
  const showFooter = viewSettings.showFooter;

  return (
    <div
      id={`gridcell-${bookKey}`}
      // Layered page turns (slide/curl) snapshot this element, so the page
      // header and footer rendered as siblings of the viewer turn with the
      // page in both layers.
      data-view-transition-root=''
      className='relative h-full w-full overflow-hidden'
    >
      <HeaderBar
        bookKey={bookKey}
        gridInsets={gridInsets}
        screenInsets={screenInsets}
        bookTitle={book.title}
        isHoveredAnim={isHoveredAnim}
        onCloseBook={onCloseBook}
        onDropdownOpenChange={onDropdownOpenChange}
      />
      {/*
        bg-base-100: while the pull-down bookmark gesture translates this
        wrapper, the transform makes it a stacking context, which isolates the
        texture's mix-blend-mode (.foliate-viewer::before) from any backdrop
        outside it — the page visibly brightens for the duration of the drag.
        An opaque background inside the wrapper keeps the blend backdrop with
        the transformed group, so the drag is luminance-invariant.
      */}
      <div ref={slideRef} className='bg-base-100 absolute inset-0'>
        <FoliateViewer
          key={viewerKey}
          bookKey={bookKey}
          bookDoc={bookDoc}
          config={config}
          gridInsets={gridInsets}
          contentInsets={contentInsets}
        />
        {viewSettings.vertical && viewSettings.scrolled && (
          <>
            {(showFooter || viewSettings.doubleBorder) && (
              <div
                className='bg-base-100 absolute left-0 top-0 h-full'
                style={{
                  width: `calc(${contentInsets.left + (viewSettings.doubleBorder ? 32 : 0)}px)`,
                  height: `calc(100%)`,
                }}
              />
            )}
            {(showHeader || viewSettings.doubleBorder) && (
              <div
                className='bg-base-100 absolute right-0 top-0 h-full'
                style={{
                  width: `calc(${contentInsets.right + (viewSettings.doubleBorder ? 32 : 0)}px)`,
                  height: `calc(100%)`,
                }}
              />
            )}
          </>
        )}
        {viewSettings.vertical && viewSettings.doubleBorder && (
          <DoubleBorder
            showHeader={showHeader}
            showFooter={showFooter}
            borderColor={viewSettings.borderColor}
            horizontalGap={horizontalGapPercent}
            insets={viewInsets}
          />
        )}
        {showHeader && (
          <SectionInfo
            bookKey={bookKey}
            section={sectionLabel}
            showDoubleBorder={viewSettings.vertical && viewSettings.doubleBorder}
            isScrolled={viewSettings.scrolled}
            isVertical={viewSettings.vertical}
            isEink={viewSettings.isEink}
            horizontalGap={horizontalGapPercent}
            contentInsets={contentInsets}
            gridInsets={gridInsets}
          />
        )}
        <HintInfo
          bookKey={bookKey}
          showDoubleBorder={viewSettings.vertical && viewSettings.doubleBorder}
          isScrolled={viewSettings.scrolled}
          isVertical={viewSettings.vertical}
          isEink={viewSettings.isEink}
          horizontalGap={horizontalGapPercent}
          contentInsets={contentInsets}
          gridInsets={gridInsets}
        />
        {viewSettings.readingRulerEnabled && viewState?.inited && (
          <ReadingRuler
            bookKey={bookKey}
            isVertical={viewSettings.vertical}
            rtl={viewSettings.rtl}
            lines={viewSettings.readingRulerLines}
            position={viewSettings.readingRulerPosition}
            opacity={viewSettings.readingRulerOpacity}
            color={viewSettings.readingRulerColor}
            isFixedLayout={!!bookData?.isFixedLayout}
            viewSettings={viewSettings}
            gridInsets={gridInsets}
          />
        )}
        {showFooter && (
          <ProgressBar
            bookKey={bookKey}
            horizontalGap={horizontalGapPercent}
            contentInsets={contentInsets}
            gridInsets={gridInsets}
          />
        )}
      </div>
      <BookmarkPullDown bookKey={bookKey} ribbonHidden={!!hoveredBookKey} slideRef={slideRef} />
      <PageNavigationButtons bookKey={bookKey} isDropdownOpen={isDropdownOpen} />
      <Annotator bookKey={bookKey} contentInsets={contentInsets} />
      <SearchResultsNav bookKey={bookKey} gridInsets={gridInsets} />
      <BooknotesNav bookKey={bookKey} gridInsets={gridInsets} toc={bookDoc.toc || []} />
      <FootnotePopup bookKey={bookKey} bookDoc={bookDoc} />
      <FooterBar
        bookKey={bookKey}
        section={section}
        pageinfo={pageinfo}
        isHoveredAnim={false}
        gridInsets={gridInsets}
      />
      <ReadingStatsTracker bookKey={bookKey} />
      {/*
        Committing a divider drag resizes this pane, which forces the epub
        engine to fully re-paginate — otherwise a visible flash/white-out
        mid-reflow. A translucent, blurred veil (rather than a flat cover)
        softens that into a brief frosted-glass transition instead, and it
        sits above every other layer in this cell so nothing else (header,
        footer, ruler, etc.) visibly jumps mid-reflow either.
      */}
      {isResizingSplit && (
        <div className='bg-base-100/60 not-eink:backdrop-blur-sm eink:bg-base-100 absolute inset-0 z-30 flex items-center justify-center'>
          <Spinner loading={true} />
        </div>
      )}
    </div>
  );
};

const BookCell = React.memo(BookCellInner);

const BooksGrid: React.FC<BooksGridProps> = ({ bookKeys, onCloseBook }) => {
  const _ = useTranslation();
  // Per-field selectors — see store/readerProgressStore.ts header. The grid
  // only re-renders on hoveredBookKey changes (header/footer toggle);
  // setGridInsets is a stable action ref.
  const hoveredBookKey = useReaderStore((s) => s.hoveredBookKey);
  const setGridInsets = useReaderStore((s) => s.setGridInsets);
  const splitMainPaneFraction = useReaderStore((s) => s.splitMainPaneFraction);
  const getBookData = useBookDataStore((s) => s.getBookData);
  const sideBarBookKey = useSidebarStore((s) => s.sideBarBookKey);
  const [dropdownOpenBook, setDropdownOpenBook] = useState<string>('');

  const { safeAreaInsets: screenInsets } = useThemeStore();
  const aspectRatio = window.innerWidth / window.innerHeight;
  // The divider is only offered for a landscape 2-pane split — portrait
  // stacks and 3+ pane layouts keep their existing fixed grids untouched.
  const isDraggableSplit = bookKeys.length === 2 && aspectRatio >= 1;
  // Only meaningful for exactly 2 panes — a stale value left over from a
  // closed split view is otherwise harmless since it's never read here.
  const gridTemplate = getGridTemplate(
    bookKeys.length,
    aspectRatio,
    bookKeys.length === 2 ? splitMainPaneFraction : null,
  );

  const gridRef = useRef<HTMLDivElement>(null);
  // Called unconditionally (rules of hooks) — falls back to empty keys when
  // there isn't a draggable 2-pane split; its output is simply unused then.
  const { previewFraction, isResizing, handleDragStart, handleDragKeyDown } = useSplitDividerResize(
    gridRef,
    isDraggableSplit ? bookKeys[0]! : '',
    isDraggableSplit ? bookKeys[1]! : '',
    splitMainPaneFraction,
  );

  useEffect(() => {
    if (!sideBarBookKey) return;
    const bookData = getBookData(sideBarBookKey);
    if (!bookData || !bookData.book) return;
    document.title = bookData.book.title;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sideBarBookKey]);

  // Memoize the per-book grid insets array — its identity is the input
  // to BookCell.gridInsets, and BookCell is React.memo'd. As long as
  // bookKeys / screenInsets / aspectRatio don't change, the cells'
  // gridInsets props stay reference-equal across renders.
  const perBookGridInsets = useMemo<Insets[]>(() => {
    if (!screenInsets) return [];
    return bookKeys.map((_bookKey, index) => {
      const { top, right, bottom, left } = getInsetEdges(index, bookKeys.length, aspectRatio);
      return {
        top: top ? screenInsets.top : 0,
        right: right ? screenInsets.right : 0,
        bottom: bottom ? screenInsets.bottom : 0,
        left: left ? screenInsets.left : 0,
      };
    });
    // aspectRatio is recomputed every render but its value is window-derived
    // and won't change between resizes; including it explicitly so an
    // orientation change still busts the cache.
  }, [bookKeys, screenInsets, aspectRatio]);

  useEffect(() => {
    if (!screenInsets) return;
    bookKeys.forEach((bookKey, index) => {
      const insets = perBookGridInsets[index];
      if (insets) setGridInsets(bookKey, insets);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookKeys, screenInsets, perBookGridInsets]);

  // Stable cross-cell setter for the dropdown bookkeeping — used by the
  // memoized onDropdownOpenChange callback inside each BookCell.
  const setDropdownOpenForBook = useCallback((bookKey: string, isOpen: boolean) => {
    setDropdownOpenBook(isOpen ? bookKey : '');
  }, []);

  if (!screenInsets) return null;

  const gridStyle = {
    gridTemplateColumns: gridTemplate.columns,
    gridTemplateRows: gridTemplate.rows,
  };
  const isHoveredAnim = bookKeys.length > 2;

  return (
    <div
      ref={gridRef}
      className='books-grid bg-base-100 relative grid h-full flex-grow'
      style={gridStyle}
      role='main'
      aria-label={_('Books Content')}
    >
      {isDraggableSplit ? (
        <>
          <BookCell
            key={bookKeys[0]}
            bookKey={bookKeys[0]!}
            gridInsets={perBookGridInsets[0]!}
            screenInsets={screenInsets}
            isHoveredAnim={isHoveredAnim}
            hoveredBookKey={hoveredBookKey}
            isDropdownOpen={dropdownOpenBook === bookKeys[0]}
            setDropdownOpenForBook={setDropdownOpenForBook}
            onCloseBook={onCloseBook}
            isResizingSplit={isResizing}
          />
          <SplitDivider
            fraction={splitMainPaneFraction ?? 0.5}
            isResizing={isResizing}
            onDragStart={handleDragStart}
            onDragKeyDown={handleDragKeyDown}
          />
          <BookCell
            key={bookKeys[1]}
            bookKey={bookKeys[1]!}
            gridInsets={perBookGridInsets[1]!}
            screenInsets={screenInsets}
            isHoveredAnim={isHoveredAnim}
            hoveredBookKey={hoveredBookKey}
            isDropdownOpen={dropdownOpenBook === bookKeys[1]}
            setDropdownOpenForBook={setDropdownOpenForBook}
            onCloseBook={onCloseBook}
            isResizingSplit={isResizing}
          />
          {/* Free-floating drag preview — positioned against the whole grid
              (not the divider's own narrow gutter cell), so it can track the
              pointer anywhere without the real columns moving until release. */}
          {previewFraction != null && (
            <div
              className='bg-base-content/70 pointer-events-none absolute inset-y-0 z-40 w-0.5'
              style={{ left: `${previewFraction * 100}%` }}
            />
          )}
        </>
      ) : (
        bookKeys.map((bookKey, index) => (
          <BookCell
            key={bookKey}
            bookKey={bookKey}
            gridInsets={perBookGridInsets[index]!}
            screenInsets={screenInsets}
            isHoveredAnim={isHoveredAnim}
            hoveredBookKey={hoveredBookKey}
            isDropdownOpen={dropdownOpenBook === bookKey}
            setDropdownOpenForBook={setDropdownOpenForBook}
            onCloseBook={onCloseBook}
          />
        ))
      )}
    </div>
  );
};

export default BooksGrid;
