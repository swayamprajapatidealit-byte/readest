import clsx from 'clsx';
import React from 'react';
import { MdSearch, MdClose } from 'react-icons/md';

import { useSidebarStore } from '@/store/sidebarStore';
import { useTranslation } from '@/hooks/useTranslation';
import { eventDispatcher } from '@/utils/event';

interface HeaderSearchInputProps {
  bookKey: string;
}

// Reuses the sidebar's own search — dispatching 'search-term' (the same
// contract Annotator's "Search selected text" and the search shortcut use)
// opens the sidebar in search mode and sets its per-book search term, which
// SearchBar.tsx picks up and runs (debounced) itself. No search logic here.
const HeaderSearchInput: React.FC<HeaderSearchInputProps> = ({ bookKey }) => {
  const _ = useTranslation();
  const { clearSearch } = useSidebarStore();
  const searchTerm = useSidebarStore((s) => s.getSearchNavState(bookKey).searchTerm);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    eventDispatcher.dispatch('search-term', { term: e.target.value, bookKey });
  };

  const handleClear = () => {
    clearSearch(bookKey);
  };

  return (
    <div
      className={clsx(
        'header-search-input eink-bordered bg-base-content/5 hidden sm:flex',
        'h-10 w-48 min-w-0 max-w-72 flex-1 items-center gap-2 rounded-full px-4',
        'focus-within:ring-primary/40 focus-within:bg-base-100 transition-colors focus-within:ring-2',
      )}
    >
      <MdSearch
        className={clsx(
          'h-5 w-5 flex-shrink-0 transition-colors',
          searchTerm ? 'text-primary' : 'text-base-content/50',
        )}
      />
      <input
        type='text'
        value={searchTerm}
        onChange={handleChange}
        placeholder={_('Search in book')}
        aria-label={_('Search in book')}
        className='text-base-content min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-base-content/40'
      />
      {searchTerm && (
        <button
          type='button'
          aria-label={_('Clear')}
          onClick={handleClear}
          className='text-base-content/50 hover:text-base-content flex-shrink-0'
        >
          <MdClose className='h-5 w-5' />
        </button>
      )}
    </div>
  );
};

export default HeaderSearchInput;
