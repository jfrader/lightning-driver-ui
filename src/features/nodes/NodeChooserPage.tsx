import { Flex } from '@jfrader/ui';
import { getRouteApi } from '@tanstack/react-router';
import { PageHeader } from '../../components/PageHeader';
import { FleetList } from './FleetList';

const route = getRouteApi('/_authed/');

/** Landing when no remembered node is valid: the operator picks one explicitly. */
export function NodeChooserPage() {
  const { cursor } = route.useSearch();
  const navigate = route.useNavigate();
  return (
    <Flex direction="column" gap="md">
      <PageHeader title="Choose a node" />
      <FleetList cursor={cursor} onPage={(next) => void navigate({ search: { cursor: next } })} />
    </Flex>
  );
}
