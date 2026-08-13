import type { ThemeMode } from '@/styles/themes';

/**
 * Resolve effective dark mode from theme mode and system flags.
 *
 * Receives:
 * - mode: ThemeMode.
 * - systemIsDarkMode: OS appearance when mode is auto.
 *
 * Returns:
 * - whether the UI and reader should render as dark.
 */
export function resolveThemeIsDarkMode(mode: ThemeMode, systemIsDarkMode: boolean): boolean {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return systemIsDarkMode;
}

const THEME_MODES: ThemeMode[] = ['auto', 'light', 'dark'];

/**
 * Cycle Auto → Light → Dark → Auto.
 *
 * Receives:
 * - current: active ThemeMode.
 *
 * Returns:
 * - the next ThemeMode in the cycle.
 */
export function nextThemeMode(current: ThemeMode): ThemeMode {
  const idx = THEME_MODES.indexOf(current);
  const nextIdx = idx < 0 ? 0 : (idx + 1) % THEME_MODES.length;
  return THEME_MODES[nextIdx] ?? 'auto';
}

export function isValidThemeMode(value: string | null): value is ThemeMode {
  return value === 'auto' || value === 'light' || value === 'dark';
}
