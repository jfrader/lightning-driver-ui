import { expect, test } from '@playwright/test';
import { installSyntheticApi } from './synthetic-api';
import { installNostrSigner } from './nostr-signer';

test('logout clears the other tab without a reload', async ({ page, context }) => {
  const other = await context.newPage();
  for (const tab of [page, other]) {
    await installSyntheticApi(tab);
    await tab.goto('/more');
    await expect(tab.getByRole('region', { name: 'Session', exact: true })).toBeVisible();
  }
  let documents = 0;
  other.on('request', request => { if (request.isNavigationRequest()) documents++; });
  await page.getByRole('region', { name: 'Session', exact: true }).getByRole('button', { name: 'Sign out' }).click();
  for (const tab of [page, other]) {
    await expect(tab.getByText('Signed out.')).toBeVisible();
    await expect(tab.getByRole('region', { name: 'Session', exact: true })).toHaveCount(0);
  }
  expect(documents).toBe(0);
  await other.close();
});

test('a new identity clears the other tab without signing out the initiating tab', async ({ page, context }) => {
  const other = await context.newPage();
  await installSyntheticApi(other);
  await other.goto('/more');
  await expect(other.getByRole('region', { name: 'Session', exact: true })).toBeVisible();
  let documents = 0;
  other.on('request', request => { if (request.isNavigationRequest()) documents++; });
  await installSyntheticApi(page, { nostrIdentity: true });
  await installNostrSigner(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Sign in with Nostr' }).click();
  await expect(other.getByText('Session changed in another tab. Sign in again.')).toBeVisible();
  await expect(other.getByRole('region', { name: 'Session', exact: true })).toHaveCount(0);
  await expect(page).not.toHaveURL(/\/login/);
  expect(documents).toBe(0);
  await other.close();
});
