import clsx from 'clsx';
import React, { useEffect, useState } from 'react';

import { MdCheck } from 'react-icons/md';
import { useEnv } from '@/context/EnvContext';
import { useBookDataStore } from '@/store/bookDataStore';
import { useReaderStore } from '@/store/readerStore';
import { useSessionStore } from '@/store/sessionStore';
import { useSidebarStore } from '@/store/sidebarStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useParallelViewStore } from '@/store/parallelViewStore';
import { isWebAppPlatform } from '@/services/environment';
import { eventDispatcher } from '@/utils/event';
import { DOWNLOAD_READEST_URL } from '@/services/constants';
import { saveViewSettings } from '@/helpers/settings';
import { setProofreadRulesVisibility } from '@/app/reader/components/ProofreadRules';
import { setAboutDialogVisible } from '@/components/AboutWindow';
import { getRecentPurchaseCoverUrl, getRecentPurchases } from '@/services/visualible/library';
import { openVisualibleBook } from '@/services/visualible/openBook';
import type { RecentPurchaseItemData } from '@/services/visualible/types';
import useBooksManager from '../../hooks/useBooksManager';
import MenuItem from '@/components/MenuItem';
import Menu from '@/components/Menu';

interface BookMenuProps {
  menuClassName?: string;
  setIsDropdownOpen?: (isOpen: boolean) => void;
}

