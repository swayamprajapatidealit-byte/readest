import clsx from 'clsx';
import React, { useEffect, useState } from 'react';
import { VscClose } from 'react-icons/vsc';
import { FiMinus, FiPlus } from 'react-icons/fi';
import { MdOutlineSettings, MdOutlineLightMode, MdChevronRight } from 'react-icons/md';
import { MdReorder, MdOutlineCopyright } from 'react-icons/md';
import { BiMoon, BiSun } from 'react-icons/bi';
import { TbSunMoon } from 'react-icons/tb';

import { useEnv } from '@/context/EnvContext';
import { useThemeStore } from '@/store/themeStore';
import { useReaderStore } from '@/store/readerStore';
import { useBrightnessStore } from '@/store/brightnessStore';
import { useTranslation } from '@/hooks/useTranslation';
import { saveViewSettings } from '@/helpers/settings';
import { nextThemeMode } from '@/utils/ambientLight';
import { valueToPosition, positionToValue } from '@/app/reader/utils/brightnessGesture';
import { setAboutDialogVisible } from '@/components/AboutWindow';
import { SettingLabel, SectionTitle } from '@/components/settings/primitives';
import Dropdown from '@/components/Dropdown';
import Menu from '@/components/Menu';

// A settings row with a leading icon chip and a trailing value + chevron —
// tapping the row itself steps to the next value (no separate sub-page).
const ValueRow: React.FC<{
  icon: React.ElementType;
  label: string;
  value: string;
  onClick: () => void;
}> = ({ icon: Icon, label, value, onClick }) => (
  <button
    type='button'
    onClick={onClick}
    className='group flex w-full items-center justify-between gap-3 py-3 pe-4 text-left transition-colors duration-150'
  >
    <span className='flex min-w-0 items-center gap-3'>
      <span className='bg-base-200 text-base-content/70 group-hover:bg-base-300/70 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-colors duration-150'>
        <Icon className='h-5 w-5' />
      </span>
      <SettingLabel>{label}</SettingLabel>
    </span>
    <span className='text-base-content/60 flex flex-shrink-0 items-center gap-1 text-sm'>
      {value}
      <MdChevronRight className='text-base-content/40 h-5 w-5' />
    </span>
  </button>
);

interface DisplaySettingsMenuProps {
  bookKey: string;
  setIsDropdownOpen?: (open: boolean) => void;
}

