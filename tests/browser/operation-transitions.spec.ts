import { expect, test } from '@playwright/test';
import { fixture, installSyntheticApi, operation, UNRESOLVED_OPERATION_ID, unresolvedOperation } from './synthetic-api';

test('a polled terminal outcome refreshes unresolved counts and attention without a reload', async ({ page }) => {
  await installSyntheticApi(page);
  let loads = 0;
  page.on('load', () => { loads += 1; });
  let terminal = false;
  let reads = 0;
  const node = () => ({ ...fixture('node_lnd'), unresolved_operation_count: terminal ? '0' : '1' });
  const current = () => terminal
    ? { ...unresolvedOperation(), state: 'succeeded', stage: 'settled', result: operation('pay_invoice', 'succeeded', 'settled', true).result }
    : unresolvedOperation();
  const json = (body: unknown) => ({ contentType: 'application/json', body: JSON.stringify(body) });
  await page.route('**/api/v1/nodes', (route) => route.fulfill(json({ ...fixture('nodes_page'), items: [node()], next_cursor: null })));
  await page.route('**/api/v1/nodes/lnd-lab', (route) => route.fulfill(json(node())));
  await page.route('**/api/v1/nodes/lnd-lab/operations?*', (route) =>
    route.fulfill(json({ ...fixture('operations_page'), node_id: node().id, network: node().network, items: terminal ? [] : [current()], next_cursor: null })),
  );
  await page.route(`**/api/v1/nodes/lnd-lab/operations/${UNRESOLVED_OPERATION_ID}`, (route) => {
    reads += 1;
    return route.fulfill(json(current()));
  });

  await page.goto('/fleet');
  await expect(page.getByRole('main').getByRole('link', { name: '1 unresolved' })).toBeVisible();
  await page.getByRole('main').getByRole('link', { name: 'LND lab', exact: true }).click();
  await page.getByRole('main').getByRole('link', { name: 'View operation' }).click();
  await expect.poll(() => reads).toBeGreaterThan(0);
  await expect(page.getByRole('link', { name: '1 unresolved', exact: true }).first()).toBeVisible();
  const sidebar = page.getByRole('navigation', { name: 'Node sections' });
  const desktop = (page.viewportSize()?.width ?? 0) >= 1024;
  if (desktop) await expect(sidebar.getByRole('link', { name: /Operations.*1 unresolved/ })).toBeVisible();

  terminal = true;
  // The counter disappears when nothing is unresolved; that is the visible proof the poll landed.
  await expect(page.getByRole('link', { name: '1 unresolved', exact: true })).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByRole('link', { name: '0 unresolved', exact: true })).toHaveCount(0);
  if (desktop) await expect(sidebar.getByRole('link', { name: 'Operations', exact: true })).toBeVisible();

  const sections = page.getByRole('navigation', { name: desktop ? 'Node sections' : 'Sections' });
  await sections.getByRole('link', { name: 'Overview', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Needs attention' })).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Node' }).click();
  await page.getByRole('option', { name: 'All nodes' }).click();
  await expect(page).toHaveURL(/\/fleet$/);
  await expect(page.getByRole('main').getByRole('link', { name: '1 unresolved' })).toHaveCount(0);
  await expect(page.getByRole('main').getByRole('link', { name: 'LND lab', exact: true })).toBeVisible();
  if (desktop) await expect(page.getByRole('cell', { name: '0', exact: true })).toBeVisible();
  expect(loads).toBe(1);
});
