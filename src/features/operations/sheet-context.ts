import { createContext, useContext } from 'react';
import type { Operation } from '../../api/types';

interface OperationSheetContextValue {
  onCreated: (operation: Operation, unanswered?: boolean) => void;
  onUnanswered: () => void;
  discard: () => void;
}

export const OperationSheetContext = createContext<OperationSheetContextValue | null>(null);
export const useOperationSheet = () => useContext(OperationSheetContext);
