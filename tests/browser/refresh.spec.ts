import { expect, test, type Page } from '@playwright/test';
import examples from '../../contract/examples.v1.json' with { type: 'json' };
import { installSyntheticApi } from './synthetic-api';

/** Counts full document loads, so a test can prove the app never reloaded. */
async function countLoads(page: Page) {
  let loads = 0;
  page.on('load', () => {
    loads += 1;
  });
  return () => loads;
}

test('the node chooser agrees with the observed node, not an older fleet page', async ({ page }) => {
  await installSyntheticApi(page);
  const node = examples.fixtures.node_lnd.value;
  // The registry page as it was before the node's first observation.
  await page.route('**/api/v1/nodes', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        ...examples.fixtures.nodes_page.value,
        items: [{ ...node, network: 'unknown', status: { ...node.status, status: 'unsupported' } }],
        next_cursor: null,
        truncated: false,
      }),
    }),
  );
  await page.goto('/nodes/lnd-lab');

  await expect(page.getByRole('heading', { name: 'LND lab' })).toBeVisible();
  const chooser = page.getByRole('combobox', { name: 'Node' });
  await expect(chooser).toHaveText(/LND lab · Regtest/);
  await expect(chooser).not.toHaveText(/Unknown network|unsupported/);
});

test('a created invoice is on the invoice list when the operator returns to it, without a reload', async ({ page }) => {
  const loads = await countLoads(page);
  await installSyntheticApi(page);
  let confirmed = false;
  await page.route('**/api/v1/nodes/lnd-lab/invoices?*', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        ...examples.fixtures.invoices_page.value,
        node_id: 'lnd-lab',
        observed_at: '2026-10-21T12:00:00Z',
        items: confirmed ? examples.fixtures.invoices_page.value.items : [],
        next_cursor: null,
      }),
    }),
  );
  await page.route('**/api/v1/nodes/lnd-lab/operations/*/confirm', (route) => {
    confirmed = true;
    return route.fallback();
  });

  await page.goto('/nodes/lnd-lab/invoices');
  await expect(page.getByText('No invoices on this node.')).toBeVisible();
  await page.getByRole('button', { name: 'Create invoice' }).click();
  await page.getByLabel(/^Amount \(sat\)/).fill('2500');
  await page.getByRole('button', { name: 'Review invoice' }).click();
  const review = page.getByRole('dialog', { name: 'Create invoice', exact: true });
  await review.getByRole('button', { name: 'Create invoice', exact: true }).click();
  await expect(review.getByRole('heading', { name: 'Invoice operation' })).toBeVisible();

  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();

  const hash = examples.fixtures.invoices_page.value.items[0].payment_hash;
  await expect(page.getByRole('link', { name: new RegExp(`\\(Open invoice ${hash.slice(0, 8)}\\)$`) }).first()).toBeVisible();
  await expect(page.getByText('No invoices on this node.')).toHaveCount(0);
  expect(loads()).toBe(1);
});
