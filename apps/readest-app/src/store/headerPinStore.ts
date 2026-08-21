import { create } from 'zustand';

// Per-pane (bookKey), like isSideBarPinned/isNotebookPinned — in-memory only,
// not persisted, resets on reload.
interface HeaderPinState {
  pinnedKeys: Record<string, boolean>;
  isHeaderPinned: (bookKey: string) => boolean;
  toggleHeaderPin: (bookKey: string) => void;
}

export const useHeaderPinStore = create<HeaderPinState>((set, get) => ({
  pinnedKeys: {},
  isHeaderPinned: (bookKey) => !!get().pinnedKeys[bookKey],
  toggleHeaderPin: (bookKey) =>
    set((state) => ({
      pinnedKeys: { ...state.pinnedKeys, [bookKey]: !state.pinnedKeys[bookKey] },
    })),
}));
