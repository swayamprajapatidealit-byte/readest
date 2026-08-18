import type { EbookContent } from '@/services/visualible/ebookContent';
import type { EntityAnchor } from '@/services/visualible/entityTypes';
import { useReaderStore } from '@/store/readerStore';
import { getEntityViewMemory, offerEntityFacts } from '@/store/entityViewMemoryStore';
import {
  buildEntityMatcher,
  findEntityMatches,
  groupMatchesByEntity,
  selectPrimaryMatch,
  type EntityCategory,
} from './entityMatching';
import { getVisibleFactIds, resolveEntity } from './entityFacts';

const ICON_CLASS = 'entity-icon';

// Single fixed-color icon, shared by every category (per product decision — no
// per-category color/shape variation).
const ICON_SVG =
  '<svg viewBox="0 0 30 30" fill="none" aria-hidden="true">' +
  '<rect width="30" height="30" rx="15" fill="#168814"></rect>' +
  '<rect x="10.8298" y="6.03119" width="3.65837" height="2.27886" fill="white" stroke="white" stroke-width="0.47986"></rect>' +
  '<rect x="10.8298" y="16.2792" width="3.65837" height="2.27886" fill="white" stroke="white" stroke-width="0.47986"></rect>' +
  '<rect x="7.08075" y="11.2953" width="7.40754" height="2.27886" fill="white" stroke="white" stroke-width="0.47986"></rect>' +
  '<path d="M16.2522 17.9506L16.4267 6.95518C16.4395 6.14752 17.3835 5.71601 18.0027 6.23477L24.4603 11.6452C24.9174 12.0282 24.9182 12.7309 24.4621 13.115L17.83 18.6999C17.2003 19.2302 16.2391 18.7737 16.2522 17.9506Z" fill="white" stroke="white" stroke-width="0.47986"></path>' +
  '<path d="M4.94141 17.1776L14.3716 24.4147C14.8933 24.8151 15.6202 24.811 16.1374 24.4046L25.3354 17.1776" stroke="white" stroke-width="1.91944" stroke-linecap="round"></path>' +
  '</svg>';

interface EntityProgress {
  fraction: number;
  index: number;
  /** The currently visible page/spread, for preferring an in-viewport occurrence. */
  range?: Range | null;
}

const getAnchor = (
  content: EbookContent,
  category: EntityCategory,
  entityIndex: number,
): EntityAnchor | undefined => {
  switch (category) {
    case 'character':
      return content.characters[entityIndex]?.first_mention_anchor;
    case 'place':
      return content.places[entityIndex]?.first_mention_anchor;
    case 'glossary':
      return content.glossary[entityIndex]?.first_mention_anchor;
    default:
      return undefined;
  }
};

// Float rounding guard only — NOT a page-sized reveal threshold. Foliate's
// `progress.fraction` is already computed as the fraction at the END of the
// currently visible page (see progress.js's SectionProgress.getProgress), so
// "reached anywhere on this page" is already the behavior; a bigger epsilon
// here would double that and surface spoilers a page early.
const PROGRESS_EPSILON = 1e-6;

// An anchor the pipeline couldn't actually locate in the text (`found: false`)
// can't be gated against — treat it as always-eligible rather than hiding the
// icon forever.
const isEligible = (anchor: EntityAnchor | undefined, progress: EntityProgress): boolean => {
  if (!anchor || !anchor.found) return true;
  if (progress.index !== anchor.spine_index) return progress.index > anchor.spine_index;
  return progress.fraction + PROGRESS_EPSILON >= anchor.global_progress;
};

// Per-category on/off switch, set from the "Entity Icons" submenu (ViewMenu.tsx).
const isCategoryEnabled = (bookKey: string, category: EntityCategory): boolean => {
  const viewSettings = useReaderStore.getState().getViewSettings(bookKey);
  switch (category) {
    case 'character':
      return viewSettings?.entityIconsCharactersEnabled ?? true;
    case 'place':
      return viewSettings?.entityIconsPlacesEnabled ?? true;
    case 'glossary':
      return viewSettings?.entityIconsGlossaryEnabled ?? true;
    default:
      return true;
  }
};

const createIconMarker = (
  doc: Document,
  category: EntityCategory,
  entityIndex: number,
): HTMLElement => {
  const marker = doc.createElement('span');
  marker.className = ICON_CLASS;
  marker.setAttribute('data-entity-icon', '');
  marker.setAttribute('data-entity-category', category);
  marker.setAttribute('data-entity-index', String(entityIndex));
  // Same CFI-visibility contract Word Lens's glosses rely on: invisible to CFI
  // positioning/TTS text, and transparent (hoisted) for CFI path purposes.
  marker.setAttribute('cfi-skip', '');
  marker.setAttribute('cfi-inert', '');
  marker.innerHTML = ICON_SVG;
  return marker;
};

