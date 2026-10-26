import { expect, test, type Page } from '@playwright/test';
import { installSyntheticApi } from './synthetic-api';
import { installNostrSigner } from './nostr-signer';

declare global {
  interface Window { __backCalls: string[] }
}

async function instrument(page: Page, nostrIdentity = false) {
  await page.addInitScript(() => {
    window.__backCalls = [];
    for (const method of ['back', 'go'] as const) {
      const original = history[method].bind(history);
      history[method] = (delta?: number) => {
        window.__backCalls.push(`${method}: ${new Error().stack}`);
        original(delta);
      };
    }
  });
  await installSyntheticApi(page, { nostrIdentity });
  await page.goto('data:text/html,<h1>previous</h1>');
}

async function expectNoBack(page: Page) {
  const calls = await page.evaluate(() => window.__backCalls);
  console.log('HISTORY', JSON.stringify(calls));
  expect(calls).toEqual([]);
}

test('fresh entry from another site never goes back on load', async ({ page }) => {
  await instrument(page);
  await page.goto('/nodes/lnd-lab');
  await expect(page.getByRole('button', { name: 'Send and receive', exact: true })).toBeVisible();
  await expectNoBack(page);
  await expect(page).toHaveURL('/nodes/lnd-lab');
});

test('fresh root entry and restored closed overlays stay in the app', async ({ page }) => {
  await instrument(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Send and receive', exact: true })).toBeVisible();
  const root = page.url();
  await expectNoBack(page);
  await page.evaluate(() => history.replaceState({ ...history.state, moneySheet: true, paletteEntry: true }, ''));
  await page.reload();
  await expect(page.getByRole('button', { name: 'Send and receive', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => !!(history.state.moneySheet || history.state.paletteEntry))).toBe(false);
  await page.keyboard.press('Escape');
  await expectNoBack(page);
  await expect(page).toHaveURL(root);
});

for (const marker of ['moneySheet', 'paletteEntry']) {
  test(`reload normalizes stale ${marker} without leaving the app`, async ({ page }) => {
    await instrument(page);
    await page.goto('/nodes/lnd-lab');
    await expect(page.getByRole('button', { name: 'Send and receive', exact: true })).toBeVisible();
    await page.evaluate((key) => history.replaceState({ ...history.state, [key]: true }, ''), marker);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Send and receive', exact: true })).toBeVisible();
    await expectNoBack(page);
    await expect(page).toHaveURL('/nodes/lnd-lab');
    await expect.poll(() => page.evaluate((key) => !!history.state[key], marker)).toBe(false);
  });

  test(`reloaded open ${marker} closes locally instead of leaving the app`, async ({ page }) => {
    await instrument(page);
    await page.goto('/nodes/lnd-lab');
    await expect(page.getByRole('button', { name: 'Send and receive', exact: true })).toBeVisible();
    if (marker === 'moneySheet') await page.getByRole('button', { name: 'Send and receive', exact: true }).click();
    else await page.keyboard.press('Control+k');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expectNoBack(page);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expectNoBack(page);
    await expect(page).toHaveURL('/nodes/lnd-lab');
  });

  test(`in-document ${marker} close goes back exactly one entry`, async ({ page }) => {
    await instrument(page);
    await page.goto('/nodes/lnd-lab');
    await expect(page.getByRole('button', { name: 'Send and receive', exact: true })).toBeVisible();
    const index = await page.evaluate(() => history.state.__TSR_index);
    if (marker === 'moneySheet') await page.getByRole('button', { name: 'Send and receive', exact: true }).click();
    else await page.keyboard.press('Control+k');
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect.poll(() => page.evaluate(() => history.state.__TSR_index)).toBe(index + 1);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page).toHaveURL('/nodes/lnd-lab');
    const calls = await page.evaluate(() => window.__backCalls);
    console.log('HISTORY', JSON.stringify(calls));
    expect(await page.evaluate(() => history.state.__TSR_index)).toBe(index);
    expect(calls).toHaveLength(1);
    await page.goForward();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page).toHaveURL('/nodes/lnd-lab');
    expect(await page.evaluate(() => window.__backCalls)).toHaveLength(1);
  });
}

test('login from another site signs in without going back', async ({ page }) => {
  await instrument(page, true);
  await installNostrSigner(page);
  await page.goto('/login?redirect=%2Fnodes%2Flnd-lab');
  await page.getByRole('button', { name: 'Sign in with Nostr' }).click();
  await expect(page.getByRole('button', { name: 'Send and receive', exact: true })).toBeVisible();
  await expectNoBack(page);
  await expect(page).toHaveURL('/nodes/lnd-lab');
});
