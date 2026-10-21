import type { ThemeName } from '@jfrader/ui';
import { THEME_STORAGE_KEY } from '../../config';
import { isKeyOf } from '../../lib/guards';

export const THEME_PREFERENCE_LABEL = { dark: 'Dark', light: 'Light', system: 'System' } as const;

export type ThemePreference = keyof typeof THEME_PREFERENCE_LABEL;

/** First visit, or storage unavailable: the workbench opens dark. */
export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'dark';

export function readThemePreference(): ThemePreference {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isKeyOf(THEME_PREFERENCE_LABEL, value) ? value : DEFAULT_THEME_PREFERENCE;
  } catch {
    return DEFAULT_THEME_PREFERENCE;
  }
}

/** Stored only after an explicit choice. */
export function writeThemePreference(preference: ThemePreference): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage can be unavailable (private mode, quota); the choice then lasts for this page only.
  }
}

export function resolveTheme(preference: ThemePreference, systemPrefersLight: boolean): ThemeName {
  if (preference === 'system') return systemPrefersLight ? 'light' : 'dark';
  return preference;
}
