import type { StateLabel } from '../display/StateWord';

/** Connection words (screens spec §3.2): a disconnected peer needs a look, a connected one does not. */
export function connectionLabel(connected: boolean): StateLabel {
  return connected ? { label: 'Connected', tone: 'quiet' } : { label: 'Disconnected', tone: 'warning' };
}

/** Who opened the connection; `null` when the node does not report it. */
export function directionLabel(inbound: boolean | null): string | null {
  if (inbound === null) return null;
  return inbound ? 'Inbound' : 'Outbound';
}
