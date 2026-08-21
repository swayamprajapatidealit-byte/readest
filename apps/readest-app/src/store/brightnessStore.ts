import { create } from 'zustand';

interface BrightnessState {
  // 0-1. 1 = full brightness (no dimming). Global/app-wide, like a real
  // screen dimmer — not tied to any one book's view settings.
  brightness: number;
  setBrightness: (value: number) => void;
}

export const useBrightnessStore = create<BrightnessState>((set) => ({
  brightness: 1,
  setBrightness: (value) => set({ brightness: Math.max(0, Math.min(1, value)) }),
}));