// Reuses the exact same fields, persistence (saveViewSettings) and
// underlying feature as Settings > Layout (letterSpacing/lineHeight/
// fullJustification), the header's font-size zoom (defaultFontSize), and
// the theme mode cycle already used in ViewMenu — this is a quick-access
// panel onto those same settings, not a separate feature.
const DisplaySettingsMenu: React.FC<DisplaySettingsMenuProps> = ({
  bookKey,
  setIsDropdownOpen,
}) => {
  const _ = useTranslation();
  const { envConfig } = useEnv();
  const { themeMode, setThemeMode } = useThemeStore();
  const { getViewSettings } = useReaderStore();
  const viewSettings = getViewSettings(bookKey)!;
  const brightness = useBrightnessStore((s) => s.brightness);
  const setBrightness = useBrightnessStore((s) => s.setBrightness);

  const [letterSpacing, setLetterSpacing] = useState(viewSettings.letterSpacing);
  const [lineHeight, setLineHeight] = useState(viewSettings.lineHeight);
  const [fullJustification, setFullJustification] = useState(viewSettings.fullJustification);

  useEffect(() => {
    if (letterSpacing === viewSettings.letterSpacing) return;
    saveViewSettings(envConfig, bookKey, 'letterSpacing', letterSpacing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letterSpacing]);

  useEffect(() => {
    if (lineHeight === viewSettings.lineHeight) return;
    saveViewSettings(envConfig, bookKey, 'lineHeight', lineHeight);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineHeight]);

  useEffect(() => {
    if (fullJustification === viewSettings.fullJustification) return;
    saveViewSettings(envConfig, bookKey, 'fullJustification', fullJustification);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullJustification]);

  const brightnessPercent = Math.round(brightness * 100);
  // Slider travel is linear in perceptual position, not raw brightness value —
  // matches the (currently inert) edge-swipe brightness gesture's own math so
  // both feel consistent if that gesture is ever wired up.
  const brightnessSliderPosition = Math.round(valueToPosition(brightness) * 100);
  const handleBrightnessSliderChange = (position: number) => {
    setBrightness(positionToValue(position / 100));
  };

  const cycleThemeMode = () => setThemeMode(nextThemeMode(themeMode));
  const themeLabel =
    themeMode === 'dark'
      ? _('Dark Mode')
      : themeMode === 'light'
        ? _('Light Mode')
        : _('Auto Mode');
  const ThemeIcon = themeMode === 'dark' ? BiMoon : themeMode === 'light' ? BiSun : TbSunMoon;

  const cycleLetterSpacing = () => {
    const next = letterSpacing + 0.5 > 4 ? -2 : letterSpacing + 0.5;
    setLetterSpacing(Math.round(next * 10) / 10);
  };

  const decreaseLineHeight = () =>
    setLineHeight(Math.max(1.0, Math.round((lineHeight - 0.1) * 10) / 10));
  const increaseLineHeight = () =>
    setLineHeight(Math.min(3.0, Math.round((lineHeight + 0.1) * 10) / 10));

  const showCreditsWindow = () => {
    setAboutDialogVisible(true);
    setIsDropdownOpen?.(false);
  };

  return (
    <Menu
      className='display-settings-menu dropdown-content z-20 mt-1.5 w-80 rounded-2xl border shadow-2xl'
      onCancel={() => setIsDropdownOpen?.(false)}
    >
      <div className='flex items-center justify-between px-4 py-3'>
        <span className='text-base-content text-base font-semibold'>{_('Settings')}</span>
        <button
          type='button'
          aria-label={_('Close')}
          onClick={() => setIsDropdownOpen?.(false)}
          className='btn btn-ghost btn-circle btn-sm'
        >
          <VscClose />
        </button>
      </div>
      <hr aria-hidden='true' className='border-base-200' />

      <div className='space-y-1 px-2 py-3'>
        <SectionTitle className='mb-1'>{_('Display')}</SectionTitle>
        <div className='flex items-center gap-3 px-2 py-2'>
          <MdOutlineLightMode className='text-base-content/40 h-4 w-4 flex-shrink-0' />
          <input
            type='range'
            aria-label={_('Brightness')}
            min={0}
            max={100}
            value={brightnessSliderPosition}
            onChange={(e) => handleBrightnessSliderChange(Number(e.target.value))}
            className='range range-primary range-sm flex-1'
          />
          <MdOutlineLightMode className='text-base-content h-5 w-5 flex-shrink-0' />
          <span className='text-base-content/70 w-11 flex-shrink-0 text-right text-sm tabular-nums'>
            {brightnessPercent}%
          </span>
        </div>
        <div className='flex items-center justify-between gap-3 px-2 py-2'>
          <SettingLabel>{_('Appearance')}</SettingLabel>
          <button
            type='button'
            onClick={cycleThemeMode}
            className='btn btn-sm border-none bg-primary/10 text-primary hover:bg-primary/20 gap-1.5 rounded-full px-3'
          >
            <ThemeIcon className='h-4 w-4' />
            <span className='text-xs font-medium'>{themeLabel}</span>
          </button>
        </div>
      </div>

      <hr aria-hidden='true' className='border-base-200' />

      <div className='space-y-1 px-2 py-3'>
        <SectionTitle className='mb-1'>{_('Text & Layout')}</SectionTitle>
        <ValueRow
          icon={MdReorder}
          label={_('Letter Spacing')}
          value={`${letterSpacing}px`}
          onClick={cycleLetterSpacing}
        />
        <div className='flex items-center justify-between gap-3 py-3 pe-4'>
          <span className='flex min-w-0 items-center gap-3'>
            <span className='bg-base-200 text-base-content/70 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full'>
              <MdReorder className='h-5 w-5' />
            </span>
            <SettingLabel>{_('Line Height')}</SettingLabel>
          </span>
          <span className='flex flex-shrink-0 items-center gap-2'>
            <button
              type='button'
              aria-label={_('Decrease')}
              onClick={decreaseLineHeight}
              disabled={lineHeight <= 1.0}
              className={clsx('btn btn-circle btn-sm', lineHeight <= 1.0 && 'btn-disabled')}
            >
              <FiMinus className='h-4 w-4' />
            </button>
            <span className='w-8 text-center text-sm tabular-nums'>{lineHeight.toFixed(1)}</span>
            <button
              type='button'
              aria-label={_('Increase')}
              onClick={increaseLineHeight}
              disabled={lineHeight >= 3.0}
              className={clsx('btn btn-circle btn-sm', lineHeight >= 3.0 && 'btn-disabled')}
            >
              <FiPlus className='h-4 w-4' />
            </button>
          </span>
        </div>
        <ValueRow
          icon={MdReorder}
          label={_('Text Alignment')}
          value={fullJustification ? _('Justify') : _('Default')}
          onClick={() => setFullJustification(!fullJustification)}
        />
      </div>

      <hr aria-hidden='true' className='border-base-200' />

      <div className='space-y-1 px-2 py-3'>
        <SectionTitle className='mb-1'>{_('Support')}</SectionTitle>
        <ValueRow
          icon={MdOutlineCopyright}
          label={_('Copyright & Credits')}
          value=''
          onClick={showCreditsWindow}
        />
      </div>
    </Menu>
  );
};

interface DisplaySettingsTogglerProps {
  bookKey: string;
  onToggle?: (isOpen: boolean) => void;
}

const DisplaySettingsToggler: React.FC<DisplaySettingsTogglerProps> = ({ bookKey, onToggle }) => {
  const _ = useTranslation();

  return (
    <Dropdown
      label={_('Display Settings')}
      containerClassName='h-8'
      className='exclude-title-bar-mousedown dropdown-bottom dropdown-end'
      buttonClassName='btn btn-ghost h-8 min-h-8 w-8 p-0'
      toggleButton={<MdOutlineSettings size={20} />}
      onToggle={onToggle}
    >
      <DisplaySettingsMenu bookKey={bookKey} />
    </Dropdown>
  );
};

export default DisplaySettingsToggler;