/** Unwrap every injected entity icon, restoring the original text. */
export const clearEntityIcons = (doc: Document): void => {
  doc.querySelectorAll(`span.${ICON_CLASS}`).forEach((marker) => marker.remove());
  (doc.body ?? doc.documentElement)?.normalize();
};

// Per-doc fingerprint of the last refresh pass actually run, so a trigger that
// fires again with the same rounded progress (e.g. a sub-pixel scroll tick, or
// both the `stabilized` and progress-change triggers firing for the same page
// turn) skips the DOM work entirely instead of re-clearing and re-matching.
const lastRefreshFingerprint = new WeakMap<Document, string>();

/**
 * Re-render entity icons for one section doc. Clears first, then re-matches and
 * injects the icons eligible at the given reading progress.
 *
 * Unlike Word Lens's `refreshSectionGlosses`, this has no `await` inside it — the
 * whole pass is synchronous DOM work — so there's no reentrancy window and no
 * generation-counter guard is needed: by the time this function returns, the
 * document is fully caught up with `content`/`progress`, and JS's run-to-completion
 * guarantees no overlapping call for the same `doc` could have interleaved.
 *
 * Footnotes are not iconified here — they use the book's own existing
 * footnote-reference markers as the click target instead (see iframeEventHandlers.ts).
 *
 * `force` bypasses the fingerprint cache for a pass triggered by something
 * other than a progress/layout change — currently only the "Entity Icons"
 * per-category on/off toggle (ViewMenu.tsx), which must take effect right
 * away rather than waiting for the next natural page-turn/scroll trigger.
 */
export const refreshSectionEntityIcons = (
  doc: Document,
  content: EbookContent,
  progress: EntityProgress,
  bookKey: string,
  isBackNavigation = false,
  force = false,
): void => {
  try {
    const fingerprint = `${progress.index}:${progress.fraction.toFixed(4)}:${isBackNavigation ? 1 : 0}`;
    if (!force && lastRefreshFingerprint.get(doc) === fingerprint) return;
    lastRefreshFingerprint.set(doc, fingerprint);

    clearEntityIcons(doc);
    const bookId = bookKey.split('-')[0]!;

    const matcher = buildEntityMatcher(content);
    const matches = findEntityMatches(doc, matcher);

    // Narrow every entity down to a single occurrence per section — an entity
    // mentioned 5 times on one page previously got 5 icons. On back-navigation,
    // reuse the exact occurrence this entity was previously placed at in this
    // section (if recorded) instead of recomputing from the viewport, so the
    // icon doesn't jump to a different occurrence on a re-visit.
    const groups = groupMatchesByEntity(matches);
    const primaryMatches = [...groups.values()].map((group) => {
      const { category, entityIndex } = group[0]!;
      const entityKey = `${category}:${entityIndex}`;
      const rememberedOffsets = isBackNavigation
        ? getEntityViewMemory(bookId, entityKey)?.offeredAtOffsets[`s${progress.index}`]
        : undefined;
      const preferredOffset = rememberedOffsets?.at(-1);
      // A remembered offset wins outright on back-nav — don't let viewport
      // preference override the exact occurrence being replayed.
      return selectPrimaryMatch(group, {
        viewportRange: preferredOffset == null ? progress.range : undefined,
        preferredOffset,
      });
    });

    // Process right-to-left within the section: splitting a text node for one
    // match must not invalidate the offset of an earlier match still pending on
    // the same node. Mirrors wordlensRuby.applyGlosses's `b.start - a.start` sort.
    const sorted = primaryMatches.sort((a, b) => b.start - a.start);

    for (const match of sorted) {
      if (!isCategoryEnabled(bookKey, match.category)) continue;

      const anchor = getAnchor(content, match.category, match.entityIndex);
      if (!isEligible(anchor, progress)) continue;

      const entity = resolveEntity(content, match.category, match.entityIndex);
      if (!entity) continue;

      // Nothing to show yet for this entity at the current progress — no icon.
      const visibleIds = getVisibleFactIds(
        entity,
        match.category,
        match.entityIndex,
        progress.fraction,
      );
      if (visibleIds.length === 0) continue;

      // Every currently-visible fact has already been opened — suppress the icon.
      const entityKey = `${match.category}:${match.entityIndex}`;
      const memory = getEntityViewMemory(bookId, entityKey);
      const hasUnseen = visibleIds.some((id) => !memory?.seenInfo.includes(id));
      if (!hasUnseen) continue;

      const endContainer = match.range.endContainer;
      if (endContainer.nodeType !== Node.TEXT_NODE) continue;

      try {
        const textNode = endContainer as Text;
        const afterNode = textNode.splitText(match.range.endOffset);
        const marker = createIconMarker(doc, match.category, match.entityIndex);
        textNode.parentNode?.insertBefore(marker, afterNode);
        offerEntityFacts(bookId, entityKey, visibleIds, progress.index, match.start);
      } catch {
        // Range became invalid (concurrent mutation); skip this one.
      }
    }
  } catch (err) {
    console.warn('[entity-icons] refresh failed', err);
  }
};
