import { expect, test, type Page } from '@playwright/test';
import { installSyntheticApi } from './synthetic-api';

/** The phone's primary action must clear the fixed tab bar by at least this much. */
const TAB_BAR_CLEARANCE_PX = 12;

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 1024;

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

for (const path of ['/nodes/lnd-lab', '/nodes/lnd-lab/payments', '/nodes/lnd-lab/channels', '/fleet']) {
  test(`${path} has no horizontal overflow`, async ({ page }) => {
    await installSyntheticApi(page);
    await page.goto(path);
    await expect(page.getByRole('main')).toBeVisible();
    await page.waitForLoadState('networkidle');
    await expectNoHorizontalOverflow(page);
  });
}

test('the phone primary action clears the tab bar when scrolled to the end', async ({ page }) => {
  test.skip(!isPhone(page), 'phone shell only');
  await installSyntheticApi(page);
  await page.goto('/nodes/lnd-lab/invoices/new');
  const submit = page.getByRole('button', { name: 'Review invoice' });
  await expect(submit).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

  const tabs = await page.getByRole('navigation', { name: 'Sections' }).boundingBox();
  const action = await submit.boundingBox();
  if (!tabs || !action) throw new Error('Missing geometry');
  expect(action.y + action.height).toBeLessThan(tabs.y - TAB_BAR_CLEARANCE_PX);
});

test('the palette opens with the keyboard, traps focus and returns it on close', async ({ page }) => {
  await installSyntheticApi(page);
  await page.goto('/nodes/lnd-lab');
  await expect(page.getByRole('heading', { name: 'LND lab' })).toBeVisible();
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await page.keyboard.press('Tab');
  await expect(skip).toBeFocused();

  await page.keyboard.press('Control+k');
  const dialog = page.getByRole('dialog', { name: 'Go to' });
  await expect(dialog).toBeVisible();
  // Native modal dialog: the page behind is inert, so Tab stays in the dialog or goes to the
  // browser's own UI (activeElement = body); it never reaches a page control.
  for (let step = 0; step < 6; step += 1) {
    await page.keyboard.press('Tab');
    const escaped = await dialog.evaluate(
      (element) => document.activeElement !== document.body && !element.contains(document.activeElement),
    );
    expect(escaped).toBe(false);
  }

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(skip).toBeFocused();
});

/** Records the keyframe properties of every `Element.animate` call (the screen-change motion). */
async function recordAnimations(page: Page) {
  await page.addInitScript(() => {
    const calls: string[][] = [];
    Object.assign(window, { __animateCalls: calls });
    const animate = Element.prototype.animate;
    Element.prototype.animate = function record(this: Element, keyframes, options) {
      const frames = Array.isArray(keyframes) ? keyframes : [];
      calls.push(frames.flatMap((frame) => Object.keys(frame)));
      return animate.call(this, keyframes, options);
    };
  });
  return () => page.evaluate(() => (window as unknown as { __animateCalls: string[][] }).__animateCalls);
}

async function changeScreen(page: Page) {
  const nav = isPhone(page) ? 'Sections' : 'Node sections';
  await page.getByRole('navigation', { name: nav }).getByRole('link', { name: 'Channels' }).click();
  await expect(page).toHaveURL(/\/channels$/);
}

for (const reducedMotion of ['reduce', 'no-preference'] as const) {
  test(`screen change motion with reduced motion ${reducedMotion}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    const animateCalls = await recordAnimations(page);
    await installSyntheticApi(page);
    await page.goto('/nodes/lnd-lab');
    await expect(page.getByRole('heading', { name: 'LND lab' })).toBeVisible();
    await changeScreen(page);

    const calls = await animateCalls();
    if (reducedMotion === 'reduce') {
      expect(calls).toEqual([]);
      return;
    }
    expect(calls.length).toBeGreaterThan(0);
    for (const properties of calls) expect(new Set(properties)).toEqual(new Set(['opacity', 'transform']));
  });
}

test('switching theme keeps the route, the unit and the session', async ({ page }) => {
  await installSyntheticApi(page);
  await page.goto('/nodes/lnd-lab');
  await expect(page.getByRole('heading', { name: 'LND lab' })).toBeVisible();
  if (isPhone(page)) {
    await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'More' }).click();
  }
  await page.getByRole('radiogroup', { name: 'Display unit' }).getByRole('radio', { name: 'BTC' }).click();
  const url = page.url();

  await page.getByRole('radiogroup', { name: 'Theme' }).getByRole('radio', { name: 'Light' }).click();

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(page.url()).toBe(url);
  await expect(page.getByRole('radiogroup', { name: 'Display unit' }).getByRole('radio', { name: 'BTC' })).toBeChecked();
  const stored = await page.evaluate(() => Object.keys(window.localStorage).sort());
  expect(stored).toEqual(['lightning-driver.last-node-id', 'lightning-driver.theme']);
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
});
