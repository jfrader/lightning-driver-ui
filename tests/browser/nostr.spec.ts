import { expect, test, type Page } from '@playwright/test';
import { SYNTHETIC_NPUB, installNostrSigner } from './nostr-signer';
import { fixture, installSyntheticApi, operation, type RecordedRequest } from './synthetic-api';

const MIN_TOUCH_PX = 44;
const PHONE_MAX_WIDTH = 1023;
const REVIEW = operation('pay_invoice');
const REVIEW_PATH = `/nodes/lnd-lab/operations/${REVIEW.id}`;

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) <= PHONE_MAX_WIDTH;

async function expectTouchTarget(page: Page, name: string) {
  if (!isPhone(page)) return;
  const box = await page.getByRole('button', { name }).boundingBox();
  if (!box) throw new Error(`Missing geometry for ${name}`);
  expect(box.height).toBeGreaterThanOrEqual(MIN_TOUCH_PX);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

/** Console errors and failed responses of the app origin, which a clean journey has none of. */
function collectProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 400) problems.push(`${response.status()} ${response.url()}`);
  });
  return problems;
}

const calls = (requests: RecordedRequest[]) => requests.map((request) => `${request.method} ${request.path}`);

async function signInWithNostr(page: Page) {
  await page.goto('/login');
  const nostr = page.getByRole('button', { name: 'Sign in with Nostr' });
  await expect(nostr).toBeEnabled();
  await nostr.click();
  await expect(page).not.toHaveURL(/\/login/);
}

test('sign-in with Nostr: a real signature over the server template, then the workbench', async ({ page }) => {
  const problems = collectProblems(page);
  const requests = await installSyntheticApi(page, { nostrIdentity: true });
  const signed = await installNostrSigner(page);
  await page.goto('/login');

  // Passkey stays the primary action; Nostr follows it in focus order.
  const passkey = page.getByRole('button', { name: 'Continue with passkey' });
  const nostr = page.getByRole('button', { name: 'Sign in with Nostr' });
  await expect(passkey).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(passkey).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(nostr).toBeFocused();
  await expectTouchTarget(page, 'Sign in with Nostr');
  await expectNoHorizontalOverflow(page);

  await page.keyboard.press('Enter');

  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole('main')).toBeVisible();
  expect(calls(requests)).toEqual(['POST /auth/nostr/start', 'POST /auth/nostr/finish']);
  expect(requests[0].body).toEqual({ purpose: 'login' });
  expect(signed).toHaveLength(1);
  expect(problems).toEqual([]);
});

test('sign-in without an extension: Nostr is disabled with its literal reason', async ({ page }) => {
  await installSyntheticApi(page, { nostrIdentity: true });
  await page.goto('/login');

  await expect(page.getByRole('button', { name: 'Sign in with Nostr' })).toBeDisabled();
  await expect(page.getByText('No Nostr extension found.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with passkey' })).toBeEnabled();
});

test('a Nostr session confirms a sensitive payment with a fresh, operation-bound signature', async ({ page }) => {
  const problems = collectProblems(page);
  const requests = await installSyntheticApi(page, { nostrIdentity: true });
  const signed = await installNostrSigner(page);
  await signInWithNostr(page);
  await page.goto(REVIEW_PATH);

  const pay = page.getByRole('button', { name: 'Pay with Nostr' });
  await expect(pay).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pay with passkey' })).toHaveCount(0);
  await expectTouchTarget(page, 'Pay with Nostr');
  await pay.click();

  const confirm = `POST /nodes/lnd-lab/operations/${REVIEW.id}/confirm`;
  await expect.poll(() => calls(requests)).toContain(confirm);
  // The review also decodes its invoice; the step-up and confirm are these, in this order.
  expect(calls(requests).filter((call) => /\/(authorize|confirm)/.test(call))).toEqual([
    `POST /nodes/lnd-lab/operations/${REVIEW.id}/authorize/nostr`,
    `POST /nodes/lnd-lab/operations/${REVIEW.id}/authorize/nostr/finish`,
    confirm,
  ]);
  expect(signed.at(-1)?.tags).toEqual(
    expect.arrayContaining([
      ['purpose', 'operation'],
      ['operation', REVIEW.id],
      ['digest', REVIEW.review.digest],
    ]),
  );
  expect(requests.at(-1)?.body).toEqual({
    review_digest: REVIEW.review.digest,
    authorization_id: fixture('operation_authorization').authorization_id,
  });
  expect(problems).toEqual([]);
});

test('More: linked keys as a short npub, and removing one ends the session', async ({ page }) => {
  test.skip(!isPhone(page), 'More is the phone page; the desktop shell has no sign-in methods');
  const requests = await installSyntheticApi(page, { nostrIdentity: true });
  await installNostrSigner(page);
  await page.goto('/more');

  const methods = page.getByRole('region', { name: 'Sign-in methods' });
  await expect(methods.getByTitle(SYNTHETIC_NPUB)).toHaveText(`${SYNTHETIC_NPUB.slice(0, 8)}…${SYNTHETIC_NPUB.slice(-6)}`);
  await expectNoHorizontalOverflow(page);
  for (const name of ['Remove…', 'Link Nostr', 'Copy npub']) await expectTouchTarget(page, name);

  await methods.getByRole('button', { name: 'Remove…' }).click();
  await expectTouchTarget(page, 'Remove key');
  await methods.getByRole('button', { name: 'Remove key' }).click();

  await expect(page).toHaveURL(/\/login\?notice=signed_out$/);
  await expect(page.getByText('Signed out.')).toBeVisible();
  expect(calls(requests)).toEqual(['POST /auth/nostr/start', 'POST /auth/nostr/finish']);
  expect(requests[0].body).toEqual({ purpose: 'unlink', pubkey: expect.stringMatching(/^[0-9a-f]{64}$/) });
});
