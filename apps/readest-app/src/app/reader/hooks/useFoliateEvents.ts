import { useEffect, useRef } from 'react';
import { FoliateView } from '@/types/view';

type FoliateEventHandler = {
  onLoad?: (event: Event) => void;
  onStabilized?: (event: Event) => void;
  onRelocate?: (event: Event) => void;
  onLinkClick?: (event: Event) => void;
  onRendererRelocate?: (event: Event) => void;
  onCreateOverlay?: (event: Event) => void;
  onDrawAnnotation?: (event: Event) => void;
  onShowAnnotation?: (event: Event) => void;
  onNavigateStart?: (event: Event) => void;
  onNavigateEnd?: (event: Event) => void;
};

export const useFoliateEvents = (view: FoliateView | null, handlers?: FoliateEventHandler) => {
  // `view` only changes when a pane's viewer is (re)created, so the effect
  // below only (re)wires listeners then — but a handler like `onLinkClick`
  // closes over each render's own props/state (e.g. FootnotePopup's
  // `bookKeys`). Wiring the handler function itself directly used to freeze
  // that closure at whatever it was the one time `view` was first set, so a
  // click years later (after bookKeys had long since changed) still ran the
  // original, stale closure — e.g. a link click always saw bookKeys.length
  // as 1 and kept re-seeding the split-view's 70/30 ratio no matter how many
  // panes were actually open. Routing through a ref keeps the actual
  // `addEventListener`/`removeEventListener` pair stable (still only wired
  // once per `view`) while every dispatch calls the latest handler closure.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!view) return;

    const wrap =
      (key: keyof FoliateEventHandler) =>
      (event: Event): void => {
        handlersRef.current?.[key]?.(event);
      };
    const onLoad = wrap('onLoad');
    const onStabilized = wrap('onStabilized');
    const onRelocate = wrap('onRelocate');
    const onLinkClick = wrap('onLinkClick');
    const onRendererRelocate = wrap('onRendererRelocate');
    const onCreateOverlay = wrap('onCreateOverlay');
    const onDrawAnnotation = wrap('onDrawAnnotation');
    const onShowAnnotation = wrap('onShowAnnotation');
    const onNavigateStart = wrap('onNavigateStart');
    const onNavigateEnd = wrap('onNavigateEnd');

    view.addEventListener('load', onLoad);
    view.renderer.addEventListener('stabilized', onStabilized);
    view.addEventListener('relocate', onRelocate);
    view.addEventListener('link', onLinkClick);
    view.renderer.addEventListener('relocate', onRendererRelocate);
    view.addEventListener('create-overlay', onCreateOverlay);
    view.addEventListener('draw-annotation', onDrawAnnotation);
    view.addEventListener('show-annotation', onShowAnnotation);
    view.addEventListener('navigate-start', onNavigateStart);
    view.addEventListener('navigate-end', onNavigateEnd);

    return () => {
      view.removeEventListener('load', onLoad);
      view.renderer.removeEventListener('stabilized', onStabilized);
      view.removeEventListener('relocate', onRelocate);
      view.removeEventListener('link', onLinkClick);
      view.renderer.removeEventListener('relocate', onRendererRelocate);
      view.removeEventListener('create-overlay', onCreateOverlay);
      view.removeEventListener('draw-annotation', onDrawAnnotation);
      view.removeEventListener('show-annotation', onShowAnnotation);
      view.removeEventListener('navigate-start', onNavigateStart);
      view.removeEventListener('navigate-end', onNavigateEnd);
    };
  }, [view]);
};
