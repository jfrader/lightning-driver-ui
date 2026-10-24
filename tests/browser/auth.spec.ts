import { expect, test, type Locator, type Page } from '@playwright/test';
import { APP_ORIGIN, fixture, installSyntheticApi } from './synthetic-api';
import { doubleText } from './text-size';

/** Touch targets on the phone layout. */
const MIN_TOUCH_PX = 44;
const SIZES = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
];
const PHONE_MAX_WIDTH = 1023;

test('@layout sign-in and enrollment actions remain contained at 200% text size', async ({ page }) => {
  await installSyntheticApi(page);
  await hostAllows(page, true, true);
  await page.setViewportSize({ width: 320, height: 844 });
  for (const enrollment of [false, true]) {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Continue with passkey' })).toBeVisible();
    if (enrollment) await page.getByRole('button', { name: 'Enroll a sign-in method' }).click();
    await doubleText(page);
    await expectNoHorizontalOverflow(page);
    for (const button of await page.getByRole('button').all()) {
      const contained = await button.evaluate(element => {
        const box = element.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(element);
        const text = range.getBoundingClientRect();
        return text.left >= box.left - 1 && text.right <= box.right + 1 && text.top >= box.top - 1 && text.bottom <= box.bottom + 1;
      });
      expect(contained, await button.textContent() ?? '').toBe(true);
    }
  }
});

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) <= PHONE_MAX_WIDTH;

async function expectTouchTarget(page: Page, target: Locator) {
  if (!isPhone(page)) return;
  const box = await target.boundingBox();
  if (!box) throw new Error('Missing geometry');
  expect(box.height).toBeGreaterThanOrEqual(MIN_TOUCH_PX);
}

/** The focused element draws the theme's focus ring. */
async function expectFocusRing(target: Locator) {
  await expect(target).toBeFocused();
  const outline = await target.evaluate((element) => {
    const style = getComputedStyle(element);
    return { style: style.outlineStyle, width: parseFloat(style.outlineWidth), shadow: style.boxShadow };
  });
  expect(outline.style !== 'none' && outline.width > 0 || outline.shadow !== 'none').toBe(true);
}

async function hostAllows(page: Page, login: boolean, enrollment: boolean) {
  await page.route('**/api/v1/auth/bootstrap', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ...fixture('bootstrap'), login_available: login, enrollment_available: enrollment }),
    }),
  );
}

