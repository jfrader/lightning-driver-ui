import { expect, test, type Locator, type Page } from '@playwright/test';
import { fixture, installSyntheticApi } from './synthetic-api';

/** Touch targets on the phone layout. */
const MIN_TOUCH_PX = 44;
const SIZES = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
];
const PHONE_MAX_WIDTH = 1023;

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
      await expect(page).toHaveURL(/\/login$/);
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
