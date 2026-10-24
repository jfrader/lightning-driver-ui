import { Outlet } from '@tanstack/react-router';
import { PaymentsPage } from './PaymentsPage';

export function PaymentsLayout() {
  return <><PaymentsPage /><Outlet /></>;
}
