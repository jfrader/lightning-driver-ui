import type { AmountBounds, NodePolicy } from '../../api/types';
import {
  formatMsat,
  isWithin,
  parseAmountInput,
  parsePositiveIntegerInput,
  wireToMsat,
  type WireUnit,
} from '../../lib/money';
import { isPubkey, parsePort } from '../peers/peer-address';
import type { AmountEntry } from './AmountField';

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

interface AmountRules {
  allowMsat: boolean;
  bounds: AmountBounds;
  boundsUnit: WireUnit;
}

/** Exact amount in millisatoshis within the node's configured bounds (copy deck §11.7). */
export function checkAmount(entry: AmountEntry, rules: AmountRules): Checked<bigint> {
  const parsed = parseAmountInput(entry.text, entry.unit, { allowMsat: rules.allowMsat });
  if (!parsed.ok) return fail(parsed.error);
  const min = wireToMsat(rules.bounds.min, rules.boundsUnit);
  const max = wireToMsat(rules.bounds.max, rules.boundsUnit);
  if (parsed.msat < min || parsed.msat > max) {
    return fail(`Enter an amount from ${formatMsat(min, entry.unit)} to ${formatMsat(max, entry.unit)}.`);
  }
  return { ok: true, value: parsed.msat };
}

/** Routing fee cap: zero allowed, at most the node's cap (§7.2). */
export function checkFeeCap(entry: AmountEntry, policy: NodePolicy): Checked<bigint> {
  const parsed = parseAmountInput(entry.text, entry.unit, { allowMsat: true, allowZero: true });
  if (!parsed.ok) return fail(parsed.error);
  const max = wireToMsat(policy.max_routing_fee_msat, 'msat');
  if (parsed.msat > max) return fail(`The fee cap for this node is at most ${formatMsat(max, entry.unit)}.`);
  return { ok: true, value: parsed.msat };
}

/** Whole sat/vB rate within the node's configured fee-rate bounds (§7.9). */
export function checkFeeRate(text: string, bounds: AmountBounds): Checked<bigint> {
  const parsed = parsePositiveIntegerInput(text);
  if (!parsed.ok || !isWithin(parsed.value, bounds)) {
    return fail(`Enter a whole fee rate from ${bounds.min} to ${bounds.max} sat/vB.`);
  }
  return { ok: true, value: parsed.value };
}

/** Invoice expiry in whole seconds within the node's bounds (§7.1). */
export function checkExpiry(text: string, bounds: NodePolicy['invoice_expiry_seconds']): Checked<number> {
  const parsed = parsePositiveIntegerInput(text);
  if (!parsed.ok || parsed.value < BigInt(bounds.min) || parsed.value > BigInt(bounds.max)) {
    return fail(`Enter whole seconds between ${bounds.min} and ${bounds.max}.`);
  }
  return { ok: true, value: Number(parsed.value) };
}

export const DESCRIPTION_MAX_LENGTH = 640;

/** Free text the node commits to (invoice description); empty is allowed, length is bounded. */
export function checkDescription(text: string): Checked<string> {
  return [...text].length > DESCRIPTION_MAX_LENGTH ? fail('Use 640 characters or fewer.') : { ok: true, value: text };
}

/** A compressed node public key after trimming and lowercasing (§7.3). */
export function checkPubkey(text: string): Checked<string> {
  const pubkey = text.trim().toLowerCase();
  return isPubkey(pubkey) ? { ok: true, value: pubkey } : fail('Enter a 66-character public key starting with 02 or 03.');
}

const HOST_MAX_LENGTH = 253;

/**
 * A host name or IP only: no scheme, path, user info, brackets, port or whitespace (§7.3). One colon
 * is a `host:port`; an IPv6 literal has several and is accepted bare.
 */
export function checkHost(text: string): Checked<string> {
  const host = text.trim();
  const colons = host.split(':').length - 1;
  const valid = host.length > 0 && host.length <= HOST_MAX_LENGTH && !/[\s/@?#[\]]/.test(host) && colons !== 1;
  return valid ? { ok: true, value: host } : fail('Enter a host name or IP address only.');
}

export function checkPort(text: string): Checked<number> {
  const port = parsePort(text);
  return port === null ? fail('Enter a port from 1 to 65535.') : { ok: true, value: port };
}

const ADDRESS_MAX_LENGTH = 200;

/** On-chain address: trimmed and present; the server validates it for the node's network (§7.8). */
export function checkAddress(text: string): Checked<string> {
  const address = text.trim();
  return address.length > 0 && address.length <= ADDRESS_MAX_LENGTH && !/\s/.test(address)
    ? { ok: true, value: address }
    : fail('Enter a Bitcoin address.');
}

/** The policy amount range as words, e.g. for a field description. */
export function rangeText(bounds: AmountBounds, unit: WireUnit, display: AmountEntry['unit']): string {
  return `${formatMsat(wireToMsat(bounds.min, unit), display)} to ${formatMsat(wireToMsat(bounds.max, unit), display)}`;
}
