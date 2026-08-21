import React, { useRef } from 'react';
import {
  MdStar,
  MdPerson,
  MdLocationOn,
  MdMenuBook,
  MdStickyNote2,
  MdChevronRight,
} from 'react-icons/md';

import { useTranslation } from '@/hooks/useTranslation';
import { useResponsiveSize } from '@/hooks/useResponsiveSize';
import type {
  Citation,
  CharacterEntity,
  FootnoteEntity,
  GlossaryEntity,
  PlaceEntity,
} from '@/services/visualible/entityTypes';
import { useEntityViewMemory } from '@/store/entityViewMemoryStore';
import {
  getFactId,
  isFactVisible,
  isIntroductionVisible,
  isPlaceNarrativeFieldVisible,
  withFactIds,
  type IdentifiedFact,
} from '@/app/reader/utils/entityFacts';

// A fact that was ever shown (offered via an icon or actually opened) stays
// visible even if the reader scrolls back past its anchor — otherwise
// back-navigation would visibly retract facts already read.
const factsOrSticky = (
  facts: IdentifiedFact[],
  progressFraction: number,
  stickyIds: Set<string>,
): IdentifiedFact[] =>
  facts.filter(({ fact, id }) => stickyIds.has(id) || isFactVisible(fact, progressFraction));

// Freezes the set of fact ids already seen *before this viewing* of an
// entity, so facts that were already known don't flicker out of "new" mid-
// session as the live "mark seen" effect (EntityPanel.tsx) writes newly-
// opened/unlocked ids into the same memory this reads from. Re-snapshots
// only when the entity being displayed actually changes.
const useOpenedSeenIds = (entityKey: string, liveSeenInfo: string[] | undefined): Set<string> => {
  const keyRef = useRef<string | null>(null);
  const snapshotRef = useRef<Set<string>>(new Set());
  if (keyRef.current !== entityKey) {
    keyRef.current = entityKey;
    snapshotRef.current = new Set(liveSeenInfo ?? []);
  }
  return snapshotRef.current;
};

