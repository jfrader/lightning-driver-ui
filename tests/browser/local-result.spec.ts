import { expect, test } from '@playwright/test';
import { fixture, installSyntheticApi, operation } from './synthetic-api';

for (const kind of ['new_address', 'create_invoice'] as const) {
  test(`completed ${kind} keeps its result and timeline without node observation`, async ({ page }) => {
    await installSyntheticApi(page);
    const completed = operation(kind, 'succeeded', 'completed', true);
    await page.route(`**/api/v1/nodes/lnd-lab/operations/${completed.id}`, route => route.fulfill({ json: completed }));
    await page.goto(`/nodes/lnd-lab/operations/${completed.id}`);
    await expect(page.getByText(kind === 'new_address' ? 'Address created.' : 'Invoice created.', { exact: true })).toBeVisible();
    await expect(page.getByText('Not checked with the node yet', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Last checked with the node', { exact: true })).toHaveCount(0);
    const value = kind === 'new_address' ? fixture('new_address_result').address : fixture('create_invoice_result').bolt11;
    await expect(page.getByText(value, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: kind === 'new_address' ? 'Copy Address' : 'Copy Invoice', exact: true })).toBeVisible();
    for (const label of ['Review created', 'Sent to node', 'Last state change', 'Final outcome']) {
      await expect(page.getByRole('list', { name: 'Operation timeline' }).getByRole('listitem').filter({ hasText: label })).toBeVisible();
    }
  });
}

test('a pending payment still shows its unobserved node check', async ({ page }) => {
  await installSyntheticApi(page);
  const pending = { ...operation('pay_invoice', 'pending', 'submitted'), last_reconciled_at: null };
  await page.route(`**/api/v1/nodes/lnd-lab/operations/${pending.id}`, route => route.fulfill({ json: pending }));
  await page.goto(`/nodes/lnd-lab/operations/${pending.id}`);
  await expect(page.getByText('Not checked with the node yet', { exact: true })).toBeVisible();
  await expect(page.getByText('Last checked with the node', { exact: true })).toBeVisible();
});

test('overview attention omits node checks only for stale local results', async ({ page }) => {
  await installSyntheticApi(page);
  const items = (['new_address', 'create_invoice', 'pay_invoice'] as const).map(kind => ({
    ...operation(kind, 'pending', 'submitted'),
    last_reconciled_at: null,
  }));
  await page.route('**/api/v1/nodes/lnd-lab/operations?*', route => route.fulfill({
    json: { ...fixture('operations_page'), node_id: items[0].node_id, network: items[0].review.node.network, items },
  }));
  await page.goto('/nodes/lnd-lab');
  await expect(page.getByRole('link', { name: 'View operation', exact: true })).toHaveCount(3);
  await expect(page.getByText('Not checked with the node yet', { exact: true })).toHaveCount(1);
});
