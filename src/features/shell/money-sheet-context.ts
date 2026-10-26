import { createContext } from 'react';
import type { useOverlayEntry } from './use-overlay-entry';

export const MoneySheetContext = createContext<ReturnType<typeof useOverlayEntry> | null>(null);
