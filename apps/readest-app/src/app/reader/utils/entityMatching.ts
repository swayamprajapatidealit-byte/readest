import type { EbookContent } from '@/services/visualible/ebookContent';
import { buildSectionTextModel } from './wordlensRuby';

export type EntityCategory = 'character' | 'place' | 'glossary' | 'footnote';

export interface EntityMatch {
  range: Range;
  category: EntityCategory;
  entityIndex: number;
  /** Offsets into the section's concatenated text model — for ordering injection. */
  start: number;
  end: number;
}

interface EntityCandidate {
  textLower: string;
  category: EntityCategory;
  entityIndex: number;
}

export interface EntityMatcher {
  candidates: EntityCandidate[];
}

// One matcher per fetched EbookContent — rebuilding it doesn't depend on progress
// or on which section is being scanned, so it's built once and reused for every
// section of the book.
const matcherCache = new WeakMap<EbookContent, EntityMatcher>();

// Shared by candidate names/aliases and excluded words so "Books  of Chivalry"
// and "books of chivalry" compare equal regardless of internal whitespace.
const normalizeEntityText = (text: string): string =>
  text.trim().toLowerCase().replace(/\s+/g, ' ');

const pushCandidates = (
  candidates: EntityCandidate[],
  names: string[],
  category: EntityCategory,
  entityIndex: number,
  excludedWords: Set<string>,
): void => {
  for (const name of names) {
    const textLower = normalizeEntityText(name);
    if (textLower && !excludedWords.has(textLower)) {
      candidates.push({ textLower, category, entityIndex });
    }
  }
};

export const buildEntityMatcher = (content: EbookContent): EntityMatcher => {
  const cached = matcherCache.get(content);
  if (cached) return cached;

  // Suppresses the entity-icon overlay for specific words (book-specific +
  // site-wide exclusions, services/visualible/excludeWords.ts) — filtered out
  // here at candidate-build time so an excluded word can never be matched in
  // the first place; the underlying text itself is never touched.
  const excludedWords = new Set((content.excludedWords ?? []).map(normalizeEntityText));

  const candidates: EntityCandidate[] = [];
  content.characters.forEach((character, entityIndex) =>
    pushCandidates(
      candidates,
      // The pipeline API doesn't always populate this field for every entity
      // (seen live: absent entirely, not just empty, on some characters) — a
      // bare spread of undefined throws and aborts the whole matcher build,
      // silently killing icon rendering for the entire book.
      [character.name, ...(character.alternative_names ?? [])],
      'character',
      entityIndex,
      excludedWords,
    ),
  );
  content.places.forEach((place, entityIndex) =>
    pushCandidates(
      candidates,
      [place.name, ...(place.alternative_names ?? [])],
      'place',
      entityIndex,
      excludedWords,
    ),
  );
  content.glossary.forEach((term, entityIndex) =>
    pushCandidates(candidates, [term.term], 'glossary', entityIndex, excludedWords),
  );

  // Longest-first: a multi-word alias should win over a shorter one it overlaps.
  candidates.sort((a, b) => b.textLower.length - a.textLower.length);

  const matcher: EntityMatcher = { candidates };
  matcherCache.set(content, matcher);
  return matcher;
};

const WORD_CHAR = /[\p{L}\p{N}]/u;
const isWordChar = (ch: string | undefined): boolean => !!ch && WORD_CHAR.test(ch);
const hasWordBoundary = (haystack: string, start: number, end: number): boolean =>
  !isWordChar(haystack[start - 1]) && !isWordChar(haystack[end]);

const isRangeClaimed = (claimed: Uint8Array, start: number, end: number): boolean => {
  for (let i = start; i < end; i++) if (claimed[i]) return true;
  return false;
};
const claimRange = (claimed: Uint8Array, start: number, end: number): void => {
  for (let i = start; i < end; i++) claimed[i] = 1;
};

/**
 * Walk a section's rendered text (via the same text model Word Lens uses) and find
 * every non-overlapping occurrence of a known entity name/alias/term. Longer
 * candidates (checked first, per the matcher's sort) claim their span so a shorter,
 * overlapping candidate can't also match inside it.
 *
 * Does not touch the DOM and does not consider reading progress — spoiler gating
 * and injection are the caller's responsibility.
 */
export const findEntityMatches = (doc: Document, matcher: EntityMatcher): EntityMatch[] => {
  const model = buildSectionTextModel(doc);
  if (!model.text) return [];
  const haystack = model.text.toLowerCase();
  const claimed = new Uint8Array(haystack.length);
  const matches: EntityMatch[] = [];

  for (const candidate of matcher.candidates) {
    const needle = candidate.textLower;
    let from = 0;
    while (from <= haystack.length - needle.length) {
      const start = haystack.indexOf(needle, from);
      if (start === -1) break;
      const end = start + needle.length;
      from = start + needle.length;

      if (isRangeClaimed(claimed, start, end) || !hasWordBoundary(haystack, start, end)) continue;

      const s = model.locate(start);
      const e = model.locate(end);
      if (s.node !== e.node) continue;

      let range: Range;
      try {
        range = doc.createRange();
        range.setStart(s.node, s.offset);
        range.setEnd(e.node, e.offset);
      } catch {
        continue;
      }

      claimRange(claimed, start, end);
      matches.push({
        range,
        category: candidate.category,
        entityIndex: candidate.entityIndex,
        start,
        end,
      });
    }
  }

  return matches;
};
