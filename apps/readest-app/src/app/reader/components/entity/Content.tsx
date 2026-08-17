import React from 'react';
import { MdStar } from 'react-icons/md';

import { useTranslation } from '@/hooks/useTranslation';
import type {
  Citation,
  CharacterEntity,
  FootnoteEntity,
  GlossaryEntity,
  KnowledgeFact,
  PlaceEntity,
} from '@/services/visualible/entityTypes';

// An item with no anchor_progress can't be gated — treat it as always safe to
// show, same "unknown position ⇒ don't gate" rule the icon's own gating uses
// (entityIcons.ts's isEligible).
const isFactVisible = (anchorProgress: number | null, progressFraction: number): boolean =>
  anchorProgress == null || anchorProgress <= progressFraction;

const visibleFacts = (facts: KnowledgeFact[], progressFraction: number): KnowledgeFact[] =>
  facts.filter((fact) => isFactVisible(fact.anchor_progress, progressFraction));

// Kicker + title + optional type badge, shared by every entity category. Uses
// `primary` (not a fixed hue) so the accent tracks whatever color the reader
// picked in the theme menu — see store/themeStore.ts / styles/themes.ts.
const EntityHeader: React.FC<{
  kicker: string;
  title: string;
  badge?: string;
}> = ({ kicker, title, badge }) => (
  <div className='mb-4'>
    <div className='mb-1 flex items-center gap-2'>
      <span className='text-primary text-xs font-semibold tracking-widest uppercase'>{kicker}</span>
      {badge && <span className='badge badge-sm capitalize'>{badge}</span>}
    </div>
    <h2 className='text-base-content text-lg font-semibold'>{title}</h2>
  </div>
);

const AlternativeNames: React.FC<{ names?: string[] }> = ({ names }) => {
  const _ = useTranslation();
  if (!names?.length) return null;
  return (
    <div className='mb-4'>
      <p className='text-base-content/50 mb-1.5 text-xs font-bold tracking-[0.1em] uppercase'>
        {_('Also known as')}
      </p>
      <div className='flex flex-wrap gap-1.5'>
        {names.map((name) => (
          <span
            key={name}
            className={[
              'border-primary/20 text-primary not-eink:bg-primary/10',
              'eink-bordered rounded-full border px-2.5 py-0.5 text-sm',
            ].join(' ')}
          >
            {name}
          </span>
        ))}
      </div>
    </div>
  );
};

const FactSection: React.FC<{ title: string; facts: KnowledgeFact[] }> = ({ title, facts }) => {
  if (facts.length === 0) return null;
  return (
    <section className='mb-5'>
      <h3 className='text-base-content/50 mb-2 text-xs font-bold tracking-[0.1em] uppercase'>
        {title}
      </h3>
      <ul className='space-y-2.5 text-base'>
        {facts.map((fact, i) => (
          <li key={i} className='border-primary/30 border-l-2 pl-3'>
            {fact.text}
          </li>
        ))}
      </ul>
    </section>
  );
};

