import React from 'react';
import clsx from 'clsx';

import { useTranslation } from '@/hooks/useTranslation';

interface SplitDividerProps {
  fraction: number;
  isResizing: boolean;
  onDragStart: (e: React.MouseEvent | React.TouchEvent) => void;
  onDragKeyDown: (e: React.KeyboardEvent) => void;
}

// Draggable gutter between the two panes of a landscape split view. Unlike
// the near-invisible drag-bars on SideBar/EntityPanel/Notebook (whose edges
// users already know to grab), this one is meant to be discoverable, so it
// keeps a visible center line at rest rather than only appearing on hover.
// It only exposes the static handle — the free-floating drag preview line is
// rendered by BooksGrid itself, positioned against the whole grid rather
// than this narrow gutter cell (see useSplitDividerResize's previewFraction).
const SplitDivider: React.FC<SplitDividerProps> = ({
  fraction,
  isResizing,
  onDragStart,
  onDragKeyDown,
}) => {
  const _ = useTranslation();

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isResizing) return;
    onDragStart(e);
  };
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isResizing) return;
    onDragStart(e);
  };

  return (
    <div
      className={clsx(
        'split-divider group relative flex h-full cursor-col-resize items-center justify-center',
        isResizing && 'pointer-events-none',
      )}
      role='slider'
      tabIndex={0}
      aria-label={_('Resize Split View')}
      aria-orientation='horizontal'
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(fraction * 100)}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onKeyDown={onDragKeyDown}
    >
      <div className='bg-base-content/20 group-hover:bg-base-content/50 group-focus-visible:bg-base-content/50 pointer-events-none h-full w-0.5 transition-colors' />
    </div>
  );
};

export default SplitDivider;
