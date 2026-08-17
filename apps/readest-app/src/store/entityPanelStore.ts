import { create } from 'zustand';
import type { EntityCategory } from '@/app/reader/utils/entityMatching';

export interface SelectedEntityRef {
  bookKey: string;
  category: EntityCategory;
  entityIndex: number;
  // Which side of its pane the clicked icon/marker was on — the panel itself
  // renders on the opposite side (see EntityPanel.tsx) so it doesn't cover it.
  side: 'left' | 'right';
}

interface EntityPanelState {
  entityPanelWidth: string;
  isEntityPanelVisible: boolean;
  isEntityPanelPinned: boolean;
  selectedEntityRef: SelectedEntityRef | null;
  setEntityPanelWidth: (width: string) => void;
  setEntityPanelVisible: (visible: boolean) => void;
  setEntityPanelPin: (pinned: boolean) => void;
  toggleEntityPanelPin: () => void;
  setSelectedEntityRef: (ref: SelectedEntityRef | null) => void;
}

export const useEntityPanelStore = create<EntityPanelState>((set) => ({
  entityPanelWidth: '20%',
  isEntityPanelVisible: false,
  isEntityPanelPinned: false,
  selectedEntityRef: null,
  setEntityPanelWidth: (width: string) => set({ entityPanelWidth: width }),
  setEntityPanelVisible: (visible: boolean) => set({ isEntityPanelVisible: visible }),
  setEntityPanelPin: (pinned: boolean) => set({ isEntityPanelPinned: pinned }),
  toggleEntityPanelPin: () => set((state) => ({ isEntityPanelPinned: !state.isEntityPanelPinned })),
  setSelectedEntityRef: (ref: SelectedEntityRef | null) => set({ selectedEntityRef: ref }),
}));
