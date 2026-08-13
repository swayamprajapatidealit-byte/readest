import { useEffect } from 'react';
import { useThemeStore } from '@/store/themeStore';
import { useSettingsStore } from '@/store/settingsStore';
import { applyCustomTheme, Palette } from '@/styles/themes';

type UseThemeProps = {
  appThemeColor?: keyof Palette;
};

export const useTheme = ({ appThemeColor = 'base-100' }: UseThemeProps = {}) => {
  const { settings } = useSettingsStore();
  const isEink = settings?.globalViewSettings?.isEink;
  const isColorEink = settings?.globalViewSettings?.isColorEink;
  const isBwEink = isEink && !isColorEink;
  const highlightOpacity = settings?.globalViewSettings?.highlightOpacity ?? 0.4;
  const { themeColor, isDarkMode, updateAppTheme } = useThemeStore();

  useEffect(() => {
    updateAppTheme(appThemeColor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const customThemes = settings.globalReadSettings?.customThemes ?? [];
    customThemes.forEach((customTheme) => {
      applyCustomTheme(customTheme);
    });
    localStorage.setItem('customThemes', JSON.stringify(customThemes));
  }, [settings.globalReadSettings?.customThemes]);

  useEffect(() => {
    const colorScheme = isDarkMode ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', `${themeColor}-${colorScheme}`);
    document.documentElement.style.setProperty('color-scheme', colorScheme);
    document.documentElement.style.setProperty('--scroll-bg-opacity', isBwEink ? '1.0' : '0.5');
    document.documentElement.style.setProperty(
      '--overlayer-highlight-opacity',
      isBwEink ? '1.0' : String(highlightOpacity),
    );
    document.documentElement.style.setProperty(
      '--overlayer-highlight-blend-mode',
      isBwEink ? 'difference' : isDarkMode ? 'screen' : 'multiply',
    );
    document.documentElement.style.setProperty(
      '--bg-texture-blend-mode',
      isDarkMode ? 'lighten' : 'multiply',
    );
  }, [themeColor, isDarkMode, isBwEink, highlightOpacity]);
};
