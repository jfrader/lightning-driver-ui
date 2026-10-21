import type { ReactNode } from 'react';
import { Flex, styled } from '@jfrader/ui';
import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { peersQueryOptions } from '../../api/node-queries';
import type { Peer } from '../../api/types';
import { ButtonLink } from '../../components/ButtonLink';
import { InspectorLayout } from '../../components/InspectorLayout';
import { PageHeader } from '../../components/PageHeader';
import { PagedList } from '../../components/PagedList';
import type { ResourceColumn } from '../../components/ResourceList';
import { ROW_PRIMARY_LINK } from '../../components/row-link';
import { TextLink } from '../../components/TextLink';
import { ShortIdentifier } from '../display/Identifier';
import { NotReported } from '../display/NotReported';
import { StateWord } from '../display/StateWord';
import { CapabilityAction } from '../nodes/CapabilityAction';
import { useCurrentNode } from '../nodes/use-current-node';
import { useControlSize } from '../shell/use-shell-layout';
import { connectionLabel, directionLabel } from './labels';
import { PeerInspector } from './PeerInspector';

const route = getRouteApi('/_authed/nodes/$nodeId/_configured/peers');

const Mono = styled.span(({ theme }) => ({ fontFamily: theme.font.mono, fontSize: theme.textSize.sm, overflowWrap: 'anywhere' }));

const RowBody = styled.div(({ theme }) => ({ display: 'grid', gap: theme.space[1], minInlineSize: 0 }));

const Line = styled.div(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  columnGap: theme.space[3],
  rowGap: theme.space[1],
  minInlineSize: 0,
}));

const Small = styled.span(({ theme }) => ({ fontSize: theme.textSize.xs, color: theme.color.textMuted }));

type Open = (peer: Peer, label: ReactNode) => ReactNode;

function PeerAddress({ peer }: { peer: Peer }) {
  return peer.address ? <Mono>{peer.address}</Mono> : <NotReported>Address not reported</NotReported>;
}

function PeerDirection({ peer }: { peer: Peer }) {
  return <>{directionLabel(peer.inbound) ?? <NotReported />}</>;
}

function columns(open: Open): ResourceColumn<Peer>[] {
  return [
    { id: 'peer', header: 'Peer', cell: (peer) => open(peer, <ShortIdentifier value={peer.pubkey} />) },
    { id: 'connection', header: 'Connection', cell: (peer) => <StateWord state={connectionLabel(peer.connected)} /> },
    { id: 'address', header: 'Address', cell: (peer) => <PeerAddress peer={peer} /> },
    { id: 'direction', header: 'Direction', cell: (peer) => <PeerDirection peer={peer} /> },
  ];
}

/** Phone row: key and connection, address, direction. */
function PeerRow({ peer, open }: { peer: Peer; open: Open }) {
  return (
    <RowBody>
      <Line>
        {open(peer, <ShortIdentifier value={peer.pubkey} />)}
        <StateWord state={connectionLabel(peer.connected)} />
      </Line>
      <PeerAddress peer={peer} />
      <Small>
        <PeerDirection peer={peer} />
      </Small>
    </RowBody>
  );
}

/** Peers of the node; the contract has no alias, latency or channel count for them, so none is shown. */
export function PeersPage() {
  const node = useCurrentNode();
  const size = useControlSize();
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const peers = useQuery(peersQueryOptions(node.id, { cursor: search.cursor }));

  const open: Open = (peer, label) => (
    <TextLink
      from="/nodes/$nodeId/peers"
      search={(previous) => ({ ...previous, selected: peer.pubkey })}
      aria-label={`Open peer ${peer.pubkey.slice(0, 8)}`}
      {...ROW_PRIMARY_LINK}
    >
      {label}
    </TextLink>
  );
  const selected = search.selected ? (peers.data?.items.find((peer) => peer.pubkey === search.selected) ?? null) : undefined;

  const list = (
    <PagedList
      caption="Peers"
      query={peers}
      columns={columns(open)}
      getRowId={(peer) => peer.pubkey}
      renderRow={(peer) => <PeerRow peer={peer} open={open} />}
      emptyTitle="No peers on this node."
      cursor={search.cursor}
      onCursor={(cursor) => void navigate({ search: { cursor } })}
    />
  );

  return (
    <Flex direction="column" gap="md">
      <PageHeader
        title="Peers"
        actions={
          <CapabilityAction node={node} capability="connect_peer">
            <ButtonLink to="/nodes/$nodeId/peers/new" params={{ nodeId: node.id }} size={size} tone="accent" variant="solid">
              Connect peer
            </ButtonLink>
          </CapabilityAction>
        }
      />
      <InspectorLayout
        list={list}
        inspectorLabel="Selected peer"
        inspector={
          selected === undefined || peers.isPending ? null : (
            <PeerInspector
              peer={selected}
              node={node}
              close={
                <ButtonLink
                  variant="ghost"
                  size={size}
                  from="/nodes/$nodeId/peers"
                  search={(previous) => ({ ...previous, selected: undefined })}
                >
                  Hide
                </ButtonLink>
              }
            />
          )
        }
      />
    </Flex>
  );
}