const CitationsList: React.FC<{ citations: Citation[] }> = ({ citations }) => {
  const _ = useTranslation();
  const withUrl = citations.filter((citation) => citation.url);
  if (withUrl.length === 0) return null;
  return (
    <section className='border-base-content/10 mt-5 border-t pt-3'>
      <h3 className='text-base-content/50 mb-1.5 text-xs font-bold tracking-[0.1em] uppercase'>
        {_('Sources')}
      </h3>
      <ul className='space-y-1.5 text-base'>
        {withUrl.map((citation, i) => (
          <li key={i} className='flex items-start gap-1.5'>
            <MdStar className='text-primary mt-1 shrink-0' size={14} />
            <a href={citation.url} target='_blank' rel='noreferrer' className='link link-primary'>
              {citation.title}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
};

export const CharacterContent: React.FC<{
  entity: CharacterEntity;
  progressFraction: number;
}> = ({ entity, progressFraction }) => {
  const _ = useTranslation();
  const showIntro = isFactVisible(entity.introduction.anchor_progress, progressFraction);
  return (
    <div>
      <EntityHeader kicker={_('Person')} title={entity.name} badge={entity.character_type} />
      {(entity.occupation || entity.social_status) && (
        <p className='text-base-content/60 mb-4 text-sm capitalize'>
          {[entity.occupation, entity.social_status]
            .filter((part) => part && part !== 'unknown')
            .join(' · ')}
        </p>
      )}
      <AlternativeNames names={entity.alternative_names} />
      {showIntro && (
        <p className='border-primary/30 mb-5 border-l-2 pl-3 text-base'>
          {entity.introduction.text}
        </p>
      )}
      <FactSection
        title={_('Biography')}
        facts={visibleFacts(entity.biography, progressFraction)}
      />
      <FactSection
        title={_('Motivations')}
        facts={visibleFacts(entity.motivations, progressFraction)}
      />
      <FactSection
        title={_('Conflicts')}
        facts={visibleFacts(entity.conflicts, progressFraction)}
      />
      <FactSection
        title={_('Notable Events')}
        facts={visibleFacts(entity.notable_events, progressFraction)}
      />
      <CitationsList citations={entity.citations} />
    </div>
  );
};

export const PlaceContent: React.FC<{ entity: PlaceEntity; progressFraction: number }> = ({
  entity,
  progressFraction,
}) => {
  const _ = useTranslation();
  return (
    <div>
      <EntityHeader kicker={_('Place')} title={entity.name} badge={entity.type || undefined} />
      <AlternativeNames names={entity.alternative_names} />
      {entity.geography && (
        <p className='border-primary/30 mb-4 border-l-2 pl-3 text-base'>{entity.geography}</p>
      )}
      {entity.historical_context && (
        <p className='border-primary/30 mb-4 border-l-2 pl-3 text-base'>
          {entity.historical_context}
        </p>
      )}
      <FactSection title={_('Facts')} facts={visibleFacts(entity.facts, progressFraction)} />
      {entity.role_in_narrative && (
        <p className='border-primary/30 mb-4 border-l-2 pl-3 text-base'>
          {entity.role_in_narrative}
        </p>
      )}
      {entity.significance_in_book && (
        <p className='border-primary/30 mb-4 border-l-2 pl-3 text-base'>
          {entity.significance_in_book}
        </p>
      )}
      <CitationsList citations={entity.citations} />
    </div>
  );
};

export const GlossaryContent: React.FC<{ entity: GlossaryEntity }> = ({ entity }) => {
  const _ = useTranslation();
  return (
    <div>
      <EntityHeader
        kicker={_('Term')}
        title={entity.term}
        badge={_('{{source}} definition', { source: entity.definition_source })}
      />
      {entity.general_definition && (
        <p className='border-primary/30 mb-5 border-l-2 pl-3 text-base'>
          {entity.general_definition.text}
        </p>
      )}
      {entity.contextual_definition.length > 0 && (
        <section className='mb-5'>
          <h3 className='text-base-content/50 mb-2 text-xs font-bold tracking-[0.1em] uppercase'>
            {_('In This Book')}
          </h3>
          <ul className='space-y-2.5 text-base'>
            {entity.contextual_definition.map((definition, i) => (
              <li key={i} className='border-primary/30 border-l-2 pl-3'>
                {definition.text}
              </li>
            ))}
          </ul>
        </section>
      )}
      {entity.specific_usage_or_shift && (
        <section className='mb-5'>
          <h3 className='text-base-content/50 mb-2 text-xs font-bold tracking-[0.1em] uppercase'>
            {_('Meaning Shift')}
          </h3>
          {/* Distinct accent (accent, not primary) — signals this reading diverges
              from the general definition above, so it deliberately doesn't share
              the same color as every other block. Still theme-reactive. */}
          <p className='border-accent/60 text-base-content border-l-2 pl-3 text-base'>
            {entity.specific_usage_or_shift.text}
          </p>
        </section>
      )}
      <CitationsList citations={entity.citations} />
    </div>
  );
};

export const FootnoteContent: React.FC<{ entity: FootnoteEntity }> = ({ entity }) => {
  const _ = useTranslation();
  return (
    <div>
      <EntityHeader kicker={_('End Note')} title={entity.source_label} />
      <p className='border-primary/30 border-l-2 pl-3 text-base'>{entity.target}</p>
    </div>
  );
};
