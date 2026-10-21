import { Flex } from '@jfrader/ui';
import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { peersQueryOptions } from '../../api/node-queries';
import type { NodeSummary, Peer } from '../../api/types';
import { ButtonLink } from '../../components/ButtonLink';
import { CopyValue } from '../../components/CopyValue';
import { PageHeader } from '../../components/PageHeader';
import { PagedList } from '../../components/PagedList';
import type { ResourceColumn } from '../../components/ResourceList';
import { CapabilityAction } from '../nodes/CapabilityAction';
import { useCurrentNode } from '../nodes/use-current-node';
import { DisconnectPeerButton } from './DisconnectPeerButton';

const route = getRouteApi('/_authed/nodes/$nodeId/peers');

function directionLabel(inbound: boolean | null): string {
  if (inbound === null) return 'Not reported';
  return inbound ? 'Inbound' : 'Outbound';
}

function peerColumns(node: NodeSummary): ResourceColumn<Peer>[] {
  return [
    { id: 'pubkey', header: 'Public key', cell: (peer) => <CopyValue value={peer.pubkey} label="Public key" /> },
    { id: 'address', header: 'Address', cell: (peer) => peer.address ?? 'Not reported' },
    { id: 'connected', header: 'Connected', cell: (peer) => (peer.connected ? 'Yes' : 'No') },
    { id: 'direction', header: 'Direction', cell: (peer) => directionLabel(peer.inbound) },
    {
      id: 'actions',
      header: 'Actions',
      cell: (peer) =>
        peer.connected && (
          <CapabilityAction node={node} capability="disconnect_peer">
            <DisconnectPeerButton nodeId={node.id} nodeLabel={node.label} pubkey={peer.pubkey} />
          </CapabilityAction>
        ),
    },
  ];
}

export function PeersPage() {
  const node = useCurrentNode();
  const { cursor } = route.useSearch();
  const navigate = route.useNavigate();
  const peers = useQuery(peersQueryOptions(node.id, { cursor }));
  return (
    <Flex direction="column" gap="md">
      <PageHeader
        title="Peers"
        actions={
          <CapabilityAction node={node} capability="connect_peer">
            <ButtonLink to="/nodes/$nodeId/peers/new" params={{ nodeId: node.id }} tone="accent">
              Connect peer
            </ButtonLink>
          </CapabilityAction>
        }
      />
      <PagedList
        caption="Peers"
        query={peers}
        columns={peerColumns(node)}
        getRowId={(peer) => peer.pubkey}
        emptyTitle="No peers"
        cursor={cursor}
        onCursor={(next) => void navigate({ search: { cursor: next } })}
      />
    </Flex>
  );
}
