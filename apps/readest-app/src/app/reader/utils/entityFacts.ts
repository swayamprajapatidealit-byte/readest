import type {
  CharacterEntity,
  GlossaryEntity,
  KnowledgeFact,
  PlaceEntity,
} from '@/services/visualible/entityTypes';
import type { EbookContent } from '@/services/visualible/ebookContent';
import type { EntityCategory } from './entityMatching';

const REVEAL_ACCELERATION = 1.5;

// Coarse reveal pacing for narrative/atmospheric content that has no exact
// textual anchor of its own — deliberately looser than raw reading progress
// so ambient content doesn't feel over-conservative next to exact-anchored
// facts. Never reuse `acceleratedProgress` for anything anchor-based.
const PHASE_THRESHOLDS: Record<string, number> = {
  introductory: 0,
  developing: 0.25,
  revealed: 0.45,
  transformative: 0.75,
  terminal: 0.95,
};

const acceleratedProgress = (progress: number): number =>
  Math.min(progress * REVEAL_ACCELERATION, 1);

// No pipeline field marks a source as "front matter" today — this is a
// best-effort heuristic off `chapter_ref` and fails open (visible) whenever
// that field is absent or unrecognized, which is the safe failure direction
// for a spoiler-hiding heuristic built on a weak signal.
const FRONT_MATTER_RE = /prologue|preface|foreword|dedication|epigraph|introduction/i;

// `sources` is typed as required, but — like `alternative_names` elsewhere in
// this pipeline API — isn't always populated on every fact; guard defensively.
const isFrontMatterOnly = (fact: KnowledgeFact): boolean => {
  const sources = fact.sources ?? [];
  return (
    sources.length > 0 && sources.every((source) => FRONT_MATTER_RE.test(source.chapter_ref ?? ''))
  );
};

const isFactHardGateVisible = (fact: KnowledgeFact, progress: number): boolean => {
  if (isFrontMatterOnly(fact)) return false;
  if (fact.anchor_progress != null && progress < fact.anchor_progress) return false;
  const sourceAnchors = (fact.sources ?? [])
    .map((source) => source.anchor_progress)
    .filter((anchor): anchor is number => anchor != null);
  if (sourceAnchors.length > 0 && progress < Math.max(...sourceAnchors)) return false;
  return true;
};

const isFactPhaseVisible = (fact: KnowledgeFact, progress: number): boolean => {
  const threshold = PHASE_THRESHOLDS[fact.knowledge_phase];
  if (threshold == null) return true; // unrecognized phase string — fail open
  return acceleratedProgress(progress) >= threshold;
};

/** The full per-fact spoiler gate: exact anchor + source anchors + phase pacing. */
export const isFactVisible = (fact: KnowledgeFact, progress: number): boolean =>
  isFactHardGateVisible(fact, progress) && isFactPhaseVisible(fact, progress);

/** Character introductions have their own anchor/phase but no `sources` array. */
export const isIntroductionVisible = (
  introduction: CharacterEntity['introduction'] | undefined,
  progress: number,
): boolean => {
  if (!introduction) return false; // pipeline doesn't always populate this field
  if (progress < introduction.anchor_progress) return false;
  const threshold = PHASE_THRESHOLDS[introduction.knowledge_phase];
  if (threshold == null) return true;
  return acceleratedProgress(progress) >= threshold;
};

/**
 * Gate for a place's narrative/atmospheric string fields (role_in_narrative,
 * significance_in_book) — these aren't `KnowledgeFact`s (no per-field anchor),
 * so they're gated by the place's own entity-level `first_known_phase`
 * instead. Purely descriptive fields (geography, historical_context) bypass
 * this entirely and are shown as soon as the entity itself is eligible.
 */
export const isPlaceNarrativeFieldVisible = (place: PlaceEntity, progress: number): boolean => {
  const threshold = PHASE_THRESHOLDS[place.first_known_phase];
  if (threshold == null) return true;
  return acceleratedProgress(progress) >= threshold;
};

