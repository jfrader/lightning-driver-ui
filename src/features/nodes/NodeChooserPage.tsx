import { Flex } from '@jfrader/ui';
import { lazy, Suspense } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { PageHeader } from '../../components/PageHeader';
import { LoadingState } from '../../components/LoadingState';

const FleetList = lazy(() => import('./FleetList').then((module) => ({ default: module.FleetList })));

const route = getRouteApi('/_authed/');

/** Landing when no remembered node is valid: the operator picks one explicitly. */
export function NodeChooserPage() {
  const { cursor } = route.useSearch();
  const navigate = route.useNavigate();
  return (
    <Flex direction="column" gap="md">
      <PageHeader title="Choose a node" level={1} />
      <Suspense fallback={<LoadingState label="Loading nodes" />}>
        <FleetList cursor={cursor} onPage={(next) => void navigate({ search: { cursor: next } })} />
      </Suspense>
    </Flex>
  );
}
