import { describe, expect, it } from 'vitest';
import type { Invoice } from '../../api/types';
import { fixture } from '../../test/fixtures';
import { TEST_NOW } from '../../test/environment';
import { INVOICE_STATE, invoiceExpiry, payableBolt11 } from './labels';

const NOW = TEST_NOW.getTime();
const base = fixture('invoices_page').items[0] as Invoice;
const invoice = (overrides: Partial<Invoice>): Invoice => ({ ...base, ...overrides });

describe('invoice expiry', () => {
  it('counts down for an unpaid invoice before its expiry', () => {
    expect(invoiceExpiry(invoice({ state: 'unpaid', expires_at: '2026-10-21T12:42:00Z' }), NOW)).toEqual({
      kind: 'remaining',
      at: '2026-10-21T12:42:00Z',
    });
  });

  it('says the expiry passed for an unpaid invoice, without calling it expired', () => {
    const late = invoice({ state: 'unpaid', expires_at: '2026-10-21T11:00:00Z' });
    expect(invoiceExpiry(late, NOW)).toEqual({ kind: 'passed', at: '2026-10-21T11:00:00Z' });
    expect(INVOICE_STATE[late.state].label).toBe('Unpaid');
  });

  it('records the expiry time without an age for any other state', () => {
    for (const state of ['paid', 'expired', 'canceled', 'accepted', 'unknown'] as const) {
      expect(invoiceExpiry(invoice({ state, expires_at: '2026-10-21T12:42:00Z' }), NOW).kind).toBe('recorded');
    }
  });

  it('has no expiry when the node did not report one', () => {
    expect(invoiceExpiry(invoice({ expires_at: null }), NOW)).toEqual({ kind: 'none' });
  });
});

describe('copyable invoice text', () => {
  it('is the exact BOLT11 of an unpaid invoice before its expiry', () => {
    const open = invoice({ state: 'unpaid', bolt11: 'lnbcrt1exact', expires_at: '2026-10-21T13:00:00Z' });
    expect(payableBolt11(open, NOW)).toBe('lnbcrt1exact');
  });

  it.each([
    ['paid', { state: 'paid' as const }],
    ['expired by the server', { state: 'expired' as const }],
    ['past its expiry', { state: 'unpaid' as const, expires_at: '2026-10-21T11:00:00Z' }],
    ['without invoice text', { state: 'unpaid' as const, bolt11: null }],
  ])('is not offered when %s', (_label, overrides) => {
    expect(payableBolt11(invoice({ expires_at: '2026-10-21T13:00:00Z', ...overrides }), NOW)).toBeNull();
  });

  it('is offered without an expiry when none was reported', () => {
    expect(payableBolt11(invoice({ state: 'unpaid', bolt11: 'lnbcrt1exact', expires_at: null }), NOW)).toBe('lnbcrt1exact');
  });
});