/** Stable per-fact id: `category:entityIndex:field:rawArrayIndex`. */
export const getFactId = (
  category: EntityCategory,
  entityIndex: number,
  field: string,
  rawIndex: number,
): string => `${category}:${entityIndex}:${field}:${rawIndex}`;

export interface IdentifiedFact {
  fact: KnowledgeFact;
  id: string;
}

// `facts` is typed as required on every entity, but — like `sources` above —
// isn't always populated by the pipeline; every caller gets the `?? []` guard
// for free by going through this function.
/** Tags each fact with its stable id, in the raw (unfiltered) array order. */
export const withFactIds = (
  facts: KnowledgeFact[] | undefined,
  category: EntityCategory,
  entityIndex: number,
  field: string,
): IdentifiedFact[] =>
  (facts ?? []).map((fact, i) => ({ fact, id: getFactId(category, entityIndex, field, i) }));

/** Tags and filters facts by the current progress gate. */
export const visibleFactsWithIds = (
  facts: KnowledgeFact[] | undefined,
  category: EntityCategory,
  entityIndex: number,
  field: string,
  progress: number,
): IdentifiedFact[] =>
  withFactIds(facts, category, entityIndex, field).filter(({ fact }) =>
    isFactVisible(fact, progress),
  );

export const resolveEntity = (
  content: EbookContent,
  category: EntityCategory,
  entityIndex: number,
): CharacterEntity | PlaceEntity | GlossaryEntity | undefined => {
  switch (category) {
    case 'character':
      return content.characters[entityIndex];
    case 'place':
      return content.places[entityIndex];
    case 'glossary':
      return content.glossary[entityIndex];
    default:
      return undefined;
  }
};

/**
 * Every fact id currently visible for an entity, across all of its
 * fact-bearing fields. Shared by icon eligibility (entityIcons.ts) and the
 * entity panel (Content.tsx) so "visible" never drifts between the two.
 */
export const getVisibleFactIds = (
  entity: CharacterEntity | PlaceEntity | GlossaryEntity,
  category: EntityCategory,
  entityIndex: number,
  progress: number,
): string[] => {
  const ids: string[] = [];

  if (category === 'character') {
    const character = entity as CharacterEntity;
    // Name/occupation/social_status/alternative_names render unconditionally
    // in Content.tsx once the panel opens — this synthetic id stands in for
    // that always-present content, so an entity with a name but no populated
    // biography/motivations/etc. still gets an icon instead of being wrongly
    // treated as "nothing to show".
    ids.push(getFactId(category, entityIndex, 'base', 0));
    if (isIntroductionVisible(character.introduction, progress)) {
      ids.push(getFactId(category, entityIndex, 'introduction', 0));
    }
    for (const field of ['biography', 'motivations', 'conflicts', 'notable_events'] as const) {
      ids.push(
        ...visibleFactsWithIds(character[field], category, entityIndex, field, progress).map(
          (f) => f.id,
        ),
      );
    }
  } else if (category === 'place') {
    const place = entity as PlaceEntity;
    // Same reasoning as the character 'base' id above — geography/
    // historical_context/alternative_names render unconditionally.
    ids.push(getFactId(category, entityIndex, 'base', 0));
    ids.push(
      ...visibleFactsWithIds(place.facts, category, entityIndex, 'facts', progress).map(
        (f) => f.id,
      ),
    );
    if (
      (place.role_in_narrative || place.significance_in_book) &&
      isPlaceNarrativeFieldVisible(place, progress)
    ) {
      ids.push(getFactId(category, entityIndex, 'narrative', 0));
    }
  } else if (category === 'glossary') {
    // No per-fact anchor data exists for glossary definitions — treat the
    // whole entry as one always-visible unit once the entity itself is
    // eligible, so it isn't blocked by the "has visible content" gate.
    ids.push(getFactId(category, entityIndex, 'entry', 0));
  }

  return ids;
};
