import { Flex } from '@jfrader/ui';
import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { channelsQueryOptions } from '../../api/node-queries';
import type { Channel, NodeSummary } from '../../api/types';
import { ButtonLink } from '../../components/ButtonLink';
import { CopyValue } from '../../components/CopyValue';
import { FilterSelect } from '../../components/FilterSelect';
import { PageHeader } from '../../components/PageHeader';
import { PagedList } from '../../components/PagedList';
import type { ResourceColumn } from '../../components/ResourceList';
import { Amount } from '../display/Amount';
import { CapabilityAction } from '../nodes/CapabilityAction';
import { useCurrentNode } from '../nodes/use-current-node';
import { CHANNEL_STATE, CLOSE_TYPE, isClosable } from './labels';

const route = getRouteApi('/_authed/nodes/$nodeId/channels');

function channelColumns(node: NodeSummary): ResourceColumn<Channel>[] {
  return [
    { id: 'peer', header: 'Peer', cell: (channel) => <CopyValue value={channel.peer_pubkey} label="Peer" /> },
    { id: 'state', header: 'State', cell: (channel) => CHANNEL_STATE[channel.state] },
    { id: 'capacity', header: 'Capacity', numeric: true, cell: (channel) => <Amount value={channel.capacity_sat} unit="sat" /> },
    { id: 'local', header: 'Local', numeric: true, cell: (channel) => <Amount value={channel.local_msat} unit="msat" /> },
    { id: 'remote', header: 'Remote', numeric: true, cell: (channel) => <Amount value={channel.remote_msat} unit="msat" /> },
    { id: 'id', header: 'Channel', cell: (channel) => channel.short_channel_id ?? channel.id },
    {
      id: 'close',
      header: 'Close type',
      cell: (channel) => (channel.close_type === null ? '—' : CLOSE_TYPE[channel.close_type]),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (channel) =>
        isClosable(channel) && (
          <CapabilityAction node={node} capability="close_channel">
            <ButtonLink
              to="/nodes/$nodeId/channels/$channelId/close"
              params={{ nodeId: node.id, channelId: channel.id }}
              size="sm"
              variant="outline"
              tone="danger"
            >
              Close
            </ButtonLink>
          </CapabilityAction>
        ),
    },
  ];
}

export function ChannelsPage() {
  const node = useCurrentNode();
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const channels = useQuery(channelsQueryOptions(node.id, { state: search.state, cursor: search.cursor }));
  return (
    <Flex direction="column" gap="md">
      <PageHeader
        title="Channels"
        actions={
          <CapabilityAction node={node} capability="open_channel">
            <ButtonLink to="/nodes/$nodeId/channels/new" params={{ nodeId: node.id }} tone="accent">
              Open channel
            </ButtonLink>
          </CapabilityAction>
        }
      />
      <FilterSelect
        label="State"
        labels={CHANNEL_STATE}
        value={search.state}
        onChange={(state) => void navigate({ search: { state } })}
      />
      <PagedList
        caption="Channels"
        query={channels}
        columns={channelColumns(node)}
        getRowId={(channel) => channel.id}
        emptyTitle="No channels"
        cursor={search.cursor}
        onCursor={(cursor) => void navigate({ search: (previous) => ({ ...previous, cursor }) })}
      />
    </Flex>
  );
}