for (const size of SIZES) {
  test.describe(`at ${size.width}`, () => {
    test.use({ viewport: size });

    test('sign-in: one passkey action, reachable by keyboard, with no overflow', async ({ page }) => {
      await installSyntheticApi(page);
      await page.goto('/login?notice=session_ended');

      await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
      await expect(page.getByText('Session ended.')).toBeVisible();
      const action = page.getByRole('button', { name: 'Continue with passkey' });
      await expect(action).toBeEnabled();
      await expect(page.locator('input')).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
      await expectTouchTarget(page, action);

      await page.keyboard.press('Tab');
      await expectFocusRing(action);
    });

    test('enrollment: a state of /login, keyboard only, refusing a partial token locally', async ({ page }) => {
      const requests = await installSyntheticApi(page);
      await hostAllows(page, true, true);
      await page.goto('/login');

      const enroll = page.getByRole('button', { name: 'Enroll a sign-in method' });
      await expect(enroll).toBeVisible();
      await expectTouchTarget(page, enroll);
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await expectFocusRing(enroll);
      await page.keyboard.press('Enter');

      await expect(page.getByRole('heading', { level: 1, name: 'Enroll' })).toBeVisible();
      await expect(page).toHaveURL(/\/login\?enroll=1$/);
      const token = page.getByLabel(/^Enrollment token/);
      await expect(token).toBeFocused();
      await expectTouchTarget(page, token);
      await page.keyboard.type('too-short');
      await page.keyboard.press('Enter');
      await expect(page.getByText('Enter the full token from the host.')).toBeVisible();
      expect(requests).toEqual([]);
      await expectNoHorizontalOverflow(page);

      await page.getByRole('button', { name: 'Back to sign in' }).focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('button', { name: 'Continue with passkey' })).toBeFocused();
    });

    test('no passkey and no enrollment: the host command, wrapped inside the column', async ({ page }) => {
      await installSyntheticApi(page);
      await hostAllows(page, false, false);
      await page.goto('/login');

      await expect(page.getByText('No sign-in method is enrolled.')).toBeVisible();
      await expect(page.getByText('api-server auth enrollment --config <path>')).toBeVisible();
      await expectTouchTarget(page, page.getByRole('button', { name: 'Reload' }));
      await expectNoHorizontalOverflow(page);
    });

    test('enrollment mode survives reload and browser history without putting the token in the URL', async ({ page }) => {
      await installSyntheticApi(page);
      await hostAllows(page, true, true);
      const redirect = '/nodes/lnd-lab/payments?sort=amount';
      await page.goto(`/login?redirect=${encodeURIComponent(redirect)}`);
      await page.getByRole('button', { name: 'Enroll a sign-in method' }).click();
      const token = page.getByLabel(/^Enrollment token/);
      await expect(token).toBeFocused();
      await token.fill('SYNTHETIC_PRIVATE_ENROLLMENT_TOKEN');
      expect(new URL(page.url()).searchParams.get('redirect')).toBe(redirect);
      expect([...new URL(page.url()).searchParams.keys()].sort()).toEqual(['enroll', 'redirect']);
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Enroll', exact: true })).toBeVisible();
      await expect(token).toHaveValue('');
      await page.goBack();
      await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
      expect(new URL(page.url()).searchParams.has('enroll')).toBe(false);
      await page.goForward();
      await expect(page.getByRole('heading', { name: 'Enroll', exact: true })).toBeVisible();
      expect(new URL(page.url()).searchParams.get('enroll')).toBe('1');
      expect(new URL(page.url()).searchParams.get('redirect')).toBe(redirect);
      expect(page.url()).not.toContain('SYNTHETIC_PRIVATE_ENROLLMENT_TOKEN');
    });

    test('legacy enrollment redirects with replacement and validates mode against server availability', async ({ page }) => {
      await installSyntheticApi(page);
      await hostAllows(page, true, true);
      await page.goto('/login');
      await page.goto('/enroll?redirect=%2Fnodes%2Flnd-lab');
      await expect(page.getByRole('heading', { name: 'Enroll', exact: true })).toBeVisible();
      expect(new URL(page.url()).searchParams.get('redirect')).toBe('/nodes/lnd-lab');
      expect(new URL(page.url()).pathname).toBe('/login');
      await page.goBack();
      await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
      await page.goto('/login?enroll=invalid');
      await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
      await hostAllows(page, true, false);
      await page.goto('/login?enroll=1');
      await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
      await expect(page.getByLabel(/^Enrollment token/)).toHaveCount(0);
    });

    for (const nostrAvailable of [false, true]) {
      test(`unsupported sign-in: enroll a passkey with Nostr offered=${nostrAvailable}`, async ({ page, context }) => {
        const appOrigin = new URL(APP_ORIGIN);
        appOrigin.hostname = 'localhost';
        const requests = await installSyntheticApi(page, { appOrigin: appOrigin.origin });
        await page.route('**/api/v1/auth/bootstrap', (route) => route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            ...fixture('bootstrap'),
            login_available: true,
            passkey_login_available: false,
            nostr_login_available: nostrAvailable,
            enrollment_available: true,
          }),
        }));
        const cdp = await context.newCDPSession(page);
        await cdp.send('WebAuthn.enable');
        await cdp.send('WebAuthn.addVirtualAuthenticator', {
          options: {
            protocol: 'ctap2', transport: 'internal', hasResidentKey: true,
            hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true,
          },
        });
        await page.goto(new URL('/login', appOrigin).href);
        if (nostrAvailable) await expect(page.getByText('No Nostr extension found.', { exact: true })).toBeVisible();
        const enroll = page.getByRole('button', { name: 'Enroll a sign-in method' });
        await expect(enroll).toBeVisible();
        await expectTouchTarget(page, enroll);
        await expectNoHorizontalOverflow(page);
        await enroll.click();
        await expect(page.getByRole('heading', { name: 'Enroll', exact: true })).toBeVisible();
        await expect(page.getByText('No Nostr extension found.', { exact: true })).toBeVisible();
        const token = 'a'.repeat(64);
        await page.getByLabel(/^Enrollment token/).fill(token);
        await page.getByRole('button', { name: 'Create passkey' }).click();
        await expect(page).not.toHaveURL(/\/login/);
        await expect(page.getByRole('main')).toBeVisible();
        expect(requests.map((request) => `${request.method} ${request.path}`)).toEqual([
          'POST /auth/enrollment/start', 'POST /auth/enrollment/finish',
        ]);
        expect(requests[0].body).toEqual({ enrollment_token: token });
        expect(requests[1].body).toMatchObject({ challenge_id: fixture('enrollment_challenge').challenge_id });
        await cdp.detach();
      });

      test(`unsupported sign-in: enrollment stays closed without a token, Nostr offered=${nostrAvailable}`, async ({ page }) => {
        await installSyntheticApi(page);
        await page.route('**/api/v1/auth/bootstrap', (route) => route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            ...fixture('bootstrap'), login_available: true, passkey_login_available: false,
            nostr_login_available: nostrAvailable, enrollment_available: false,
          }),
        }));
        await page.goto('/login');
        await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
        if (nostrAvailable) await expect(page.getByText('No Nostr extension found.', { exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Enroll a sign-in method' })).toHaveCount(0);
        await expect(page.getByLabel(/^Enrollment token/)).toHaveCount(0);
      });
    }

    test('More: theme, unit, session and sign out at every width', async ({ page }) => {
      const requests = await installSyntheticApi(page);
      await page.goto('/nodes/lnd-lab');
      await expect(page.getByRole('heading', { name: 'LND lab' })).toBeVisible();
      await page.goto('/more');

      if (!isPhone(page)) {
        await expect(page).toHaveURL(/\/more$/);
        const rail = page.getByRole('complementary', { name: 'Node and sections' });
        await expect(rail.getByRole('radiogroup', { name: 'Theme' })).toBeVisible();
        // 0.0.0 is the scaffold placeholder; it must not be printed as a version.
        await expect(rail.getByText(/^App version /)).toHaveCount(0);
        await expect(rail.getByRole('button', { name: 'Sign out' })).toBeVisible();
      }

      await expect(page.getByRole('heading', { name: 'More' })).toBeVisible();
      await expect(page.getByText('Passkey for every payment')).toBeVisible();
      await expect(page.getByText(/^App version /)).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
      for (const radio of await page.getByRole('main').getByRole('radio').all()) await expectTouchTarget(page, radio);
      const signOut = page.getByRole('main').getByRole('button', { name: 'Sign out' });
      await expectTouchTarget(page, signOut);

      await signOut.focus();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/\/login\?notice=signed_out$/);
      await expect(page.getByText('Signed out.')).toBeVisible();
      expect(requests.map((r) => `${r.method} ${r.path}`)).toEqual(['DELETE /session']);
    });
  });
}
