import { Pill, styled } from '@jfrader/ui';
import { useQuery } from '@tanstack/react-query';
import { fleetQueryOptions } from '../../api/node-queries';
import type { NodeSummary } from '../../api/types';
import { ListTime } from '../../components/ListTime';
import { PagedList } from '../../components/PagedList';
import type { ResourceColumn } from '../../components/ResourceList';
import { ROW_PRIMARY_LINK } from '../../components/row-link';
import { TextLink } from '../../components/TextLink';
import { formatInteger, parseWireDecimal } from '../../lib/money';
import { useNow } from '../../lib/use-now';
import { NotReported } from '../display/NotReported';
import { StateWord } from '../display/StateWord';
import { BACKEND_LABEL, NETWORK_LABEL, NODE_STATUS, capabilitySummary, syncLabel, accessLabel } from './labels';

const NodeName = styled.span(({ theme }) => ({ display: 'grid', gap: theme.space[1], minInlineSize: 0 }));

const Id = styled.span(({ theme }) => ({
  fontFamily: theme.font.mono,
  fontSize: theme.textSize.xs,
  color: theme.color.textMuted,
}));

const Muted = styled.span(({ theme }) => ({ color: theme.color.textMuted, fontFamily: theme.font.mono }));

const Count = styled.span(({ theme }) => ({ color: theme.color.warning, fontFamily: theme.font.mono }));

const RowBody = styled.div(({ theme }) => ({ display: 'grid', gap: theme.space[1], minInlineSize: 0 }));

const Line = styled.div(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  columnGap: theme.space[3],
  rowGap: theme.space[1],
  minInlineSize: 0,
}));

const Meta = styled.span(({ theme }) => ({
  display: 'inline-flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: theme.space[2],
  fontSize: theme.textSize.xs,
  color: theme.color.textMuted,
}));

function NodeLink({ node }: { node: NodeSummary }) {
  return (
    <TextLink to="/nodes/$nodeId" params={{ nodeId: node.id }} {...ROW_PRIMARY_LINK}>
      {node.label}
    </TextLink>
  );
}

function NetworkPill({ node }: { node: NodeSummary }) {
  return <Pill tone={node.network === 'unknown' ? 'warning' : 'neutral'}>{NETWORK_LABEL[node.network]}</Pill>;
}

/** Observation time and age; `Stale` when it is a cached observation; `Never observed` when none. */
function Observed({ node, now }: { node: NodeSummary; now: number }) {
  const { observed_at: at, stale } = node.status;
  if (at === null) return <NotReported>Never observed</NotReported>;
  return (
    <Meta>
      {stale && <Pill tone="warning">Stale</Pill>}
      <ListTime at={at} now={now} />
    </Meta>
  );
}

/** Unresolved operations of one node; links to them when there are any. Never summed across nodes. */
function Unresolved({ node }: { node: NodeSummary }) {
  if (node.kind === 'bitcoin') return <>—</>;
  const count = parseWireDecimal(node.unresolved_operation_count);
  if (count === 0n) return <Muted>0</Muted>;
  return (
    <TextLink to="/nodes/$nodeId/operations" params={{ nodeId: node.id }} search={{ state: 'nonterminal' }}>
      <Count>{formatInteger(count)}</Count> unresolved
    </TextLink>
  );
}

function columns(now: number): ResourceColumn<NodeSummary>[] {
  return [
    {
      id: 'node',
      header: 'Node',
      cell: (node) => (
        <NodeName>
          <NodeLink node={node} />
          <Id>{node.id}</Id>
        </NodeName>
      ),
    },
    { id: 'backend', header: 'Backend', cell: (node) => BACKEND_LABEL[node.backend] },
    { id: 'network', header: 'Network', cell: (node) => <NetworkPill node={node} /> },
    { id: 'status', header: 'Status', cell: (node) => <StateWord state={NODE_STATUS[node.status.status]} /> },
    { id: 'sync', header: 'Chain sync', cell: (node) => syncLabel(node.status.synced_to_chain) },
    { id: 'observed', header: 'Observed', cell: (node) => <Observed node={node} now={now} /> },
    { id: 'access', header: 'Access', cell: accessLabel },
    { id: 'actions', header: 'Actions', cell: (node) => capabilitySummary(node) },
    { id: 'unresolved', header: 'Unresolved', numeric: true, cell: (node) => <Unresolved node={node} /> },
  ];
}

/** Phone row: label and status, network · backend · access, observed time and unresolved count. */
function FleetRow({ node, now }: { node: NodeSummary; now: number }) {
  return (
    <RowBody>
      <Line>
        <NodeLink node={node} />
        <StateWord state={NODE_STATUS[node.status.status]} />
      </Line>
      <Meta>
        <NetworkPill node={node} />
        <span>{BACKEND_LABEL[node.backend]}</span>
        <span>{accessLabel(node)}</span>
      </Meta>
      <Line>
        <Observed node={node} now={now} />
        {node.unresolved_operation_count !== '0' && <Unresolved node={node} />}
      </Line>
      {node.kind === 'bitcoin' && (
        <Meta>
          <span>Actions None</span>
          <span>Unresolved —</span>
        </Meta>
      )}
    </RowBody>
  );
}

interface FleetListProps {
  cursor: string | undefined;
  onPage: (cursor: string | undefined) => void;
}

/**
 * Every configured node with its own network, status and access. Each row opens that node. There is
 * no fleet-wide money total and no combined activity: nodes are never summed.
 */
export function FleetList({ cursor, onPage }: FleetListProps) {
  const now = useNow();
  const fleet = useQuery(fleetQueryOptions(cursor));
  return (
    <PagedList
      caption="Nodes"
      query={fleet}
      columns={columns(now)}
      getRowId={(node) => node.id}
      renderRow={(node) => <FleetRow node={node} now={now} />}
      emptyTitle="No nodes are configured on this server."
      cursor={cursor}
      onCursor={onPage}
    />
  );
}
