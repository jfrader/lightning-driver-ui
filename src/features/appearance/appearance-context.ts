import { createContext, useContext } from 'react';
import type { ThemeName } from '@jfrader/ui';
import { AMBER } from './palette';
import type { ThemePreference } from './theme-preference';

interface AppearanceContextValue {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  /** The theme in effect after resolving System. */
  theme: ThemeName;
}

export const AppearanceContext = createContext<AppearanceContextValue | null>(null);

/** The operator's Dark/Light/System choice. Presentation only; it never touches session or node data. */
export function useAppearance(): AppearanceContextValue {
  const value = useContext(AppearanceContext);
  if (!value) throw new Error('useAppearance needs an AppearanceProvider');
  return value;
}

/** Composition chart colours, resolved for the active theme (SVG attributes cannot read CSS variables). */
export function useChartColors() {
  const color = AMBER[useAppearance().theme];
  return { primary: color.accent, secondary: color.textSubtle, remainder: color.borderControl, separator: color.surface };
}

export type ChartTone = keyof ReturnType<typeof useChartColors>;
