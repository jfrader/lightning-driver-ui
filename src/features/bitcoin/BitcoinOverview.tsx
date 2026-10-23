import { Alert, Flex } from '@jfrader/ui';
import { useQuery } from '@tanstack/react-query';
import { bitcoinQueryOptions } from '../../api/monitoring';
import { DetailList } from '../../components/DetailList';
import { ErrorNotice } from '../../components/ErrorNotice';
import { Freshness } from '../../components/Freshness';
import { LoadingState } from '../../components/LoadingState';
import { Section } from '../../components/Section';
import { ButtonLink } from '../../components/ButtonLink';
import { WorkLayout } from '../../components/WorkLayout';
import { DISPLAY_LOCALE } from '../../config';
import { NETWORK_LABEL } from '../nodes/labels';
import { useCurrentNode } from '../nodes/use-current-node';
import { numberValue, unitValue } from './format';
import { surfacesFor } from '../shell/nav-model';
import { useControlSize } from '../shell/use-shell-layout';

const BASIS_POINTS_PER_UNIT = 10_000;

export function BitcoinOverview() {
  const size = useControlSize();
  const node = useCurrentNode();
  const query = useQuery(bitcoinQueryOptions(node.id));
  if (query.isPending) return <LoadingState label="Loading Bitcoin node" />;
  if (query.isError)
    return (
      <Section title="Needs attention">
        <ErrorNotice error={query.error} onRetry={() => void query.refetch()} />
      </Section>
    );
  const info = query.data;
  const mismatch = node.network !== info.network;
  const progress = new Intl.NumberFormat(DISPLAY_LOCALE, { style: 'percent', maximumFractionDigits: 2 }).format(
    Number(info.verification_progress_bp) / BASIS_POINTS_PER_UNIT,
  );
  return (
    <WorkLayout
      asideLabel="Node details"
      main={
        <Flex direction="column" gap="lg">
          <Section title="Needs attention">
            <Flex direction="column" gap="sm">
              {mismatch && (
                <Alert tone="danger" title="Network mismatch">
                  Expected {NETWORK_LABEL[node.network]} · Reported {NETWORK_LABEL[info.network]}
                </Alert>
              )}
              {info.warnings.map((warning, index) => (
                <Alert key={`${index}-${warning}`} tone="warning" title={warning} />
              ))}
              {info.stale && <Alert tone="warning" title="Observation is stale" />}
              {node.status.error_code && (
                <Alert tone="warning" title="Observation failed">
                  {node.status.error_code}
                </Alert>
              )}
              {!mismatch && !info.stale && !node.status.error_code && info.warnings.length === 0 && (
                <span>No warnings</span>
              )}
            </Flex>
          </Section>
          <Section title="Chain">
            <DetailList
              items={[
                { label: 'Chain sync', value: info.initial_block_download ? `Syncing · ${progress}` : 'Synced' },
                { label: 'Verification progress', value: progress },
                { label: 'Block height', value: numberValue(info.blocks) },
                { label: 'Headers', value: numberValue(info.headers) },
                { label: 'Initial block download', value: info.initial_block_download ? 'Yes' : 'No' },
              ]}
            />
          </Section>
          <Section
            title="Network"
            action={
              surfacesFor(node).includes('peers') && (
                <ButtonLink variant="ghost" size={size} to="/nodes/$nodeId/peers" params={{ nodeId: node.id }}>
                  View peers
                </ButtonLink>
              )
            }
          >
            <DetailList
              items={[
                { label: 'Peers', value: numberValue(info.connections) },
                { label: 'Inbound', value: numberValue(info.connections_in) },
                { label: 'Outbound', value: numberValue(info.connections_out) },
              ]}
            />
          </Section>
          <Section title="Mempool">
            <DetailList
              items={[
                { label: 'Transactions', value: numberValue(info.mempool.transactions) },
                { label: 'Virtual size', value: unitValue(info.mempool.vsize, 'byte') },
                { label: 'Memory usage', value: unitValue(info.mempool.usage, 'byte') },
              ]}
            />
          </Section>
          <Section title="Storage">
            <DetailList
              items={[
                { label: 'Chain data', value: unitValue(info.size_on_disk, 'byte') },
                { label: 'Pruned', value: info.pruned ? 'Yes' : 'No' },
                { label: 'Prune height', value: numberValue(info.prune_height) },
              ]}
            />
          </Section>
        </Flex>
      }
      aside={
        <Section title="Node details">
          <DetailList
            items={[
              { label: 'Network', value: NETWORK_LABEL[info.network] },
              { label: 'Version', value: numberValue(info.version) },
              { label: 'Subversion', value: info.subversion || 'Not reported' },
              { label: 'Uptime', value: unitValue(info.uptime_seconds, 'second') },
            ]}
          />
          <Freshness observedAt={info.observed_at} stale={info.stale} />
        </Section>
      }
    />
  );
}
