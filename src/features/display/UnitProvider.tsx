import { useMemo, useState, type ReactNode } from 'react';
import type { DisplayUnit } from '../../lib/money';
import { UnitContext } from './unit-context';

export function UnitProvider({ children }: { children: ReactNode }) {
  const [unit, setUnit] = useState<DisplayUnit>('sat');
  const value = useMemo(() => ({ unit, setUnit }), [unit]);
  return <UnitContext value={value}>{children}</UnitContext>;
}
