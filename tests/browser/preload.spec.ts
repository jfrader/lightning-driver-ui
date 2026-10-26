import { expect, test } from '@playwright/test';
import { installSyntheticApi } from './synthetic-api';

test('the global money form is preloaded before its payment entry opens', async ({ page }) => {
  await installSyntheticApi(page);
  const sheetChunk: string[] = [];
  page.on('request', (request) => {
    if (/\/assets\/MoneySurface-[^/]+\.js$/.test(new URL(request.url()).pathname)) sheetChunk.push(request.url());
  });
  await page.goto('/nodes/lnd-lab/payments');
  await expect(page.getByRole('heading', { name: 'Payments', exact: true })).toBeVisible();
  const entry = page.getByRole('button', { name: 'Pay invoice', exact: true });
  await expect.poll(() => sheetChunk.length, { timeout: 5000 }).toBeGreaterThan(0);
  const fetched = sheetChunk.length;
  await entry.click();
  await expect(page.getByRole('dialog', { name: 'Send and receive' })).toBeVisible();
  expect(sheetChunk.length).toBe(fetched);
});
