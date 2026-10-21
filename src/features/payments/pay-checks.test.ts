import { describe, expect, it } from 'vitest';
import type { DecodedInvoice, NodeSummary } from '../../api/types';
import { fixture } from '../../test/fixtures';
import { normalizeBolt11, payBlocker } from './pay-checks';

const decoded = fixture('decode') as DecodedInvoice;
const node = fixture('node_lnd') as NodeSummary;

describe('invoice text', () => {
  it.each([
    ['lnbcrt1abc', 'lnbcrt1abc'],
    ['  lnbcrt1abc\n', 'lnbcrt1abc'],
    ['lightning:lnbcrt1abc', 'lnbcrt1abc'],
    ['LIGHTNING:lnbcrt1abc', 'lnbcrt1abc'],
    [' Lightning: lnbcrt1abc ', 'lnbcrt1abc'],
  ])('normalizes %j to %j', (input, expected) => {
    expect(normalizeBolt11(input)).toBe(expected);
  });
});

describe('pay blocker', () => {
  it('allows a current invoice on the node network', () => {
    expect(payBlocker(decoded, node)).toBeNull();
  });

  it('refuses expired, foreign-network and unverified-network invoices, expiry first', () => {
    expect(payBlocker({ ...decoded, expired: true, network_matches_node: false }, node)).toBe('This invoice expired at 13:00:00 UTC.');
    expect(payBlocker({ ...decoded, network: 'mainnet', network_matches_node: false }, node)).toBe(
      'This invoice is for Mainnet. LND lab is on Regtest.',
    );
    expect(payBlocker({ ...decoded, network_matches_node: null }, node)).toBe(
      'The network of this node is not verified. Payments are disabled.',
    );
  });
});
