import { Alert, Flex } from '@jfrader/ui';
import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import {
  watchtowerClientQueryOptions,
  watchtowerTowersQueryOptions,
  watchtowerTowerQueryOptions,
} from '../../api/monitoring';
import { ButtonLink } from '../../components/ButtonLink';
import { DetailList } from '../../components/DetailList';
import { ErrorNotice } from '../../components/ErrorNotice';
import { Freshness } from '../../components/Freshness';
import { InspectorLayout } from '../../components/InspectorLayout';
import { LoadingState } from '../../components/LoadingState';
import { PageHeader } from '../../components/PageHeader';
import { PagedList } from '../../components/PagedList';
import { ROW_PRIMARY_LINK } from '../../components/row-link';
import { Section } from '../../components/Section';
import { TextLink } from '../../components/TextLink';
import { numberValue } from '../display/quantity';
import { Identifier, ShortIdentifier } from '../display/Identifier';
import { useCurrentNode } from '../nodes/use-current-node';
import { useControlSize } from '../shell/use-shell-layout';

const route = getRouteApi('/_authed/nodes/$nodeId/_configured/watchtower');
const POLICY_LABEL = { legacy: 'Legacy', anchor: 'Anchor', taproot: 'Taproot' } as const;

function TowerInspector({ nodeId, pubkey }: { nodeId: string; pubkey: string }) {
  const size = useControlSize();
  const query = useQuery(watchtowerTowerQueryOptions(nodeId, pubkey));
  const hide = (
    <ButtonLink
      size={size}
      from="/nodes/$nodeId/watchtower"
      search={(previous) => ({ ...previous, selected: undefined })}
      variant="ghost"
    >
      Hide
    </ButtonLink>
  );
  if (query.isPending) return <LoadingState label="Loading tower" />;
  if (query.isError)
    return (
      <Section title="Tower" action={hide}>
        <ErrorNotice error={query.error} onRetry={() => void query.refetch()} />
      </Section>
    );
  const tower = query.data;
  return (
    <Section title="Tower" action={hide}>
      <Flex direction="column" gap="md">
        <Identifier value={tower.pubkey} label="Tower public key" />
        <DetailList
          items={tower.addresses.map((address, index) => ({ label: `Address ${index + 1}`, value: address }))}
        />
        {tower.session_info.map((group) => (
          <Section key={group.policy_type} title={`${POLICY_LABEL[group.policy_type]} sessions`}>
            <DetailList
              items={[
                { label: 'Active session candidate', value: group.active_session_candidate ? 'Yes' : 'No' },
                { label: 'Sessions', value: numberValue(group.num_sessions) },
              ]}
            />
            {group.sessions_truncated && <Alert tone="info" title="Sessions truncated" />}
            {group.sessions.map((session) => (
              <DetailList
                key={session.id}
                items={[
                  { label: 'Session ID', value: session.id, stacked: true },
                  { label: 'Backups', value: numberValue(session.num_backups) },
                  { label: 'Pending backups', value: numberValue(session.num_pending_backups) },
                  { label: 'Maximum backups', value: numberValue(session.max_backups) },
                  { label: 'Sweep fee (sat/vB)', value: numberValue(session.sweep_sat_per_vbyte) },
                ]}
              />
            ))}
            {!group.sessions.length && <span>No sessions reported</span>}
          </Section>
        ))}
      </Flex>
    </Section>
  );
}

function Towers({ nodeId }: { nodeId: string }) {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const towers = useQuery(watchtowerTowersQueryOptions(nodeId, search.cursor));
  const open = (pubkey: string) => (
    <TextLink
      from="/nodes/$nodeId/watchtower"
      search={(previous) => ({ ...previous, selected: pubkey })}
      {...ROW_PRIMARY_LINK}
    >
      <ShortIdentifier value={pubkey} />
    </TextLink>
  );
  return (
    <Section title="Towers">
      <InspectorLayout
        inspectorLabel="Selected tower"
        list={
          <PagedList
            caption="Towers"
            query={towers}
            columns={[
              { id: 'pubkey', header: 'Public key', cell: (tower) => open(tower.pubkey) },
              { id: 'addresses', header: 'Addresses', cell: (tower) => tower.addresses.join(', ') || 'Not reported' },
              {
                id: 'sessions',
                header: 'Sessions',
                cell: (tower) =>
                  tower.session_info
                    .map((info) => `${POLICY_LABEL[info.policy_type]}: ${numberValue(info.num_sessions)}`)
                    .join(' · ') || 'Not reported',
              },
            ]}
            getRowId={(tower) => tower.pubkey}
            renderRow={(tower) => (
              <Flex direction="column" gap="xs">
                {open(tower.pubkey)}
                <span>{tower.addresses.join(', ') || 'Not reported'}</span>
              </Flex>
            )}
            emptyTitle="No towers reported."
            cursor={search.cursor}
            onCursor={(cursor) => void navigate({ search: { cursor } })}
          />
        }
        inspector={
          search.selected ? <TowerInspector key={search.selected} nodeId={nodeId} pubkey={search.selected} /> : null
        }
      />
    </Section>
  );
}

export function WatchtowerClientPage() {
  const node = useCurrentNode();
  const query = useQuery(watchtowerClientQueryOptions(node.id));
  return (
    <Flex direction="column" gap="lg">
      <PageHeader title="Watchtower client" />
      {query.isPending ? (
        <LoadingState label="Loading watchtower client" />
      ) : query.isError ? (
        <ErrorNotice error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <>
          <Section title="Backups">
            <DetailList
              items={[
                { label: 'Accepted', value: numberValue(query.data.stats.num_backups) },
                { label: 'Pending', value: numberValue(query.data.stats.num_pending_backups) },
                { label: 'Ineligible', value: numberValue(query.data.stats.num_ineligible_backups) },
                { label: 'Scope', value: 'Since startup' },
              ]}
            />
          </Section>
          <Towers nodeId={node.id} />
          <Section title="Policy">
            {query.data.policies.length ? (
              query.data.policies.map((policy) => (
                <DetailList
                  key={policy.policy_type}
                  items={[
                    { label: 'Policy type', value: POLICY_LABEL[policy.policy_type] },
                    { label: 'Maximum updates', value: numberValue(policy.max_updates) },
                    { label: 'Sweep fee (sat/vB)', value: numberValue(policy.sweep_sat_per_vbyte) },
                  ]}
                />
              ))
            ) : (
              <span>No policy reported</span>
            )}
          </Section>
          <Freshness observedAt={query.data.observed_at} stale={query.data.stale} />
        </>
      )}
    </Flex>
  );
}
