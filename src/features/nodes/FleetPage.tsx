import { Flex } from '@jfrader/ui';
import { getRouteApi } from '@tanstack/react-router';
import { PageHeader } from '../../components/PageHeader';
import { FleetList } from './FleetList';

const route = getRouteApi('/_authed/fleet');

export function FleetPage() {
  const { cursor } = route.useSearch();
  const navigate = route.useNavigate();
  return (
    <Flex direction="column" gap="md">
      <PageHeader title="Fleet" level={1} />
      <FleetList cursor={cursor} onPage={(next) => void navigate({ search: { cursor: next } })} />
    </Flex>
  );
}
