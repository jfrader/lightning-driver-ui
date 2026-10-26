import { Flex } from '@jfrader/ui';
import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { bitcoinPeersQueryOptions } from '../../api/monitoring';
import type { components } from '../../api/generated/schema';
import { ButtonLink } from '../../components/ButtonLink';
import { DetailList } from '../../components/DetailList';
import { InspectorLayout } from '../../components/InspectorLayout';
import { PageHeader } from '../../components/PageHeader';
import { PagedList } from '../../components/PagedList';
import { ROW_PRIMARY_LINK } from '../../components/row-link';
import { Section } from '../../components/Section';
import { TextLink } from '../../components/TextLink';
import { UtcTime } from '../../components/UtcTime';
import { ShortIdentifier } from '../display/Identifier';
import { useCurrentNode } from '../nodes/use-current-node';
import { useControlSize } from '../shell/use-shell-layout';
import { numberValue, unitValue } from '../display/quantity';

type Peer = components['schemas']['BitcoinPeer'];
const route = getRouteApi('/_authed/nodes/$nodeId/_configured/peers');

function PeerDetails({ peer }: { peer: Peer }) {
  return (
    <DetailList
      items={[
        { label: 'Address', value: peer.addr || 'Not reported' },
        { label: 'Transport', value: peer.network },
        { label: 'Direction', value: peer.inbound ? 'Inbound' : 'Outbound' },
        { label: 'Connection type', value: peer.connection_type || 'Not reported' },
        { label: 'Version', value: numberValue(peer.version) },
        { label: 'Subversion', value: peer.subversion || 'Not reported' },
        { label: 'Ping', value: unitValue(peer.ping_ms, 'millisecond') },
        { label: 'Connected since', value: <UtcTime value={peer.connected_at} /> },
        { label: 'Bytes sent', value: unitValue(peer.bytes_sent, 'byte') },
        { label: 'Bytes received', value: unitValue(peer.bytes_received, 'byte') },
        { label: 'Synced headers', value: numberValue(peer.synced_headers) },
        { label: 'Synced blocks', value: numberValue(peer.synced_blocks) },
      ]}
    />
  );
}

export function BitcoinPeersPage() {
  const size = useControlSize();
  const node = useCurrentNode();
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const peers = useQuery(bitcoinPeersQueryOptions(node.id, search.cursor));
  const open = (peer: Peer) => (
    <TextLink
      from="/nodes/$nodeId/peers"
      search={(previous) => ({ ...previous, selected: peer.id })}
      {...ROW_PRIMARY_LINK}
      resetScroll={false}
    >
      <ShortIdentifier value={peer.addr || `Peer ${peer.id}`} />
    </TextLink>
  );
  const selected = peers.data?.items.find((peer) => peer.id === search.selected);
  return (
    <Flex direction="column" gap="md">
      <InspectorLayout
        header={<PageHeader title="Peers" />}
        inspectorLabel="Selected Bitcoin peer"
        list={
          <PagedList
            caption="Bitcoin peers"
            query={peers}
            columns={[
              { id: 'address', header: 'Address', cell: open },
              { id: 'direction', header: 'Direction', cell: (peer) => (peer.inbound ? 'Inbound' : 'Outbound') },
              { id: 'connection', header: 'Connection type', cell: (peer) => peer.connection_type || 'Not reported' },
              { id: 'ping', header: 'Ping', cell: (peer) => unitValue(peer.ping_ms, 'millisecond') },
            ]}
            getRowId={(peer) => peer.id}
            renderRow={(peer) => (
              <Flex direction="column" gap="xs">
                {open(peer)}
                <span>
                  {peer.inbound ? 'Inbound' : 'Outbound'} · {peer.connection_type}
                </span>
              </Flex>
            )}
            emptyTitle="No peers on this node."
            cursor={search.cursor}
            onCursor={(cursor) => void navigate({ search: { cursor } })}
          />
        }
        inspector={
          search.selected && !peers.isPending ? (
            <Section
              title="Peer"
              action={
                <ButtonLink
                  size={size}
                  from="/nodes/$nodeId/peers"
                  search={(previous) => ({ ...previous, selected: undefined })}
                  resetScroll={false}
                  variant="ghost"
                >
                  Hide
                </ButtonLink>
              }
            >
              {selected ? <PeerDetails peer={selected} /> : <span>Peer not found on this page.</span>}
            </Section>
          ) : null
        }
      />
    </Flex>
  );
}
