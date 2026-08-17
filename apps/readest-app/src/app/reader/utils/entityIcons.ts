import type { EbookContent } from '@/services/visualible/ebookContent';
import type { EntityAnchor } from '@/services/visualible/entityTypes';
import { buildEntityMatcher, findEntityMatches, type EntityCategory } from './entityMatching';

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

// An anchor the pipeline couldn't actually locate in the text (`found: false`)
// can't be gated against — treat it as always-eligible rather than hiding the
// icon forever.
const isEligible = (anchor: EntityAnchor | undefined, progress: EntityProgress): boolean => {
  if (!anchor || !anchor.found) return true;
  if (progress.index !== anchor.spine_index) return progress.index > anchor.spine_index;
  return progress.fraction >= anchor.global_progress;
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
 */
export const refreshSectionEntityIcons = (
  doc: Document,
  content: EbookContent,
  progress: EntityProgress,
): void => {
  try {
    clearEntityIcons(doc);

    const matcher = buildEntityMatcher(content);
    const matches = findEntityMatches(doc, matcher);
    // Process right-to-left within the section: splitting a text node for one
    // match must not invalidate the offset of an earlier match still pending on
    // the same node. Mirrors wordlensRuby.applyGlosses's `b.start - a.start` sort.
    const sorted = [...matches].sort((a, b) => b.start - a.start);

    for (const match of sorted) {
      const anchor = getAnchor(content, match.category, match.entityIndex);
      if (!isEligible(anchor, progress)) continue;

      const endContainer = match.range.endContainer;
      if (endContainer.nodeType !== Node.TEXT_NODE) continue;

      try {
        const textNode = endContainer as Text;
        const afterNode = textNode.splitText(match.range.endOffset);
        const marker = createIconMarker(doc, match.category, match.entityIndex);
        textNode.parentNode?.insertBefore(marker, afterNode);
      } catch {
        // Range became invalid (concurrent mutation); skip this one.
      }
    }
  } catch (err) {
    console.warn('[entity-icons] refresh failed', err);
  }
};
