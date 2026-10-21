import { Flex } from '@jfrader/ui';
import { useQuery } from '@tanstack/react-query';
import { balancesQueryOptions } from '../../api/node-queries';
import { DetailList } from '../../components/DetailList';
import { ErrorNotice } from '../../components/ErrorNotice';
import { Freshness } from '../../components/Freshness';
import { LoadingState } from '../../components/LoadingState';
import { Panel } from '../../components/Panel';
import { Amount } from '../display/Amount';

/** Balances of one node. Missing measurements read "Unavailable"; spendable is not ownership. */
export function BalancesPanel({ nodeId }: { nodeId: string }) {
  const balances = useQuery(balancesQueryOptions(nodeId));
  return (
    <Panel title="Balances">
      {balances.isPending && <LoadingState label="Loading balances" />}
      {balances.isError && <ErrorNotice error={balances.error} onRetry={() => void balances.refetch()} />}
      {balances.data && (
        <Flex direction="column" gap="md">
          <DetailList
            items={[
              { label: 'On-chain confirmed', value: <Amount value={balances.data.onchain_confirmed_sat} unit="sat" /> },
              { label: 'On-chain unconfirmed', value: <Amount value={balances.data.onchain_unconfirmed_sat} unit="sat" /> },
              { label: 'On-chain spendable', value: <Amount value={balances.data.onchain_spendable_sat} unit="sat" /> },
              { label: 'Channels local', value: <Amount value={balances.data.channel_local_msat} unit="msat" /> },
              { label: 'Channels remote', value: <Amount value={balances.data.channel_remote_msat} unit="msat" /> },
              { label: 'Channels spendable', value: <Amount value={balances.data.channel_spendable_msat} unit="msat" /> },
            ]}
          />
          <Freshness observedAt={balances.data.observed_at} stale={balances.data.stale} />
        </Flex>
      )}
    </Panel>
  );
}
