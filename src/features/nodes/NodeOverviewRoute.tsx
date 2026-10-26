import { Suspense } from 'react';
import { NodeOverviewPage } from '../../app/lazy-screens';
import { RoutePending } from '../../components/RoutePending';

export function NodeOverviewRoute() {
  return <Suspense fallback={<RoutePending />}><NodeOverviewPage /></Suspense>;
}
