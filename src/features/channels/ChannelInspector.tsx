import type { ReactNode } from 'react';
import { styled } from '@jfrader/ui';
import type { Channel, NodeSummary } from '../../api/types';
import { ButtonLink } from '../../components/ButtonLink';
import { DetailList, type DetailItem } from '../../components/DetailList';
import { Section } from '../../components/Section';
import { Amount, MsatAmount } from '../display/Amount';
import { Identifier } from '../display/Identifier';
import { NotReported } from '../display/NotReported';
import { ShareSwatch } from '../display/ShareSwatch';
import { StateWord } from '../display/StateWord';
import { CapabilityAction } from '../nodes/CapabilityAction';
import { useControlSize } from '../shell/use-shell-layout';
import { CHANNEL_STATE, CLOSE_TYPE, channelName, isClosable } from './labels';
import { channelLiquidity, LIQUIDITY_PARTS, type ChannelLiquidity } from './liquidity';
import { LiquidityBar } from './LiquidityBar';

const Stack = styled.div(({ theme }) => ({ display: 'grid', gap: theme.space[4], minInlineSize: 0 }));

const Keyed = styled.span({ display: 'inline-flex', alignItems: 'center' });

const Mono = styled.span(({ theme }) => ({ fontFamily: theme.font.mono, fontSize: theme.textSize.sm, overflowWrap: 'anywhere' }));

const Note = styled.p(({ theme }) => ({ margin: 0, fontSize: theme.textSize.sm, color: theme.color.textMuted }));

function balanceItems(channel: Channel, liquidity: ChannelLiquidity | null): DetailItem[] {
  const capacity: DetailItem = { label: 'Capacity', numeric: true, value: <Amount value={channel.capacity_sat} unit="sat" /> };
  const spendable: DetailItem = { label: 'Spendable', numeric: true, value: <Amount value={channel.spendable_msat} unit="msat" /> };
  if (!liquidity) {
    return [
      capacity,
      { label: 'Local', numeric: true, value: <Amount value={channel.local_msat} unit="msat" /> },
      { label: 'Remote', numeric: true, value: <Amount value={channel.remote_msat} unit="msat" /> },
      spendable,
    ];
  }
  return [
    capacity,
    ...LIQUIDITY_PARTS.map((part) => ({
      label: part.label,
      numeric: true,
      value: (
        <Keyed>
          <ShareSwatch tone={part.tone} />
          <MsatAmount msat={liquidity[part.id]} />
        </Keyed>
      ),
    })),
    spendable,
  ];
}

interface ChannelInspectorProps {
  /** The selected channel, or `null` when its id is not on the loaded page. */
  channel: Channel | null;
  node: NodeSummary;
  close: ReactNode;
}

/** One channel: the same numbers as its row, plus spendable, identifiers and the close entry. */
export function ChannelInspector({ channel, node, close }: ChannelInspectorProps) {
  const size = useControlSize();
  if (!channel) {
    return (
      <Section title="Channel" action={close}>
        <Note>This channel is not on the loaded page.</Note>
      </Section>
    );
  }
  const liquidity = channelLiquidity(channel);
  const name = channelName(channel);
  const identity: DetailItem[] = [
    { label: 'State', value: <StateWord state={CHANNEL_STATE[channel.state]} /> },
    {
      label: 'Visibility',
      value: channel.private === null ? <NotReported /> : channel.private ? 'Private' : 'Public',
    },
    { label: 'Short channel ID', value: channel.short_channel_id ? <Mono>{channel.short_channel_id}</Mono> : <NotReported /> },
    { label: 'Channel ID', value: <Mono>{channel.id}</Mono> },
    ...(channel.close_type === null ? [] : [{ label: 'Close type', value: CLOSE_TYPE[channel.close_type] }]),
    { label: 'Peer', stacked: true, value: <Identifier value={channel.peer_pubkey} label="Peer" /> },
    {
      label: 'Funding outpoint',
      stacked: true,
      value: channel.funding_outpoint ? <Identifier value={channel.funding_outpoint} label="Funding outpoint" /> : <NotReported />,
    },
    { label: 'Node state', value: <Mono>{channel.backend_state}</Mono> },
  ];
  return (
    <Section title={`Channel ${name}`} action={close}>
      <Stack>
        {liquidity ? <LiquidityBar name={name} liquidity={liquidity} size="detail" /> : <NotReported>Balances not reported</NotReported>}
        <DetailList items={balanceItems(channel, liquidity)} />
        <DetailList items={identity} />
        {isClosable(channel) && (
          <CapabilityAction node={node} capability="close_channel">
            <ButtonLink
              to="/nodes/$nodeId/channels/$channelId/close"
              params={{ nodeId: node.id, channelId: channel.id }}
              search
              size={size}
              variant="outline"
              tone="danger"
              style={{ justifySelf: 'start' }}
            >
              Close channel…
            </ButtonLink>
          </CapabilityAction>
        )}
      </Stack>
    </Section>
  );
}
