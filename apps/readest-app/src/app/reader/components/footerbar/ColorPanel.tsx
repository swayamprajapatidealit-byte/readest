import clsx from 'clsx';
import React from 'react';
import { PiSun, PiMoon } from 'react-icons/pi';
import { TbSunMoon } from 'react-icons/tb';
import { useThemeStore } from '@/store/themeStore';
import { useTranslation } from '@/hooks/useTranslation';
import { themes } from '@/styles/themes';
import { nextThemeMode } from '@/utils/ambientLight';

interface ColorPanelProps {
  actionTab: string;
  bottomOffset: string;
  forceMobileLayout: boolean;
}

export const ColorPanel: React.FC<ColorPanelProps> = ({
  actionTab,
  bottomOffset,
  forceMobileLayout,
}) => {
  const _ = useTranslation();
  const { themeMode, themeColor, isDarkMode, setThemeMode, setThemeColor } = useThemeStore();

  const cycleThemeMode = () => {
    setThemeMode(nextThemeMode(themeMode));
  };

  const classes = clsx(
    'footerbar-color-mobile not-eink:bg-base-200 eink:bg-base-100 absolute flex w-full flex-col items-center gap-y-8 px-4 transition-all',
    'eink:border-base-content eink:border-t',
    !forceMobileLayout && 'sm:hidden',
    // Paddings stay constant in both states (the slide is transform-only) so
    // offsetHeight always reports the panel's settled height; the TTS mini
    // player measures it to stack above the expanded panel.
    'pb-4 pt-8',
    actionTab === 'color'
      ? 'pointer-events-auto translate-y-0 ease-out'
      : 'pointer-events-none invisible translate-y-full overflow-hidden ease-in',
  );

  return (
    <div
      className={classes}
      style={{
        bottom: bottomOffset,
      }}
    >
      <div className='w-full'>
        <div className='flex items-center justify-between p-2'>
          <span className='text-sm font-medium'>{_('Color')}</span>
        </div>
        <div
          className='flex gap-3 overflow-x-auto p-2'
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {themes.map(({ name, label, colors }) => (
            <button
              key={name}
              onClick={() => setThemeColor(name)}
              className={clsx(
                'flex flex-shrink-0 flex-col items-center justify-center rounded-lg p-3 transition-all',
                'h-[40px] min-w-[80px]',
                themeColor === name
                  ? 'ring-primary ring-offset-base-200 ring-2 ring-offset-2'
                  : 'hover:opacity-80',
              )}
              style={{
                backgroundColor: isDarkMode ? colors.dark['base-100'] : colors.light['base-100'],
                color: isDarkMode ? colors.dark['base-content'] : colors.light['base-content'],
              }}
            >
              <span className='text-xs font-medium'>{_(label)}</span>
            </button>
          ))}
          <button
            onClick={() => cycleThemeMode()}
            className={clsx(
              'flex flex-shrink-0 flex-col items-center justify-center rounded-lg p-3 transition-all',
              'h-[40px] min-w-[80px]',
              themeMode === 'dark'
                ? 'ring-primary ring-offset-base-200 ring-2 ring-offset-2'
                : 'hover:opacity-80',
            )}
            style={{
              backgroundColor: (themes.find((t) => t.name === themeColor) || themes[0]!).colors
                .dark['base-100'],
              color: (themes.find((t) => t.name === themeColor) || themes[0]!).colors.dark[
                'base-content'
              ],
            }}
          >
            {themeMode === 'light' ? (
              <PiSun size={20} />
            ) : themeMode === 'dark' ? (
              <PiMoon size={20} />
            ) : (
              <TbSunMoon size={20} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
