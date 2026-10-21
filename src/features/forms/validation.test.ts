import { describe, expect, it } from 'vitest';
import type { NodePolicy } from '../../api/types';
import { fixture } from '../../test/fixtures';
import {
  checkAddress,
  checkAmount,
  checkDescription,
  checkExpiry,
  checkFeeCap,
  checkFeeRate,
  checkHost,
  checkPort,
  checkPubkey,
} from './validation';

const policy = fixture('node_policy') as NodePolicy;
const sat = (text: string) => ({ text, unit: 'sat' as const });
const PUBKEY = `02${'a'.repeat(64)}`;

describe('amounts', () => {
  it('accepts an exact amount inside the policy range', () => {
    expect(checkAmount(sat('150000'), { allowMsat: false, bounds: policy.open_channel_sat, boundsUnit: 'sat' })).toEqual({
      ok: true,
      value: 150_000_000n,
    });
  });

  it('names the policy range when outside it', () => {
    expect(checkAmount(sat('50000'), { allowMsat: false, bounds: policy.open_channel_sat, boundsUnit: 'sat' })).toEqual({
      ok: false,
      error: 'Enter an amount from 100,000 sat to 10,000,000 sat.',
    });
  });

  it('refuses fractions of a satoshi on-chain and malformed text as typed', () => {
    const rules = { allowMsat: false, bounds: policy.send_onchain_sat, boundsUnit: 'sat' as const };
    expect(checkAmount(sat('1500.5'), rules)).toEqual({ ok: false, error: 'On-chain amounts are whole satoshis.' });
    expect(checkAmount(sat('1,500'), rules)).toEqual({
      ok: false,
      error: 'Use digits and a decimal point only, without spaces or commas.',
    });
  });

  it('allows a zero fee cap and refuses one above the node cap', () => {
    expect(checkFeeCap(sat('0'), policy)).toEqual({ ok: true, value: 0n });
    expect(checkFeeCap(sat('0.000'), policy)).toEqual({ ok: true, value: 0n });
    expect(checkFeeCap(sat('100'), policy)).toEqual({ ok: true, value: 100_000n });
    expect(checkFeeCap(sat('100.001'), policy)).toEqual({ ok: false, error: 'The fee cap for this node is at most 100 sat.' });
  });
});

describe('fee rate, expiry and description', () => {
  it.each(['0', '101', '2.5', '', ' 2'])('refuses fee rate %j', (text) => {
    expect(checkFeeRate(text, policy.fee_rate_sat_vbyte)).toEqual({ ok: false, error: 'Enter a whole fee rate from 1 to 100 sat/vB.' });
  });

  it('accepts a whole fee rate in range', () => {
    expect(checkFeeRate('2', policy.fee_rate_sat_vbyte)).toEqual({ ok: true, value: 2n });
  });

  it.each(['59', '86401', '3600.5', '1e3'])('refuses expiry %j', (text) => {
    expect(checkExpiry(text, policy.invoice_expiry_seconds)).toEqual({
      ok: false,
      error: 'Enter whole seconds between 60 and 86400.',
    });
  });

  it('accepts expiry at both bounds', () => {
    expect(checkExpiry('60', policy.invoice_expiry_seconds)).toEqual({ ok: true, value: 60 });
    expect(checkExpiry('86400', policy.invoice_expiry_seconds)).toEqual({ ok: true, value: 86_400 });
  });

  it('bounds the description by characters, allowing it empty', () => {
    expect(checkDescription('')).toEqual({ ok: true, value: '' });
    expect(checkDescription('é'.repeat(640)).ok).toBe(true);
    expect(checkDescription('x'.repeat(641))).toEqual({ ok: false, error: 'Use 640 characters or fewer.' });
  });
});

describe('peers and addresses', () => {
  it('canonicalises a public key and refuses anything else', () => {
    expect(checkPubkey(`  ${PUBKEY.toUpperCase()} `)).toEqual({ ok: true, value: PUBKEY });
    for (const text of [`04${'a'.repeat(64)}`, PUBKEY.slice(1), `${PUBKEY}@host`]) {
      expect(checkPubkey(text)).toEqual({ ok: false, error: 'Enter a 66-character public key starting with 02 or 03.' });
    }
  });

  it.each(['peer.example', '203.0.113.7', 'abcdefghijklmnop.onion', '::1'])('accepts host %s', (host) => {
    expect(checkHost(host).ok).toBe(true);
  });

  it.each(['', 'https://peer.example', 'peer.example/path', 'user@peer.example', 'peer.example:9735', 'two words'])(
    'refuses host %j',
    (host) => {
      expect(checkHost(host)).toEqual({ ok: false, error: 'Enter a host name or IP address only.' });
    },
  );

  it.each([
    ['9735', true],
    ['1', true],
    ['65535', true],
    ['0', false],
    ['65536', false],
    ['97 35', false],
    ['', false],
  ])('port %j valid: %s', (text, valid) => {
    expect(checkPort(text).ok).toBe(valid);
  });

  it('trims an address and refuses an empty or spaced one', () => {
    expect(checkAddress('  bcrt1qexample ')).toEqual({ ok: true, value: 'bcrt1qexample' });
    expect(checkAddress('   ')).toEqual({ ok: false, error: 'Enter a Bitcoin address.' });
    expect(checkAddress('bcrt1 qexample')).toEqual({ ok: false, error: 'Enter a Bitcoin address.' });
  });
});
