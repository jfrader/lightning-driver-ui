import type { ReactNode } from 'react';
import { Flex, styled } from '@jfrader/ui';
import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { channelsQueryOptions } from '../../api/node-queries';
import type { Channel } from '../../api/types';
import { ButtonLink } from '../../components/ButtonLink';
import { FilterSelect } from '../../components/FilterSelect';
import { PageHeader } from '../../components/PageHeader';
import { PagedList } from '../../components/PagedList';
import type { ResourceColumn } from '../../components/ResourceList';
import { TextLink } from '../../components/TextLink';
import { InspectorLayout } from '../../components/InspectorLayout';
import { Amount } from '../display/Amount';
import { ShortIdentifier } from '../display/Identifier';
import { ShareKey } from '../display/ShareKey';
import { CapabilityAction } from '../nodes/CapabilityAction';
import { useCurrentNode } from '../nodes/use-current-node';
import { useControlSize } from '../shell/use-shell-layout';
import { ChannelLiquidityCell, ChannelStateCell } from './ChannelCells';
import { ChannelInspector } from './ChannelInspector';
import { CHANNEL_STATE, CHANNEL_STATE_LABEL, channelName } from './labels';
import { LIQUIDITY_PARTS } from './liquidity';

const route = getRouteApi('/_authed/nodes/$nodeId/_configured/channels');

const Mono = styled.span(({ theme }) => ({ fontFamily: theme.font.mono, fontSize: theme.textSize.sm }));

const RowBody = styled.div(({ theme }) => ({ display: 'grid', gap: theme.space[2], minInlineSize: 0 }));

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
  gap: '0.4em',
  fontSize: theme.textSize.xs,
  color: theme.color.textMuted,
}));

type Open = (channel: Channel, label: ReactNode) => ReactNode;

function channelColumns(open: Open): ResourceColumn<Channel>[] {
  return [
    { id: 'channel', header: 'Channel', width: '8rem', cell: (channel) => open(channel, <Mono>{channelName(channel)}</Mono>) },
    { id: 'peer', header: 'Peer', width: '9.5rem', cell: (channel) => <ShortIdentifier value={channel.peer_pubkey} /> },
    { id: 'state', header: 'State', width: '9rem', cell: (channel) => <ChannelStateCell channel={channel} /> },
    { id: 'liquidity', header: 'Local / remote', cell: (channel) => <ChannelLiquidityCell channel={channel} /> },
    { id: 'capacity', header: 'Capacity', numeric: true, width: '9rem', cell: (channel) => <Amount value={channel.capacity_sat} unit="sat" /> },
  ];
}

function ChannelRow({ channel, open }: { channel: Channel; open: Open }) {
  return (
    <RowBody>
      <Line>
        {open(channel, <Mono>{channelName(channel)}</Mono>)}
        <ChannelStateCell channel={channel} />
      </Line>
      <ChannelLiquidityCell channel={channel} />
      <Line>
        <ShortIdentifier value={channel.peer_pubkey} />
        <Meta>
          <span>Capacity</span>
          <Amount value={channel.capacity_sat} unit="sat" />
        </Meta>
      </Line>
    </RowBody>
  );
}

/** Channels in the server's order, one bar per channel over its own capacity; the record opens in the inspector. */
export function ChannelsPage() {
  const node = useCurrentNode();
  const size = useControlSize();
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const channels = useQuery(channelsQueryOptions(node.id, { state: search.state, cursor: search.cursor }));

  const open: Open = (channel, label) => (
    <TextLink
      from="/nodes/$nodeId/channels"
      search={(previous) => ({ ...previous, selected: channel.id })}
      aria-label={`Open channel ${channelName(channel)} with ${channel.peer_pubkey.slice(0, 8)}`}
    >
      {label}
    </TextLink>
  );
  const selected = search.selected
    ? (channels.data?.items.find((channel) => channel.id === search.selected) ?? null)
    : undefined;

  const list = (
    <Flex direction="column" gap="md">
      <FilterSelect
        label="State"
        labels={CHANNEL_STATE_LABEL}
        value={search.state}
        onChange={(state) => void navigate({ search: { state } })}
      />
      <ShareKey label="Liquidity key" items={LIQUIDITY_PARTS} />
      <PagedList
        caption="Channels"
        query={channels}
        columns={channelColumns(open)}
        getRowId={(channel) => channel.id}
        renderRow={(channel) => <ChannelRow channel={channel} open={open} />}
        emptyTitle={search.state ? `No channels in state ${CHANNEL_STATE[search.state].label}.` : 'No channels on this node.'}
        cursor={search.cursor}
        onCursor={(cursor) => void navigate({ search: (previous) => ({ ...previous, cursor, selected: undefined }) })}
      />
    </Flex>
  );

  return (
    <Flex direction="column" gap="md">
      <PageHeader
        title="Channels"
        actions={
          <CapabilityAction node={node} capability="open_channel">
            <ButtonLink to="/nodes/$nodeId/channels/new" params={{ nodeId: node.id }} size={size} variant="outline">
              Open channel…
            </ButtonLink>
          </CapabilityAction>
        }
      />
      <InspectorLayout
        list={list}
        inspectorLabel="Selected channel"
        inspector={
          selected === undefined || channels.isPending ? null : (
            <ChannelInspector
              channel={selected}
              node={node}
              close={
                <TextLink from="/nodes/$nodeId/channels" search={(previous) => ({ ...previous, selected: undefined })}>
                  Hide
                </TextLink>
              }
            />
          )
        }
      />
    </Flex>
  );
}
