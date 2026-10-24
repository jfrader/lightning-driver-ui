import { expect, test } from '@playwright/test';
import { NOSTR_SIGNER_STORAGE_KEY } from '../../src/features/auth/signer-state';
import { BUNKER_URI, installRemoteNostrSigner } from './remote-nostr-signer';
import { installNostrSigner } from './nostr-signer';
import { installSyntheticApi, operation } from './synthetic-api';

test('choosing an unconfigured remote signer never claims the installed extension is missing', async ({ page }) => {
  await installSyntheticApi(page, { nostrIdentity: true });
  await installNostrSigner(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Use remote signer', exact: true }).click();
  await expect(page.getByText('No signer configured.', { exact: true })).toBeVisible();
  await expect(page.getByText('No Nostr extension found.', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sign in with Nostr' })).toBeDisabled();
  await page.getByRole('button', { name: 'Use browser extension', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in with Nostr' })).toBeEnabled();
});

test('remote NIP-46 sign-in and step-up use the server templates through the real login UI', async ({ page }) => {
  const requests = await installSyntheticApi(page, { nostrIdentity: true });
  const signed = await installRemoteNostrSigner(page);
  await page.goto('/login');
  await page.getByLabel('Bunker URI').fill(BUNKER_URI);
  await page.getByRole('button', { name: 'Connect remote signer', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Disconnect remote signer', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sign in with Nostr' }).click();
  await expect(page).not.toHaveURL(/\/login/);
  expect(signed).toHaveLength(1);
  expect(signed[0].tags).toContainEqual(['purpose', 'login']);

  const review = operation('pay_invoice');
  await page.goto(`/nodes/lnd-lab/operations/${review.id}`);
  await page.getByRole('button', { name: 'Pay with Nostr' }).click();
  await expect.poll(() => requests.some((request) => request.path.endsWith('/confirm'))).toBe(true);
  expect(signed).toHaveLength(2);
  expect(signed[1].tags).toEqual(expect.arrayContaining([
    ['purpose', 'operation'], ['operation', review.id], ['digest', review.review.digest],
  ]));
});

test('disconnect removes the remote connection and signer choice', async ({ page }) => {
  await installSyntheticApi(page, { nostrIdentity: true });
  await installRemoteNostrSigner(page);
  await page.goto('/login');
  await page.getByLabel('Bunker URI').fill(BUNKER_URI);
  await page.getByRole('button', { name: 'Connect remote signer', exact: true }).click();
  await page.getByRole('button', { name: 'Disconnect remote signer', exact: true }).click();
  await expect(page.getByLabel('Bunker URI')).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), NOSTR_SIGNER_STORAGE_KEY)).toBeNull();
  await expect(page.getByRole('button', { name: 'Sign in with Nostr' })).toBeDisabled();
});

test('a nostrconnect QR pairs a remote signer and can sign in', async ({ page }) => {
  const secret = '00000000-0000-4000-8000-000000000046';
  await page.addInitScript<ReturnType<Crypto['randomUUID']>>((value) => { crypto.randomUUID = () => value; }, secret);
  await installSyntheticApi(page, { nostrIdentity: true });
  const signed = await installRemoteNostrSigner(page, { pairingSecret: secret });
  await page.goto('/login');
  await page.getByLabel('Bunker URI').fill(BUNKER_URI);
  await page.getByRole('button', { name: 'Connect with QR', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Disconnect remote signer', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sign in with Nostr' }).click();
  await expect(page).not.toHaveURL(/\/login/);
  expect(signed).toHaveLength(1);
});

test('malformed QR pairing fails without logging decrypted material', async ({ page }) => {
  const secret = '00000000-0000-4000-8000-000000000046';
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => { if (['warning', 'error'].includes(message.type())) problems.push(message.text()); });
  await page.addInitScript<ReturnType<Crypto['randomUUID']>>((value) => { crypto.randomUUID = () => value; }, secret);
  await installSyntheticApi(page, { nostrIdentity: true });
  await installRemoteNostrSigner(page, { pairingSecret: secret, malformed: true });
  await page.goto('/login');
  await page.getByLabel('Bunker URI').fill(BUNKER_URI);
  await page.getByRole('button', { name: 'Connect with QR', exact: true }).click();
  await expect(page.getByText('Invalid remote response.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Connect with QR', exact: true })).toBeEnabled();
  expect(problems).toEqual([]);
});

for (const failure of [
  { name: 'malformed', options: { malformed: true }, text: 'Invalid remote response.' },
  { name: 'rejected', options: { reject: true }, text: 'Nostr signature canceled. Nothing was sent.' },
]) test(`a ${failure.name} NIP-46 answer ends the connection spinner with a literal error`, async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await installSyntheticApi(page, { nostrIdentity: true });
  await installRemoteNostrSigner(page, failure.options);
  await page.goto('/login');
  await page.getByLabel('Bunker URI').fill(BUNKER_URI);
  await page.getByRole('button', { name: 'Connect remote signer', exact: true }).click();
  await expect(page.getByText(failure.text, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Connect remote signer', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Cancel connection' })).toHaveCount(0);
  expect(errors).toEqual([]);
});
