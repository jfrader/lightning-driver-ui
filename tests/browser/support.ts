import { expect, type Locator, type Page } from '@playwright/test';

/** The same breakpoint the shell uses for the phone layout. */
export const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 1024;

/** Tab until `target` has focus; fails with the locator when 50 stops do not reach it. */
export async function tabTo(page: Page, target: Locator) {
  await target.waitFor({ state: 'visible' });
  for (let step = 0; step < 50; step += 1) {
    if (await target.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  await expect(target).toBeFocused();
}

/** The document must not scroll sideways; a caller may allow a known measurement tolerance. */
export async function expectNoHorizontalOverflow(page: Page, tolerance = 0) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(tolerance);
}
