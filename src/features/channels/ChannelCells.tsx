import { styled } from '@jfrader/ui';
import type { Channel } from '../../api/types';
import { MsatAmount } from '../display/Amount';
import { NotReported } from '../display/NotReported';
import { StateWord } from '../display/StateWord';
import { CHANNEL_STATE, channelName } from './labels';
import { channelLiquidity } from './liquidity';
import { LiquidityBar } from './LiquidityBar';

/** A floor width so an auto-layout table cell never collapses the chart to zero. */
const Cell = styled.div(({ theme }) => ({ display: 'grid', gap: theme.space[1], minInlineSize: '10rem' }));

const Split = styled.div(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'space-between',
  columnGap: theme.space[3],
  fontSize: theme.textSize.xs,
}));

const Remote = styled.span(({ theme }) => ({ color: theme.color.textMuted }));

const Flag = styled.span(({ theme }) => ({ fontSize: theme.textSize.xs, color: theme.color.textMuted }));

/** The bar plus the exact local (left) and remote (right) amounts it draws. */
export function ChannelLiquidityCell({ channel }: { channel: Channel }) {
  const liquidity = channelLiquidity(channel);
  if (!liquidity) return <NotReported>Balances not reported</NotReported>;
  return (
    <Cell>
      <LiquidityBar name={channelName(channel)} liquidity={liquidity} />
      <Split>
        <MsatAmount msat={liquidity.local} />
        <Remote>
          <MsatAmount msat={liquidity.remote} />
        </Remote>
      </Split>
    </Cell>
  );
}

/** State word, plus the private flag when the node reports one. */
export function ChannelStateCell({ channel }: { channel: Channel }) {
  return (
    <span>
      <StateWord state={CHANNEL_STATE[channel.state]} />
      {channel.private && <Flag> · private</Flag>}
    </span>
  );
}
