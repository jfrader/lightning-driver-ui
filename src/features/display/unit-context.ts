import { createContext, useContext } from 'react';
import type { DisplayUnit } from '../../lib/money';

interface UnitContextValue {
  unit: DisplayUnit;
  setUnit: (unit: DisplayUnit) => void;
}

export const UnitContext = createContext<UnitContextValue | null>(null);

/** Session-only sats/BTC display choice. Presentation only; amounts stay exact. */
export function useDisplayUnit(): UnitContextValue {
  const value = useContext(UnitContext);
  if (!value) throw new Error('useDisplayUnit needs a UnitProvider');
  return value;
}
