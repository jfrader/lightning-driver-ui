const PUBKEY_PATTERN = /^(02|03)[0-9a-f]{64}$/;
const MAX_PORT = 65_535;

export function isPubkey(value: string): boolean {
  return PUBKEY_PATTERN.test(value);
}

/** A peer key in the form a person scans: the head and tail, joined by an ellipsis. */
export function shortPubkey(pubkey: string): string {
  return `${pubkey.slice(0, 10)}…${pubkey.slice(-6)}`;
}

/** One peer as a picker option: the key head/tail, its reported address and whether it is connected. */
export function peerChoiceLabel(peer: { pubkey: string; address: string | null; connected: boolean }): string {
  const address = peer.address ?? 'address not reported';
  return `${shortPubkey(peer.pubkey)} · ${address}${peer.connected ? '' : ' · Not connected'}`;
}

/** Port from the canonical value of a whole-number input. */
export function parsePort(input: string): number | null {
  if (!/^[0-9]{1,5}$/.test(input)) return null;
  const port = Number(input);
  return port >= 1 && port <= MAX_PORT ? port : null;
}

/**
 * Splits a pasted `pubkey@host:port` (IPv6 hosts in brackets) into its parts. A missing port stays
 * empty: there is no default port.
 */
export function splitPeerUri(text: string): { pubkey: string; host: string; port: string } | null {
  const match = /^([0-9a-f]{66})@(\[[^\]]+\]|[^:@\s]+)(?::([0-9]{1,5}))?$/.exec(text.trim().toLowerCase());
  if (!match) return null;
  const [, pubkey, host, port] = match;
  return { pubkey, host: host.replace(/^\[|\]$/g, ''), port: port ?? '' };
}
