import { Flex } from '@jfrader/ui';
import { useQuery } from '@tanstack/react-query';
import { watchtowerServerQueryOptions } from '../../api/monitoring';
import { Identifier } from '../display/Identifier';
import { DetailList } from '../../components/DetailList';
import { ErrorNotice } from '../../components/ErrorNotice';
import { Freshness } from '../../components/Freshness';
import { LoadingState } from '../../components/LoadingState';
import { PageHeader } from '../../components/PageHeader';
import { Section } from '../../components/Section';
import { useCurrentNode } from '../nodes/use-current-node';

export function WatchtowerServerPage() {
  const node = useCurrentNode();
  const query = useQuery(watchtowerServerQueryOptions(node.id));
  if (query.isPending) return <LoadingState label="Loading watchtower server" />;
  if (query.isError) return <ErrorNotice error={query.error} onRetry={() => void query.refetch()} />;
  const info = query.data;
  return (
    <Flex direction="column" gap="lg">
      <PageHeader title="Watchtower server" />
      <Section title="Identity">
        <DetailList
          items={[
            { label: 'Status', value: node.read_availability.watchtower_server.enabled ? 'Serving' : 'Not available' },
            { label: 'Public key', stacked: true, value: <Identifier value={info.pubkey} label="Public key" /> },
          ]}
        />
      </Section>
      <Section title="Listeners">
        {info.listeners.length ? (
          <DetailList items={info.listeners.map((value, index) => ({ label: `Listener ${index + 1}`, value }))} />
        ) : (
          <span>No listeners reported</span>
        )}
      </Section>
      <Section title="URIs">
        {info.uris.length ? (
          <Flex direction="column" gap="sm">
            {info.uris.map((uri) => (
              <Identifier key={uri} value={uri} label="URI" grouped={false} />
            ))}
          </Flex>
        ) : (
          <span>No URIs reported</span>
        )}
      </Section>
      <Freshness observedAt={info.observed_at} stale={info.stale} />
    </Flex>
  );
}
