import type { ReactNode } from 'react';
import { Flex, styled } from '@jfrader/ui';
import type { NodeSummary, Peer } from '../../api/types';
import { ButtonLink } from '../../components/ButtonLink';
import { DetailList } from '../../components/DetailList';
import { Section } from '../../components/Section';
import { Identifier } from '../display/Identifier';
import { NotReported } from '../display/NotReported';
import { StateWord } from '../display/StateWord';
import { CapabilityAction } from '../nodes/CapabilityAction';
import { useControlSize } from '../shell/use-shell-layout';
import { DisconnectPeerButton } from './DisconnectPeerButton';
import { connectionLabel, directionLabel } from './labels';

const Stack = styled.div(({ theme }) => ({ display: 'grid', gap: theme.space[4], minInlineSize: 0 }));

const Note = styled.p(({ theme }) => ({ margin: 0, fontSize: theme.textSize.sm, color: theme.color.textMuted }));

interface PeerInspectorProps {
  /** The selected peer, or `null` when its key is not on the loaded page. */
  peer: Peer | null;
  node: NodeSummary;
  close: ReactNode;
}

/** One peer: full key and address with copy, and the channel and disconnect entries while it is connected. */
export function PeerInspector({ peer, node, close }: PeerInspectorProps) {
  const size = useControlSize();
  if (!peer) {
    return (
      <Section title="Peer" action={close}>
        <Note>This peer is not on the loaded page.</Note>
      </Section>
    );
  }
  const direction = directionLabel(peer.inbound);
  return (
    <Section title="Peer" action={close}>
      <Stack>
        <DetailList
          items={[
            { label: 'Peer', stacked: true, value: <Identifier value={peer.pubkey} label="Peer" /> },
            { label: 'Connection', value: <StateWord state={connectionLabel(peer.connected)} /> },
            {
              label: 'Address',
              stacked: true,
              value: peer.address ? <Identifier value={peer.address} label="Address" grouped={false} /> : <NotReported />,
            },
            { label: 'Direction', value: direction ?? <NotReported /> },
          ]}
        />
        {peer.connected && (
          <Flex wrap gap="sm" align="start">
            <CapabilityAction node={node} capability="open_channel">
              <ButtonLink to="/nodes/$nodeId/channels/new" params={{ nodeId: node.id }} size={size} variant="outline">
                Open channel…
              </ButtonLink>
            </CapabilityAction>
            <CapabilityAction node={node} capability="disconnect_peer">
              <DisconnectPeerButton nodeId={node.id} nodeLabel={node.label} pubkey={peer.pubkey} />
            </CapabilityAction>
          </Flex>
        )}
      </Stack>
    </Section>
  );
}
