import type { Channel, ChannelState } from '../../api/types';
import { labelsOf } from '../display/state-labels';
import type { StateLabel } from '../display/StateWord';

export const CHANNEL_STATE: Record<ChannelState, StateLabel> = {
  opening: { label: 'Opening', tone: 'info' },
  active: { label: 'Active', tone: 'quiet' },
  inactive: { label: 'Inactive', tone: 'warning' },
  closing: { label: 'Closing', tone: 'info' },
  closed: { label: 'Closed', tone: 'quiet' },
  unknown: { label: 'State unknown', tone: 'warning' },
};

/** Filter labels, from the same vocabulary. */
export const CHANNEL_STATE_LABEL = labelsOf(CHANNEL_STATE);

const CLOSABLE: ReadonlySet<ChannelState> = new Set(['active', 'inactive']);

/** Only active and inactive channels offer a cooperative close. */
export function isClosable(channel: Channel): boolean {
  return CLOSABLE.has(channel.state);
}

/** A channel's short name: its short channel id, or `Pending` before it has one. */
export function channelName(channel: Channel): string {
  return channel.short_channel_id ?? 'Pending';
}

export const CLOSE_TYPE: Record<NonNullable<Channel['close_type']>, string> = {
  cooperative: 'Cooperative',
  unilateral: 'Unilateral (force close)',
  unknown: 'Not determined',
};
