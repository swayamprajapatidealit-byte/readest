import { ViewSettings } from '@/types/book';

export const getMaxInlineSize = (viewSettings: ViewSettings) => {
  const isVertical = viewSettings.vertical;
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;

  const screenAspectRatio = isVertical ? screenHeight / screenWidth : screenWidth / screenHeight;
  const isUnfoldedScreen = screenAspectRatio < 1.3 && screenAspectRatio > 0.77 && screenWidth > 600;

  return isVertical
    ? Math.max(screenWidth, screenHeight, 720, viewSettings.maxInlineSize)
    : isUnfoldedScreen
      ? viewSettings.maxInlineSize * 0.8
      : viewSettings.maxInlineSize;
};

export const getDefaultMaxInlineSize = () => {
  if (typeof window === 'undefined') return 720;

  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  return screenWidth < screenHeight ? Math.max(screenWidth, 720) : 720;
};

export const getDefaultMaxBlockSize = () => {
  if (typeof window === 'undefined') return 1440;

  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  return Math.max(screenWidth, screenHeight, 1440);
};

// Smallest a Ctrl/Cmd+Click split-view peek pane is allowed to shrink to —
// matches EntityPanel's own MIN_ENTITY_PANEL_WIDTH floor for a "usable side
// panel" width.
const MIN_SPLIT_PEEK_FRACTION = 0.25;

/**
 * Fraction (0-1) of the window width the MAIN pane needs to keep its current
 * column width when a split view opens next to it, instead of the default
 * even 50/50 split. `paginator.js`'s #beforeRender derives column width from
 * container width (`columnWidth ≈ hostSize / columnCount - gap - margins`);
 * on a wide screen showing a 2-column spread, an even split usually collapses
 * cleanly to 1 column of nearly the same width for free — this only kicks in
 * when the main pane is already single-column and would otherwise be forced
 * narrower than its current `maxInlineSize` target. The margin/gap overhead
 * below is an approximation (paginator.js's gap is a % of container width,
 * not a fixed px value) — intentionally generous so the main pane errs on
 * the side of a little extra room rather than being cut just short.
 */
export const getSplitMainPaneFraction = (viewSettings: ViewSettings): number => {
  const maxInlineSize = getMaxInlineSize(viewSettings);
  const overheadPx = 64;
  const neededFraction = (maxInlineSize + overheadPx) / window.innerWidth;
  return Math.min(Math.max(neededFraction, 0.5), 1 - MIN_SPLIT_PEEK_FRACTION);
};
