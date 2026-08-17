import React from 'react';

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

const FactSection: React.FC<{ title: string; facts: KnowledgeFact[] }> = ({ title, facts }) => {
  if (facts.length === 0) return null;
  return (
    <section className='mb-4'>
      <h3 className='text-base-content/60 mb-1 text-xs font-semibold uppercase'>{title}</h3>
      <ul className='space-y-1.5 text-sm'>
        {facts.map((fact, i) => (
          <li key={i}>{fact.text}</li>
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
    <section className='border-base-300 mt-4 border-t pt-3'>
      <h3 className='text-base-content/60 mb-1 text-xs font-semibold uppercase'>{_('Sources')}</h3>
      <ul className='space-y-1 text-sm'>
        {withUrl.map((citation, i) => (
          <li key={i}>
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
  const subtitleParts = [entity.character_type, entity.occupation, entity.social_status].filter(
    (part) => part && part !== 'unknown',
  );
  const showIntro = isFactVisible(entity.introduction.anchor_progress, progressFraction);
  return (
    <div>
      {subtitleParts.length > 0 && (
        <p className='text-base-content/60 mb-3 text-sm capitalize'>{subtitleParts.join(' · ')}</p>
      )}
      {!!entity.alternative_names?.length && (
        <p className='text-base-content/60 mb-3 text-sm'>
          {_('Also known as')}: {entity.alternative_names.join(', ')}
        </p>
      )}
      {showIntro && <p className='mb-4 text-sm'>{entity.introduction.text}</p>}
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
      {entity.type && <p className='text-base-content/60 mb-3 text-sm capitalize'>{entity.type}</p>}
      {!!entity.alternative_names?.length && (
        <p className='text-base-content/60 mb-3 text-sm'>
          {_('Also known as')}: {entity.alternative_names.join(', ')}
        </p>
      )}
      {entity.geography && <p className='mb-3 text-sm'>{entity.geography}</p>}
      {entity.historical_context && <p className='mb-3 text-sm'>{entity.historical_context}</p>}
      <FactSection title={_('Facts')} facts={visibleFacts(entity.facts, progressFraction)} />
      {entity.role_in_narrative && <p className='mb-3 text-sm'>{entity.role_in_narrative}</p>}
      {entity.significance_in_book && <p className='mb-3 text-sm'>{entity.significance_in_book}</p>}
      <CitationsList citations={entity.citations} />
    </div>
  );
};

export const GlossaryContent: React.FC<{ entity: GlossaryEntity }> = ({ entity }) => {
  const _ = useTranslation();
  return (
    <div>
      {entity.general_definition && (
        <p className='mb-4 text-sm'>{entity.general_definition.text}</p>
      )}
      {entity.contextual_definition.length > 0 && (
        <section className='mb-4'>
          <h3 className='text-base-content/60 mb-1 text-xs font-semibold uppercase'>
            {_('In This Book')}
          </h3>
          <ul className='space-y-1.5 text-sm'>
            {entity.contextual_definition.map((definition, i) => (
              <li key={i}>{definition.text}</li>
            ))}
          </ul>
        </section>
      )}
      {entity.specific_usage_or_shift && (
        <p className='mb-4 text-sm'>{entity.specific_usage_or_shift.text}</p>
      )}
      <CitationsList citations={entity.citations} />
    </div>
  );
};

export const FootnoteContent: React.FC<{ entity: FootnoteEntity }> = ({ entity }) => {
  return (
    <div>
      <p className='text-sm'>{entity.target}</p>
    </div>
  );
};
