import { create } from 'zustand';
import type { VisualibleSession } from '@/services/visualible/types';

interface SessionState {
  // The slug/token that opened this reader session (see src/app/page.tsx).
  // Read from here rather than re-parsing the URL so components outside the
  // initial page load (e.g. BookMenu's purchased-library picker) can also
  // make authenticated Visualible API calls.
  session: VisualibleSession | null;
  // Caches slug -> already-imported book hash so re-opening a purchased book
  // (e.g. clicking it again in BookMenu) skips the fetch/import round-trip.
  slugToHash: Record<string, string>;
  setSession: (session: VisualibleSession) => void;
  getHashForSlug: (slug: string) => string | undefined;
  setHashForSlug: (slug: string, hash: string) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  session: null,
  slugToHash: {},
  setSession: (session) => set({ session }),
  getHashForSlug: (slug) => get().slugToHash[slug],
  setHashForSlug: (slug, hash) =>
    set((state) => ({ slugToHash: { ...state.slugToHash, [slug]: hash } })),
}));