const BookMenu: React.FC<BookMenuProps> = ({ menuClassName, setIsDropdownOpen }) => {
  const _ = useTranslation();
  const { envConfig, appService } = useEnv();
  const { bookKeys, recreateViewer, getViewSettings } = useReaderStore();
  const { session } = useSessionStore();
  const { openParallelView, appendBook } = useBooksManager();
  const { sideBarBookKey } = useSidebarStore();
  const { getConfig } = useBookDataStore();
  const { parallelViews, setParallel, unsetParallel } = useParallelViewStore();
  const viewSettings = getViewSettings(sideBarBookKey!);

  const [isSortedTOC, setIsSortedTOC] = React.useState(viewSettings?.sortedTOC || false);
  const [purchasedBooks, setPurchasedBooks] = useState<RecentPurchaseItemData[]>([]);

  useEffect(() => {
    if (!session) return;
    getRecentPurchases(session.token, { limit: 20 })
      .then((res) => setPurchasedBooks(res.results.map((item) => item.itemData)))
      .catch((err) => console.error('[recent-purchase] failed to load', err));
  }, [session]);

  // Used purely to grey out "Clear Annotations" when there's nothing to
  // clear. The actual delete + confirm dialog lives in Annotator (which
  // outlives this dropdown menu, so the dialog isn't unmounted along
  // with the menu when the user clicks the entry).
  const annotationsToClear = React.useMemo(() => {
    if (!sideBarBookKey) return 0;
    const cfg = getConfig(sideBarBookKey);
    if (!cfg?.booknotes) return 0;
    return cfg.booknotes.filter((n) => n.type === 'annotation' && !n.deletedAt).length;
  }, [sideBarBookKey, getConfig]);

  const handleParallelView = (id: string) => {
    openParallelView(id);
    setIsDropdownOpen?.(false);
  };
  // The purchased-library list includes books never opened this session (no
  // fetched EPUB/bookDoc yet) — fetch and import on demand before opening the
  // parallel view. openVisualibleBook caches by slug, so re-clicking an
  // already-opened book skips straight to the cached hash.
  const handleOpenPurchasedBook = async (item: RecentPurchaseItemData) => {
    if (!appService || !session) return;
    try {
      const hash = await openVisualibleBook(item.slug, session.token, appService, envConfig);
      handleParallelView(hash);
    } catch (err) {
      console.error('Failed to open purchased book', err);
      eventDispatcher.dispatch('toast', { message: _('Unable to open book'), type: 'error' });
    }
  };
  const getReadingStatusLabel = (item: RecentPurchaseItemData): string => {
    const pageNumber = item.readingData?.pageNumber;
    if (pageNumber === undefined) return _('Not started');
    if (pageNumber >= 100) return _('Completed');
    return `${pageNumber}%`;
  };
  // Opens a second, independent pane of the *current* book (isParallel=false,
  // unlike Parallel Read, so the two panes scroll independently rather than
  // mirroring each other). isPrimary=false so this pane's own progress/
  // viewSettings changes don't fight the canonical saved position.
  const handleSplitView = () => {
    if (!sideBarBookKey) return;
    appendBook(sideBarBookKey.split('-')[0]!, false, false);
    setIsDropdownOpen?.(false);
  };
  const handleReloadPage = () => {
    window.location.reload();
    setIsDropdownOpen?.(false);
  };
  const showAboutReadest = () => {
    setAboutDialogVisible(true);
    setIsDropdownOpen?.(false);
  };
  const downloadReadest = () => {
    window.open(DOWNLOAD_READEST_URL, '_blank');
    setIsDropdownOpen?.(false);
  };
  const handleExportAnnotations = () => {
    eventDispatcher.dispatch('export-annotations', { bookKey: sideBarBookKey });
    setIsDropdownOpen?.(false);
  };
  const handleImportAnnotations = () => {
    eventDispatcher.dispatch('import-annotations', { bookKey: sideBarBookKey });
    setIsDropdownOpen?.(false);
  };
  const handleToggleSortTOC = () => {
    setIsSortedTOC((prev) => !prev);
    setIsDropdownOpen?.(false);
    if (sideBarBookKey) {
      saveViewSettings(envConfig, sideBarBookKey, 'sortedTOC', !isSortedTOC, true, false).then(
        () => {
          recreateViewer(envConfig, sideBarBookKey);
        },
      );
    }
  };
  const handleSetParallel = () => {
    setParallel(bookKeys);
    setIsDropdownOpen?.(false);
  };
  const handleUnsetParallel = () => {
    unsetParallel(bookKeys);
    setIsDropdownOpen?.(false);
  };
  const showProofreadRulesWindow = () => {
    setProofreadRulesVisibility(true);
    setIsDropdownOpen?.(false);
  };
  // Routed through Annotator (per-book, long-lived) so that the
  // confirmation dialog isn't unmounted with the dropdown menu.
  const handleClearAnnotations = () => {
    eventDispatcher.dispatch('clear-annotations', { bookKey: sideBarBookKey });
    setIsDropdownOpen?.(false);
  };

  return (
    <Menu
      className={clsx('book-menu dropdown-content z-20 shadow-2xl', menuClassName)}
      onCancel={() => setIsDropdownOpen?.(false)}
    >
      <MenuItem
        label={_('Parallel Read')}
        buttonClass={bookKeys.length > 1 ? 'lg:tooltip lg:tooltip-bottom' : ''}
        tooltip={parallelViews.length > 0 ? _('Disable') : _('Enable')}
        Icon={parallelViews.length > 0 && bookKeys.length > 1 ? MdCheck : undefined}
      >
        <ul className='max-h-60 overflow-y-auto'>
          {purchasedBooks.map((item) => (
            <MenuItem
              key={item.id}
              Icon={
                <img
                  src={getRecentPurchaseCoverUrl(item)}
                  alt={item.title}
                  width={56}
                  height={80}
                  className='aspect-auto max-h-8 max-w-4 rounded-sm shadow-md'
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              }
              label={item.title}
              labelClass='max-w-36'
              description={getReadingStatusLabel(item)}
              onClick={() => handleOpenPurchasedBook(item)}
            />
          ))}
        </ul>
      </MenuItem>
      <MenuItem label={_('Split View')} onClick={handleSplitView} />
      {bookKeys.length > 1 &&
        (parallelViews.length > 0 ? (
          <MenuItem label={_('Exit Parallel Read')} onClick={handleUnsetParallel} />
        ) : (
          <MenuItem label={_('Enter Parallel Read')} onClick={handleSetParallel} />
        ))}
      <hr aria-hidden='true' className='border-base-200 my-1' />
      <MenuItem label={_('Proofread')} onClick={showProofreadRulesWindow} />
      <hr aria-hidden='true' className='border-base-200 my-1' />
      <MenuItem label={_('Export Annotations')} onClick={handleExportAnnotations} />
      <MenuItem label={_('Import Annotations')} onClick={handleImportAnnotations} />
      <MenuItem
        label={_('Clear Annotations')}
        disabled={annotationsToClear === 0}
        onClick={handleClearAnnotations}
      />
      <MenuItem
        label={_('Sort TOC by Page')}
        Icon={isSortedTOC ? MdCheck : undefined}
        onClick={handleToggleSortTOC}
      />
      <MenuItem label={_('Reload Page')} shortcut='Shift+R' onClick={handleReloadPage} />
      <hr aria-hidden='true' className='border-base-200 my-1' />
      {isWebAppPlatform() && <MenuItem label={_('Download Readest')} onClick={downloadReadest} />}
      <MenuItem label={_('About Readest')} onClick={showAboutReadest} />
    </Menu>
  );
};

export default BookMenu;
