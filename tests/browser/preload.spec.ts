import { expect, test } from '@playwright/test';
import { installSyntheticApi } from './synthetic-api';

test('hovering the payment entry preloads its sheet chunk', async ({ page }) => {
  await installSyntheticApi(page);
  const sheetChunk: string[] = [];
  page.on('request', (request) => {
    if (/\/assets\/OperationSheet-[^/]+\.js$/.test(new URL(request.url()).pathname)) sheetChunk.push(request.url());
  });
  await page.goto('/nodes/lnd-lab/payments');
  await expect(page.getByRole('heading', { name: 'Payments', exact: true })).toBeVisible();
  const entry = page.getByRole('link', { name: 'Pay invoice', exact: true });
  await entry.hover();
  await expect.poll(() => sheetChunk.length, { timeout: 5000 }).toBeGreaterThan(0);
  const fetched = sheetChunk.length;
  await entry.click();
  await expect(page.getByRole('dialog', { name: 'Pay invoice' })).toBeVisible();
  expect(sheetChunk.length).toBe(fetched);
});
