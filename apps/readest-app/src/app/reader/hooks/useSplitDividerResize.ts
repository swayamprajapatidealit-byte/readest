import { useCallback, useEffect, useRef, useState } from 'react';

import { useReaderStore } from '@/store/readerStore';
import { DragKey, useDrag } from '@/hooks/useDrag';
import { MIN_SPLIT_PANE_FRACTION, MAX_SPLIT_PANE_FRACTION } from '@/utils/config';

// Safety net for the post-drag loader: if a pane's renderer never fires
// 'stabilized' (e.g. it was unmounted mid-resize, or its size didn't
// actually change), don't leave the resize overlay stuck forever.
const STABILIZE_FALLBACK_MS = 1000;
const KEYBOARD_STEP = 0.02;

const clamp = (fraction: number) =>
  Math.min(MAX_SPLIT_PANE_FRACTION, Math.max(MIN_SPLIT_PANE_FRACTION, fraction));

// Drives the split-view divider (SplitDivider.tsx): a free-floating preview
// while dragging (previewFraction — never touches the grid template, so
// dragging itself never triggers an epub reflow), and a single commit on
// release/keypress that both updates the real column split and tracks the
// resulting reflow via each pane's 'stabilized' event so callers know when
// it's safe to hide a resize loader.
export const useSplitDividerResize = (
  containerRef: React.RefObject<HTMLDivElement | null>,
  bookKeyA: string,
  bookKeyB: string,
  committedFraction: number | null,
) => {
  const [previewFraction, setPreviewFraction] = useState<number | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const previewFractionRef = useRef<number | null>(null);
  const stopWaitingRef = useRef<(() => void) | null>(null);

  useEffect(() => () => stopWaitingRef.current?.(), []);

  const waitForStabilize = useCallback(() => {
    stopWaitingRef.current?.();
    const { getView } = useReaderStore.getState();
    const renderers = [getView(bookKeyA)?.renderer, getView(bookKeyB)?.renderer].filter(
      (renderer): renderer is NonNullable<typeof renderer> => !!renderer,
    );

    if (renderers.length === 0) {
      setIsResizing(false);
      return;
    }

    let pending = renderers.length;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      renderers.forEach((renderer) => renderer.removeEventListener('stabilized', onStabilized));
      setIsResizing(false);
    };
    const onStabilized = () => {
      pending -= 1;
      if (pending <= 0) finish();
    };
    renderers.forEach((renderer) => renderer.addEventListener('stabilized', onStabilized));
    const timer = setTimeout(finish, STABILIZE_FALLBACK_MS);
    stopWaitingRef.current = finish;
  }, [bookKeyA, bookKeyB]);

  const commitFraction = useCallback(
    (fraction: number) => {
      setPreviewFraction(null);
      previewFractionRef.current = null;
      useReaderStore.getState().setSplitMainPaneFraction(clamp(fraction));
      setIsResizing(true);
      waitForStabilize();
    },
    [waitForStabilize],
  );

  const handleDragMove = useCallback(
    ({ clientX }: { clientX: number }) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return;
      const fraction = clamp((clientX - rect.left) / rect.width);
      previewFractionRef.current = fraction;
      setPreviewFraction(fraction);
    },
    [containerRef],
  );

  const handleDragEnd = useCallback(() => {
    const fraction = previewFractionRef.current;
    if (fraction != null) commitFraction(fraction);
  }, [commitFraction]);

  const handleDragKeyDown = useCallback(
    ({ key }: { key: DragKey }) => {
      const current = committedFraction ?? 0.5;
      if (key === 'ArrowLeft') commitFraction(current - KEYBOARD_STEP);
      else if (key === 'ArrowRight') commitFraction(current + KEYBOARD_STEP);
    },
    [committedFraction, commitFraction],
  );

  const { handleDragStart, handleDragKeyDown: onKeyDown } = useDrag(
    handleDragMove,
    handleDragKeyDown,
    handleDragEnd,
    'col-resize',
  );

  return { previewFraction, isResizing, handleDragStart, handleDragKeyDown: onKeyDown };
};
