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
  await expect(entry).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(sheetChunk).toHaveLength(0);
  await entry.focus();
  await expect.poll(() => sheetChunk.length, { timeout: 5000 }).toBeGreaterThan(0);
  const fetched = sheetChunk.length;
  await entry.click();
  await expect(page.getByRole('dialog', { name: 'Send and receive' })).toBeVisible();
  expect(sheetChunk.length).toBe(fetched);
});

test('the closed money surface waits for intent and the first cold click opens it', async ({ page }) => {
  await installSyntheticApi(page);
  const surfaceRequests: string[] = [];
  let releaseChunk!: () => void;
  const chunkReady = new Promise<void>((resolve) => { releaseChunk = resolve; });
  await page.route('**/assets/MoneySurface-*.js', async (route) => {
    surfaceRequests.push(route.request().url());
    await chunkReady;
    await route.continue();
  });
  await page.goto('/nodes/lnd-lab/payments');
  await expect(page.getByRole('heading', { name: 'Payments', exact: true })).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(surfaceRequests).toHaveLength(0);
  const control = page.getByRole('button', { name: 'Send and receive', exact: true });
  await control.click();
  await expect(page).toHaveURL(/send=1/);
  await expect.poll(() => surfaceRequests.length).toBe(1);
  await expect(page.getByRole('dialog', { name: 'Send and receive', exact: true })).toHaveCount(0);
  releaseChunk();
  const dialog = page.getByRole('dialog', { name: 'Send and receive', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('menuitem', { name: 'Pay invoice', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(control).toBeFocused();
  await control.click();
  await expect(dialog).toBeVisible();
  expect(surfaceRequests).toHaveLength(1);
});

test('hovering the money control preloads its surface without opening it', async ({ page }) => {
  await installSyntheticApi(page);
  const surfaceRequests: string[] = [];
  page.on('request', (request) => {
    if (/\/assets\/MoneySurface-[^/]+\.js$/.test(new URL(request.url()).pathname)) surfaceRequests.push(request.url());
  });
  await page.goto('/nodes/lnd-lab/payments');
  await expect(page.getByRole('heading', { name: 'Payments', exact: true })).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(surfaceRequests).toHaveLength(0);
  const control = page.getByRole('button', { name: 'Send and receive', exact: true });
  await control.hover();
  await expect.poll(() => surfaceRequests.length).toBe(1);
  await expect(page.getByRole('dialog', { name: 'Send and receive', exact: true })).toHaveCount(0);
  await control.click();
  await expect(page.getByRole('dialog', { name: 'Send and receive', exact: true })).toBeVisible();
  expect(surfaceRequests).toHaveLength(1);
});
