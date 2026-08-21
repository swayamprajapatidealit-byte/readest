import React from 'react';

import type { Insets } from '@/types/misc';
import { RSVPControl } from '../rsvp';
import TTSControl from '../tts/TTSControl';

interface FooterBarProps {
  bookKey: string;
  gridInsets: Insets;
}

// The visible bottom bar (page/section nav, go back/forward, page jump, speak,
// drag-to-jump progress slider) was removed in favor of edge page-navigation
// buttons and header controls. This component now only hosts the TTS/RSVP
// overlays, which used to live alongside the bar.
//
// The drag-to-jump progress slider is kept here, commented out, to be
// reinstated later:
//
// <input
//   type='range'
//   className='text-base-content mx-2 min-w-0 flex-1'
//   min={0}
//   max={100}
//   aria-label={_('Jump to Location')}
//   value={progressValue}
//   onChange={(e) => handleProgressChange(parseInt(e.target.value, 10))}
// />
const FooterBar: React.FC<FooterBarProps> = ({ bookKey, gridInsets }) => {
  return (
    <>
      <TTSControl bookKey={bookKey} gridInsets={gridInsets} />
      <RSVPControl bookKey={bookKey} gridInsets={gridInsets} />
    </>
  );
};

export default FooterBar;
