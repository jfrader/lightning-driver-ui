import { Flex } from '@jfrader/ui';
import { useQuery } from '@tanstack/react-query';
import { nodeInfoQueryOptions } from '../../api/node-queries';
import type { NodeSummary } from '../../api/types';
import { CopyValue } from '../../components/CopyValue';
import { DetailList } from '../../components/DetailList';
import { ErrorNotice } from '../../components/ErrorNotice';
import { Freshness } from '../../components/Freshness';
import { LoadingState } from '../../components/LoadingState';
import { Panel } from '../../components/Panel';
import { formatInteger, parseWireDecimal } from '../../lib/money';
import { NETWORK_LABEL, syncLabel } from './labels';

const NOT_REPORTED = 'Not reported';

export function NodeInfoPanel({ node }: { node: NodeSummary }) {
  const info = useQuery(nodeInfoQueryOptions(node.id));
  const { status } = node;
  return (
    <Panel title="Identity and sync">
      <Flex direction="column" gap="md">
        <DetailList
          items={[
            {
              label: 'Public key',
              value: node.identity_pubkey ? <CopyValue value={node.identity_pubkey} label="Public key" /> : 'Not verified',
            },
            { label: 'Network', value: NETWORK_LABEL[node.network] },
            { label: 'Chain', value: syncLabel(status.synced_to_chain) },
            { label: 'Graph', value: syncLabel(status.synced_to_graph) },
            {
              label: 'Block height',
              value: status.block_height === null ? NOT_REPORTED : formatInteger(parseWireDecimal(status.block_height)),
            },
            { label: 'Alias', value: info.data?.alias ?? NOT_REPORTED },
            { label: 'Version', value: info.data?.version ?? NOT_REPORTED },
          ]}
        />
        {info.isPending && <LoadingState label="Loading node info" />}
        {info.isError && <ErrorNotice error={info.error} onRetry={() => void info.refetch()} />}
        {info.data && <Freshness observedAt={info.data.observed_at} stale={info.data.stale} />}
      </Flex>
    </Panel>
  );
}
