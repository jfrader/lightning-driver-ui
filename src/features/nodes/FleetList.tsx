import { Pill } from '@jfrader/ui';
import { useQuery } from '@tanstack/react-query';
import { fleetQueryOptions } from '../../api/node-queries';
import type { NodeSummary } from '../../api/types';
import { Freshness } from '../../components/Freshness';
import { PagedList } from '../../components/PagedList';
import type { ResourceColumn } from '../../components/ResourceList';
import { TextLink } from '../../components/TextLink';
import { formatInteger, parseWireDecimal } from '../../lib/money';
import { BACKEND_LABEL, NETWORK_LABEL, NODE_STATUS, syncLabel } from './labels';

const COLUMNS: readonly ResourceColumn<NodeSummary>[] = [
  {
    id: 'node',
    header: 'Node',
    cell: (node) => (
      <TextLink to="/nodes/$nodeId" params={{ nodeId: node.id }}>
        {node.label}
      </TextLink>
    ),
  },
  { id: 'network', header: 'Network', cell: (node) => NETWORK_LABEL[node.network] },
  {
    id: 'status',
    header: 'Status',
    cell: (node) => <Pill tone={NODE_STATUS[node.status.status].tone}>{NODE_STATUS[node.status.status].label}</Pill>,
  },
  { id: 'sync', header: 'Chain', cell: (node) => syncLabel(node.status.synced_to_chain) },
  { id: 'access', header: 'Access', cell: (node) => (node.read_only ? 'Read-only' : 'Writable') },
  { id: 'backend', header: 'Backend', cell: (node) => BACKEND_LABEL[node.backend] },
  {
    id: 'unresolved',
    header: 'Unresolved',
    numeric: true,
    cell: (node) => formatInteger(parseWireDecimal(node.unresolved_operation_count)),
  },
  {
    id: 'observed',
    header: 'Observed',
    cell: (node) => <Freshness observedAt={node.status.observed_at} stale={node.status.stale} />,
  },
];

interface FleetListProps {
  cursor: string | undefined;
  onPage: (cursor: string | undefined) => void;
}

/** Configured nodes with their own network and status. There is no fleet-wide money total. */
export function FleetList({ cursor, onPage }: FleetListProps) {
  const fleet = useQuery(fleetQueryOptions(cursor));
  return (
    <PagedList
      caption="Nodes"
      query={fleet}
      columns={COLUMNS}
      getRowId={(node) => node.id}
      emptyTitle="No nodes configured on the server"
      cursor={cursor}
      onCursor={onPage}
    />
  );
}
