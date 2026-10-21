export const DEFAULT_LIGHTNING_PORT = 9735;

const PUBKEY_PATTERN = /^(02|03)[0-9a-f]{64}$/;
const MAX_PORT = 65_535;

export function isPubkey(value: string): boolean {
  return PUBKEY_PATTERN.test(value);
}

/** Port from the canonical value of a whole-number input. */
export function parsePort(input: string): number | null {
  if (!/^[0-9]{1,5}$/.test(input)) return null;
  const port = Number(input);
  return port >= 1 && port <= MAX_PORT ? port : null;
}

/** Splits a pasted `pubkey@host:port` (IPv6 hosts in brackets) into its parts. */
export function splitPeerUri(text: string): { pubkey: string; host: string; port: string } | null {
  const match = /^([0-9a-f]{66})@(\[[^\]]+\]|[^:@\s]+)(?::([0-9]{1,5}))?$/.exec(text.trim().toLowerCase());
  if (!match) return null;
  const [, pubkey, host, port] = match;
  return { pubkey, host: host.replace(/^\[|\]$/g, ''), port: port ?? String(DEFAULT_LIGHTNING_PORT) };
}