// Kicker + title + optional type badge, shared by every entity category. Uses
// `primary` (not a fixed hue) so the accent tracks whatever color the reader
// picked in the theme menu — see store/themeStore.ts / styles/themes.ts.
const EntityHeader: React.FC<{
  icon: React.ReactNode;
  kicker: string;
  title: string;
  badge?: string;
}> = ({ icon, kicker, title, badge }) => (
  <div className='mb-4 flex items-start gap-3'>
    <div className='bg-primary/10 text-primary eink-bordered flex h-9 w-9 shrink-0 items-center justify-center rounded-full'>
      {icon}
    </div>
    <div>
      <div className='mb-1 flex items-center gap-2'>
        <span className='text-primary text-xs font-semibold tracking-widest uppercase'>
          {kicker}
        </span>
        {badge && <span className='badge badge-sm capitalize'>{badge}</span>}
      </div>
      <h2 className='text-base-content text-lg font-semibold'>{title}</h2>
    </div>
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

const FactSection: React.FC<{
  title: string;
  facts: IdentifiedFact[];
  openedSeenIds: Set<string>;
}> = ({ title, facts, openedSeenIds }) => {
  const _ = useTranslation();
  const chevronSize = useResponsiveSize(14);
  if (facts.length === 0) return null;
  const fresh = facts.filter(({ id }) => !openedSeenIds.has(id));
  const seen = facts.filter(({ id }) => openedSeenIds.has(id));
  return (
    <section className='mb-5'>
      <h3 className='text-base-content/50 mb-2 text-xs font-bold tracking-[0.1em] uppercase'>
        {title}
      </h3>
      {fresh.length > 0 && (
        <ul className='space-y-2.5 text-base'>
          {fresh.map(({ fact, id }) => (
            <li key={id} className='border-primary/30 border-s-2 ps-3'>
              {fact.text}
            </li>
          ))}
        </ul>
      )}
      {seen.length > 0 && (
        <details className={fresh.length > 0 ? 'group mt-2' : 'group'} open={fresh.length === 0}>
          <summary className='text-base-content/50 flex cursor-pointer items-center gap-1 text-xs font-medium select-none [&::-webkit-details-marker]:hidden'>
            <MdChevronRight
              size={chevronSize}
              className='shrink-0 transition-transform duration-150 group-open:rotate-90'
            />
            {_('Previously seen ({{count}})', { count: seen.length })}
          </summary>
          <ul className='mt-2 space-y-2.5 text-base'>
            {seen.map(({ fact, id }) => (
              <li key={id} className='border-base-content/20 border-s-2 ps-3 opacity-70'>
                {fact.text}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
};

const CitationsList: React.FC<{ citations: Citation[] }> = ({ citations }) => {
  const _ = useTranslation();
  const starSize = useResponsiveSize(14);
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
            <MdStar className='text-primary mt-1 shrink-0' size={starSize} />
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
  entityIndex: number;
  bookKey: string;
  progressFraction: number;
}> = ({ entity, entityIndex, bookKey, progressFraction }) => {
  const _ = useTranslation();
  const iconSize = useResponsiveSize(18);
  const bookId = bookKey.split('-')[0]!;
  const entityKey = `character:${entityIndex}`;
  const memory = useEntityViewMemory(bookId, entityKey);
  const stickyIds = new Set([...(memory?.seenInfo ?? []), ...(memory?.offeredInfo ?? [])]);
  const openedSeenIds = useOpenedSeenIds(entityKey, memory?.seenInfo);

  const introId = getFactId('character', entityIndex, 'introduction', 0);
  const showIntro =
    stickyIds.has(introId) || isIntroductionVisible(entity.introduction, progressFraction);

  const biography = factsOrSticky(
    withFactIds(entity.biography, 'character', entityIndex, 'biography'),
    progressFraction,
    stickyIds,
  );
  const motivations = factsOrSticky(
    withFactIds(entity.motivations, 'character', entityIndex, 'motivations'),
    progressFraction,
    stickyIds,
  );
  const conflicts = factsOrSticky(
    withFactIds(entity.conflicts, 'character', entityIndex, 'conflicts'),
    progressFraction,
    stickyIds,
  );
  const notableEvents = factsOrSticky(
    withFactIds(entity.notable_events, 'character', entityIndex, 'notable_events'),
    progressFraction,
    stickyIds,
  );

  return (
    <div>
      <EntityHeader
        icon={<MdPerson size={iconSize} />}
        kicker={_('Person')}
        title={entity.name}
        badge={entity.character_type}
      />
      {(entity.occupation || entity.social_status) && (
        <p className='text-base-content/60 mb-4 text-sm capitalize'>
          {[entity.occupation, entity.social_status]
            .filter((part) => part && part !== 'unknown')
            .join(' · ')}
        </p>
      )}
      <AlternativeNames names={entity.alternative_names} />
      {showIntro && (
        <p className='border-primary/30 mb-5 border-s-2 ps-3 text-base'>
          {entity.introduction.text}
        </p>
      )}
      <FactSection title={_('Biography')} facts={biography} openedSeenIds={openedSeenIds} />
      <FactSection title={_('Motivations')} facts={motivations} openedSeenIds={openedSeenIds} />
      <FactSection title={_('Conflicts')} facts={conflicts} openedSeenIds={openedSeenIds} />
      <FactSection
        title={_('Notable Events')}
        facts={notableEvents}
        openedSeenIds={openedSeenIds}
      />
      <CitationsList citations={entity.citations} />
    </div>
  );
};

export const PlaceContent: React.FC<{
  entity: PlaceEntity;
  entityIndex: number;
  bookKey: string;
  progressFraction: number;
}> = ({ entity, entityIndex, bookKey, progressFraction }) => {
  const _ = useTranslation();
  const iconSize = useResponsiveSize(18);
  const bookId = bookKey.split('-')[0]!;
  const entityKey = `place:${entityIndex}`;
  const memory = useEntityViewMemory(bookId, entityKey);
  const stickyIds = new Set([...(memory?.seenInfo ?? []), ...(memory?.offeredInfo ?? [])]);
  const openedSeenIds = useOpenedSeenIds(entityKey, memory?.seenInfo);

  const facts = factsOrSticky(
    withFactIds(entity.facts, 'place', entityIndex, 'facts'),
    progressFraction,
    stickyIds,
  );
  const narrativeId = getFactId('place', entityIndex, 'narrative', 0);
  const showNarrative =
    stickyIds.has(narrativeId) || isPlaceNarrativeFieldVisible(entity, progressFraction);

  return (
    <div>
      <EntityHeader
        icon={<MdLocationOn size={iconSize} />}
        kicker={_('Place')}
        title={entity.name}
        badge={entity.type || undefined}
      />
      <AlternativeNames names={entity.alternative_names} />
      {entity.geography && (
        <p className='border-primary/30 mb-4 border-s-2 ps-3 text-base'>{entity.geography}</p>
      )}
      {entity.historical_context && (
        <p className='border-primary/30 mb-4 border-s-2 ps-3 text-base'>
          {entity.historical_context}
        </p>
      )}
      <FactSection title={_('Facts')} facts={facts} openedSeenIds={openedSeenIds} />
      {showNarrative && entity.role_in_narrative && (
        <p className='border-primary/30 mb-4 border-s-2 ps-3 text-base'>
          {entity.role_in_narrative}
        </p>
      )}
      {showNarrative && entity.significance_in_book && (
        <p className='border-primary/30 mb-4 border-s-2 ps-3 text-base'>
          {entity.significance_in_book}
        </p>
      )}
      <CitationsList citations={entity.citations} />
    </div>
  );
};

export const GlossaryContent: React.FC<{ entity: GlossaryEntity }> = ({ entity }) => {
  const _ = useTranslation();
  const iconSize = useResponsiveSize(18);
  return (
    <div>
      <EntityHeader
        icon={<MdMenuBook size={iconSize} />}
        kicker={_('Term')}
        title={entity.term}
        badge={_('{{source}} definition', { source: entity.definition_source })}
      />
      {entity.general_definition && (
        <p className='border-primary/30 mb-5 border-s-2 ps-3 text-base'>
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
              <li key={i} className='border-primary/30 border-s-2 ps-3'>
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
          <p className='border-accent/60 text-base-content border-s-2 ps-3 text-base'>
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
  const iconSize = useResponsiveSize(18);
  return (
    <div>
      <EntityHeader
        icon={<MdStickyNote2 size={iconSize} />}
        kicker={_('End Note')}
        title={entity.source_label}
      />
      <p className='border-primary/30 border-s-2 ps-3 text-base'>{entity.target}</p>
    </div>
  );
};
