import type { ReactNode } from 'react';
import { Outlet } from '@tanstack/react-router';

export function OperationListLayout({ children }: { children: ReactNode }) {
  return <>{children}<Outlet /></>;
}
