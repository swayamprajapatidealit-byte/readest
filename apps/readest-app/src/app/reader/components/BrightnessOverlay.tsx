'use client';

import React from 'react';
import { useBrightnessStore } from '@/store/brightnessStore';

// The web build has no OS/device brightness API to call — this simulates
// dimming with a translucent black layer above everything (mirroring real
// hardware brightness, which dims the whole screen, not just the book text).
// Capped below full opacity so content never goes fully black at minimum.
const MAX_OVERLAY_OPACITY = 0.85;

const BrightnessOverlay: React.FC = () => {
  const brightness = useBrightnessStore((s) => s.brightness);
  if (brightness >= 1) return null;

  return (
    <div
      aria-hidden='true'
      className='pointer-events-none fixed inset-0 z-[100] bg-black transition-opacity duration-150'
      style={{ opacity: (1 - brightness) * MAX_OVERLAY_OPACITY }}
    />
  );
};

export default BrightnessOverlay;
