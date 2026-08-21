'use client';

import * as React from 'react';
import { useEffect, Suspense } from 'react';

import { useTheme } from '@/hooks/useTheme';
import { useLibrary } from '@/hooks/useLibrary';
import { useSettingsStore } from '@/store/settingsStore';
import { useScreenWakeLock } from '@/hooks/useScreenWakeLock';
import { interceptWindowOpen } from '@/utils/open';
import { mountAdditionalFonts } from '@/styles/fonts';
import { isTauriAppPlatform } from '@/services/environment';
import { getSysFontsList } from '@/utils/bridge';
import { AboutWindow } from '@/components/AboutWindow';
import { KeyboardShortcutsHelp } from '@/components/KeyboardShortcutsHelp';
import { ProofreadRulesManager } from './ProofreadRules';
import { Toast } from '@/components/Toast';
import BrightnessOverlay from './BrightnessOverlay';
import ProductTour from './tour/ProductTour';
import { getLocale } from '@/utils/misc';
import { initDayjs } from '@/utils/time';
import ReaderContent from './ReaderContent';

/*
Z-Index Layering Guide:
---------------------------------
100 – Brightness Overlay
     • Simulated screen dimming; pointer-events-none so it never blocks input.
99 – Window Border (Linux only)
     • Ensures the border stays on top of all UI elements.
50 – Loading Progress / Toast Notifications / Dialogs / Popups
     • Includes Settings, About, Updater dialogs and Annotation popups.
48 – Product Tour
     • Sits above all reading chrome/panels (45) but below dialogs/toasts (50),
       so an error toast or Settings dialog still surfaces over an active tour.
45 – Sidebar / Notebook (Unpinned)
     • Floats above the content but below global dialogs.
40 – TTS Bar
     • Mini controls for TTS playback on top of the TTS Control.
30 – TTS Control
     • Persistent TTS icon/panel.
20 – Menu / Sidebar / Notebook (Pinned)
     • Docked navigation or note views.
10 – Headerbar / Footbar / Ribbon
     • Top toolbar, bottom footbar and ribbon elements.
 0 – Base Content
     • Main reading area or background content.
*/

const Reader: React.FC<{ ids?: string }> = ({ ids }) => {
  const { settings } = useSettingsStore();
  const { libraryLoaded } = useLibrary();

  useTheme({ appThemeColor: 'base-100' });
  useScreenWakeLock(settings.screenWakeLock);

  useEffect(() => {
    mountAdditionalFonts(document);
    interceptWindowOpen();
    if (isTauriAppPlatform()) {
      setTimeout(getSysFontsList, 3000);
    }
    initDayjs(getLocale());
  }, []);

  return libraryLoaded && settings.globalReadSettings ? (
    <div className='reader-page bg-base-100 text-base-content full-height select-none overflow-hidden'>
      <Suspense fallback={<div className='full-height'></div>}>
        <ReaderContent ids={ids} settings={settings} />
        <AboutWindow />
        <KeyboardShortcutsHelp />
        <ProofreadRulesManager />
        <Toast />
        <BrightnessOverlay />
        <ProductTour />
      </Suspense>
    </div>
  ) : (
    <div className='full-height bg-base-100'></div>
  );
};

export default Reader;
