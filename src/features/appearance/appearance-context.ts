import { createContext, useContext } from 'react';
import type { ThemePreference } from './theme-preference';

interface AppearanceContextValue {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

export const AppearanceContext = createContext<AppearanceContextValue | null>(null);

/** The operator's Dark/Light/System choice. Presentation only; it never touches session or node data. */
export function useAppearance(): AppearanceContextValue {
  const value = useContext(AppearanceContext);
  if (!value) throw new Error('useAppearance needs an AppearanceProvider');
  return value;
}
