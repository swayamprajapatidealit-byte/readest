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

// Fraction (0-1) of the window width the MAIN pane keeps when a Ctrl/Cmd+Click
// split view opens next to it, so the content the reader was just looking at
// stays comfortably in view instead of an even 50/50 split.
export const SPLIT_MAIN_PANE_FRACTION = 0.7;

// Bounds for dragging the split-view divider (SplitDivider.tsx) — keeps
// either pane from being resized down to an unreadably thin sliver.
export const MIN_SPLIT_PANE_FRACTION = 0.25;
export const MAX_SPLIT_PANE_FRACTION = 0.75;
