import { expect, test } from '@playwright/test';
import { fixture, installSyntheticApi } from './synthetic-api';

test('phone keyboard sorting shares URL and exact row order with desktop', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installSyntheticApi(page);
  const payments = fixture('payments_page');
  const items = [
    { amount_msat: null, fee_msat: null },
    { amount_msat: '9007199254740993', fee_msat: '9007199254740993' },
    { amount_msat: '0', fee_msat: '9007199254740992' },
    { amount_msat: '9007199254740992', fee_msat: '0' },
  ].map((amounts, index) => ({ ...payments.items[0], ...amounts, payment_hash: 'abcd'[index].repeat(64) }));
  await page.route('**/api/v1/nodes/lnd-lab/payments?*', (route) => route.fulfill({ json: { ...payments, items } }));
  await page.goto('/nodes/lnd-lab/payments?status=succeeded');
  const historyLength = await page.evaluate(() => history.length);
  const sort = page.getByRole('combobox', { name: 'Sort by' });
  const order = () => page.locator('main [data-row-primary]').evaluateAll((links) => links.map((link) => new URL((link as HTMLAnchorElement).href).searchParams.get('selected')));
  const hashes = (indices: number[]) => indices.map((index) => items[index].payment_hash);
  await expect(sort).toBeVisible();
  await sort.focus();
  await sort.press('Enter');
  await expect(page.getByRole('option')).toHaveCount(7);
  for (const option of await page.getByRole('option').all()) {
    const box = await option.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.width).toBeGreaterThanOrEqual(44);
  }
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/status=succeeded&sort=amount&dir=asc/);
  await expect.poll(order).toEqual(hashes([2, 3, 1, 0]));
  await sort.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/status=succeeded&sort=amount&dir=desc/);
  await expect.poll(order).toEqual(hashes([1, 3, 2, 0]));
  await sort.press('Enter');
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/status=succeeded&sort=fee&dir=desc/);
  await expect.poll(order).toEqual(hashes([1, 2, 3, 0]));
  await sort.press('Enter');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/status=succeeded&sort=fee&dir=asc/);
  await expect.poll(order).toEqual(hashes([3, 2, 1, 0]));
  await sort.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/status=succeeded&sort=fee&dir=desc/);
  await expect.poll(() => page.evaluate(() => history.length)).toBe(historyLength);
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(sort).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: /^Fee:/ })).toHaveAttribute('aria-sort', 'descending');
  await expect.poll(order).toEqual(hashes([1, 2, 3, 0]));
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(sort).toHaveText('Fee: Descending');
  await sort.press('Enter');
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/nodes/lnd-lab/payments?status=succeeded');
  await expect.poll(order).toEqual(hashes([0, 1, 2, 3]));
  await page.goto('/nodes/lnd-lab');
  await expect(page.getByRole('list', { name: 'Recent payments' })).toBeVisible();
  await expect(sort).toHaveCount(0);
  await page.goto('/nodes/lnd-lab/invoices');
  await expect(page.getByRole('list', { name: 'Invoices' })).toBeVisible();
  await expect(sort).toHaveCount(0);
});
