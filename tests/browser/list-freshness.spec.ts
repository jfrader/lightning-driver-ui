import { expect, test } from '@playwright/test';
import { FIXTURE_NOW, fixture, installSyntheticApi, operation, unresolvedOperation } from './synthetic-api';

const settledOperation = () => ({
  ...unresolvedOperation(), state: 'succeeded', stage: 'settled',
  result: operation('pay_invoice', 'succeeded', 'settled', true).result,
});

test('overview requests and renders five payments while Payments keeps its normal page size', async ({ page }) => {
  await installSyntheticApi(page);
  const limits: number[] = [];
  const source = fixture('payments_page');
  const available = Array.from({ length: 12 }, (_, index) => ({
    ...source.items[0], payment_hash: index.toString(16).padStart(64, '0'),
  }));
  await page.route('**/api/v1/nodes/lnd-lab/payments?*', (route) => {
    const limit = Number(new URL(route.request().url()).searchParams.get('limit'));
    limits.push(limit);
    return route.fulfill({ json: { ...source, node_id: 'lnd-lab', items: available.slice(0, limit), next_cursor: null } });
  });
  await page.goto('/nodes/lnd-lab');
  await expect(page.getByRole('link', { name: /Open payment/ })).toHaveCount(5);
  expect(limits).toEqual([5]);
  await page.getByRole('link', { name: 'All payments', exact: true }).click();
  await expect(page.getByRole('link', { name: /Open payment/ })).toHaveCount(available.length);
  expect(limits).toEqual([5, 100]);
});

for (const initiallyEmpty of [false, true]) {
  test(`attention refreshes without navigation or focus changes (initially empty: ${initiallyEmpty})`, async ({ page }) => {
    await installSyntheticApi(page);
    await page.clock.install({ time: FIXTURE_NOW });
    let state = initiallyEmpty ? 'empty' : 'unknown';
    let reads = 0;
    await page.route('**/api/v1/nodes/lnd-lab/operations?*', (route) => {
      reads += 1;
      const op = state === 'succeeded' ? settledOperation() : unresolvedOperation();
      const nonterminal = new URL(route.request().url()).searchParams.get('state') === 'nonterminal';
      return route.fulfill({ json: {
        ...fixture('operations_page'), node_id: 'lnd-lab', network: 'regtest',
        items: state === 'empty' || (nonterminal && state === 'succeeded') ? [] : [op], next_cursor: null,
      } });
    });
    await page.goto('/nodes/lnd-lab');
    await expect.poll(() => reads).toBeGreaterThan(0);
    const warning = page.getByRole('heading', { name: 'Needs attention' });
    if (initiallyEmpty) {
      await expect(warning).toHaveCount(0);
      state = 'unknown';
      await page.clock.fastForward(fixture('public_policy').operation_poll_seconds * 1000);
    }
    await expect(warning).toBeVisible();
    state = 'succeeded';
    await page.clock.fastForward(fixture('public_policy').operation_poll_seconds * 1000);
    await expect(warning).toHaveCount(0);
    await expect(page).toHaveURL(/\/nodes\/lnd-lab$/);
  });
}

test('the active operation list polls but archived cursor pages do not', async ({ page }) => {
  await installSyntheticApi(page);
  await page.clock.install({ time: FIXTURE_NOW });
  let succeeded = false;
  let archiveReads = 0;
  await page.route('**/api/v1/nodes/lnd-lab/operations?*', (route) => {
    if (new URL(route.request().url()).searchParams.has('cursor')) archiveReads += 1;
    return route.fulfill({ json: {
      ...fixture('operations_page'), node_id: 'lnd-lab', network: 'regtest', next_cursor: null,
      items: [succeeded ? settledOperation() : unresolvedOperation()],
    } });
  });
  await page.goto('/nodes/lnd-lab/operations');
  await expect(page.getByText('Outcome unknown', { exact: true }).filter({ visible: true })).toBeVisible();
  succeeded = true;
  await page.clock.fastForward(fixture('public_policy').operation_poll_seconds * 1000);
  await expect(page.getByText('Paid', { exact: true })).toBeVisible();
  await page.goto('/nodes/lnd-lab/operations?cursor=archive');
  await expect(page.getByText('Paid', { exact: true })).toBeVisible();
  expect(archiveReads).toBe(1);
  const before = archiveReads;
  await page.clock.fastForward(fixture('public_policy').operation_poll_seconds * 3000);
  expect(archiveReads).toBe(before);
});

test('list polling pauses while the document is hidden', async ({ page }) => {
  await installSyntheticApi(page);
  await page.clock.install({ time: FIXTURE_NOW });
  let reads = 0;
  await page.route('**/api/v1/nodes/lnd-lab/operations?*', (route) => {
    reads += 1;
    return route.fallback();
  });
  await page.goto('/nodes/lnd-lab');
  await expect(page.getByRole('heading', { name: 'Needs attention' })).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const before = reads;
  await page.clock.fastForward(fixture('public_policy').operation_poll_seconds * 3000);
  expect(reads).toBe(before);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => reads).toBeGreaterThan(before);
});
