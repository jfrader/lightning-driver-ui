import type { Channel, ChannelState } from '../../api/types';

export const CHANNEL_STATE: Record<ChannelState, string> = {
  opening: 'Opening',
  active: 'Active',
  inactive: 'Inactive',
  closing: 'Closing',
  closed: 'Closed',
  unknown: 'Unknown',
};

const CLOSABLE: ReadonlySet<ChannelState> = new Set(['active', 'inactive']);

export function isClosable(channel: Channel): boolean {
  return CLOSABLE.has(channel.state);
}

export const CLOSE_TYPE: Record<NonNullable<Channel['close_type']>, string> = {
  cooperative: 'Cooperative',
  unilateral: 'Unilateral (force close)',
  unknown: 'Not determined',
};
