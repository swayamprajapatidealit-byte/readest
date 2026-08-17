// Shapes confirmed 2026-08-17 against the live pipeline API (book "the-republic-of-plato",
// pipelineId 1625). `atmosphere_or_mood`, `symbolism` (place), `key_events`, and
// `character_associations` were null/empty in every sample seen — typed conservatively
// until a populated example is observed.
//
// `alternative_names` confirmed 2026-08-17 against "don-quixote" (pipelineId 1792): the
// pipeline omits this field entirely (not `null`, not `[]`) on some entities — every
// reader must treat it as optional, never spread/read it unguarded.

export interface EntityAnchor {
  spine_index: number;
  spine_item_id: string;
  char_offset: number;
  page_number: number | null;
  global_progress: number;
  found: boolean;
}

export interface KnowledgeSource {
  source_title: string;
  url: string | null;
  source_type: string;
  usage_label?: string;
  confidence?: string;
  anchor_progress?: number;
  chapter_ref?: string;
}

export interface KnowledgeFact {
  text: string;
  knowledge_phase: string;
  knowledge_phase_rank?: number;
  anchor_progress: number | null;
  sources: KnowledgeSource[];
  fact_type?: string;
}

export interface IntroductionFact {
  text: string;
  anchor_progress: number;
  knowledge_phase: string;
  knowledge_phase_rank?: number;
  source_type: string;
}

export interface Citation {
  title: string;
  url: string;
}

export interface CharacterEntity {
  name: string;
  alternative_names?: string[];
  character_type: 'protagonist' | 'major' | 'supporting' | 'minor';
  social_status: string;
  occupation: string;
  first_mention_anchor: EntityAnchor;
  introduction: IntroductionFact;
  biography: KnowledgeFact[];
  motivations: KnowledgeFact[];
  conflicts: KnowledgeFact[];
  notable_events: KnowledgeFact[];
  symbolism: unknown[];
  citations: Citation[];
}

export interface PlaceEntity {
  name: string;
  type: string;
  geography: string;
  historical_context: string;
  first_known_phase: string;
  first_known_phase_rank?: number;
  first_mention_anchor: EntityAnchor;
  facts: KnowledgeFact[];
  role_in_narrative: string | null;
  significance_in_book: string | null;
  key_events: unknown[];
  character_associations: unknown[];
  atmosphere_or_mood: string | null;
  symbolism: string | null;
  alternative_names?: string[];
  citations: Citation[];
}

export interface GlossaryDefinition {
  text: string;
  knowledge_phase: string;
  sources: KnowledgeSource[];
}

export interface GlossaryEntity {
  term: string;
  general_definition: GlossaryDefinition | null;
  contextual_definition: GlossaryDefinition[];
  specific_usage_or_shift: GlossaryDefinition | null;
  definition_source: 'verbatim' | 'inferred';
  citations: Citation[];
  first_mention_anchor: EntityAnchor;
}

// Shape confirmed 2026-08-17 against "don-quixote" (pipelineId 1792). Unlike the
// other entity types, a footnote is anchored to one exact DOM element (`anchor_id`,
// the book's own footnote-reference marker) rather than matched by scanning text —
// see entityIcons.ts's injectFootnoteIcons. `anchor_id` was absent on ~0.3% of
// footnotes in the sample; those are skipped rather than placed via a fallback.
export interface FootnoteSourceLocation {
  spine_index: number;
  href: string;
  anchor_id?: string;
  char_offset: number;
}

export interface FootnoteEntity {
  source_label: string;
  footnote_index: string;
  target: string;
  source_location: FootnoteSourceLocation;
}
