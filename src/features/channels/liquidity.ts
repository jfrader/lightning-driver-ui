import type { Channel } from '../../api/types';
import type { ChartTone } from '../appearance/appearance-context';
import { wireToMsat } from '../../lib/money';

export interface ChannelLiquidity {
  capacity: bigint;
  local: bigint;
  remote: bigint;
  /** Capacity in neither balance (commitment fees, reserves, in-flight): `capacity − local − remote`, at least 0. */
  remainder: bigint;
}

/**
 * Exact channel split in msat, or `null` while the node reports no balances (e.g. an opening
 * channel). The remainder is never folded into either side, and never negative.
 */
export function channelLiquidity(channel: Channel): ChannelLiquidity | null {
  if (channel.local_msat === null || channel.remote_msat === null || channel.capacity_sat === null) return null;
  const capacity = wireToMsat(channel.capacity_sat, 'sat');
  const local = wireToMsat(channel.local_msat, 'msat');
  const remote = wireToMsat(channel.remote_msat, 'msat');
  const remainder = capacity - local - remote;
  return { capacity, local, remote, remainder: remainder > 0n ? remainder : 0n };
}

/** Segment order, words and tones shared by every liquidity bar and the one key above the list. */
export const LIQUIDITY_PARTS: readonly { id: 'local' | 'remote' | 'remainder'; label: string; tone: ChartTone }[] = [
  { id: 'local', label: 'Local', tone: 'primary' },
  { id: 'remote', label: 'Remote', tone: 'secondary' },
  { id: 'remainder', label: 'In neither balance', tone: 'remainder' },
];
