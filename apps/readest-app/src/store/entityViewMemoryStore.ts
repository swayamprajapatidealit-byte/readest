import { create } from 'zustand';

export interface EntityViewMemory {
  seen: boolean;
  lastSeenChapter: number;
  seenInfo: string[]; // fact ids the reader has actually opened/read
  seenOccurrences: string[]; // entity keys the panel was opened from
  offeredInfo: string[]; // fact ids shown via an icon, not yet opened
  offeredAtOffsets: Record<string, number[]>; // "s{spineIndex}" -> char offsets an icon was placed at
}

/**
 * Per-book memory of what an entity's icon has offered and what the reader
 * has actually opened. Powers two things:
 *   - seen-suppression: hide an entity's icon once every currently-visible
 *     fact for it has already been opened in the panel.
 *   - "sticky" facts: a fact that was ever shown stays visible even if the
 *     reader scrolls back past its anchor.
 *
 * Keyed by bare book id (not view key) so two split-screen panes on the same
 * book share one "have I seen this" state, matching bookDataStore's
 * `ebookContent` keying. In-memory only, like readerProgressStore — a hard
 * reload starts fresh.
 */
interface EntityViewMemoryState {
  entityViewMemory: { [bookId: string]: { [entityKey: string]: EntityViewMemory } };
}

const EMPTY_MEMORY: EntityViewMemory = {
  seen: false,
  lastSeenChapter: -1,
  seenInfo: [],
  seenOccurrences: [],
  offeredInfo: [],
  offeredAtOffsets: {},
};

export const useEntityViewMemoryStore = create<EntityViewMemoryState>(() => ({
  entityViewMemory: {},
}));

/** Imperative read — use inside event handlers/callbacks, not React render. */
export const getEntityViewMemory = (bookId: string, entityKey: string): EntityViewMemory | null =>
  useEntityViewMemoryStore.getState().entityViewMemory[bookId]?.[entityKey] ?? null;

/** Reactive subscription, scoped to one entity so unrelated updates don't re-render it. */
export const useEntityViewMemory = (
  bookId: string | null,
  entityKey: string | null,
): EntityViewMemory | null =>
  useEntityViewMemoryStore((s) =>
    bookId && entityKey ? (s.entityViewMemory[bookId]?.[entityKey] ?? null) : null,
  );

/** Records that an icon offered these facts — called every time one is injected. */
export const offerEntityFacts = (
  bookId: string,
  entityKey: string,
  factIds: string[],
  spineIndex: number,
  charOffset: number,
): void => {
  useEntityViewMemoryStore.setState((state) => {
    const existing = state.entityViewMemory[bookId]?.[entityKey] ?? EMPTY_MEMORY;
    const offeredInfo = Array.from(new Set([...existing.offeredInfo, ...factIds]));
    const offsetKey = `s${spineIndex}`;
    const existingOffsets = existing.offeredAtOffsets[offsetKey] ?? [];
    const offsetIsNew = !existingOffsets.includes(charOffset);

    if (offeredInfo.length === existing.offeredInfo.length && !offsetIsNew) return state;

    return {
      entityViewMemory: {
        ...state.entityViewMemory,
        [bookId]: {
          ...state.entityViewMemory[bookId],
          [entityKey]: {
            ...existing,
            offeredInfo,
            offeredAtOffsets: offsetIsNew
              ? { ...existing.offeredAtOffsets, [offsetKey]: [...existingOffsets, charOffset] }
              : existing.offeredAtOffsets,
          },
        },
      },
    };
  });
};

/** Records that the reader actually opened the panel and saw these facts. */
export const markEntityInfoSeen = (
  bookId: string,
  entityKey: string,
  infoIds: string[],
  chapter: number,
  occurrenceKey: string,
): void => {
  useEntityViewMemoryStore.setState((state) => {
    const existing = state.entityViewMemory[bookId]?.[entityKey] ?? EMPTY_MEMORY;
    const seenInfo = Array.from(new Set([...existing.seenInfo, ...infoIds]));
    const seenOccurrences = existing.seenOccurrences.includes(occurrenceKey)
      ? existing.seenOccurrences
      : [...existing.seenOccurrences, occurrenceKey];

    if (
      seenInfo.length === existing.seenInfo.length &&
      seenOccurrences.length === existing.seenOccurrences.length &&
      existing.seen &&
      existing.lastSeenChapter === chapter
    ) {
      return state;
    }

    return {
      entityViewMemory: {
        ...state.entityViewMemory,
        [bookId]: {
          ...state.entityViewMemory[bookId],
          [entityKey]: {
            ...existing,
            seen: true,
            lastSeenChapter: chapter,
            seenInfo,
            seenOccurrences,
          },
        },
      },
    };
  });
};

/** Drop a book's entity memory — call when the book's data is unloaded. */
export const clearEntityViewMemory = (bookId: string): void => {
  useEntityViewMemoryStore.setState((state) => {
    if (!(bookId in state.entityViewMemory)) return state;
    const next = { ...state.entityViewMemory };
    delete next[bookId];
    return { entityViewMemory: next };
  });
};
