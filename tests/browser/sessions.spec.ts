import { expect, test } from '@playwright/test';
import { currentSession, otherSession } from '../../src/test/sessions';
import { installSyntheticApi } from './synthetic-api';
import { doubleText } from './text-size';

for (const width of [390, 1440]) {
  test(`@layout Sessions stays readable and actions clear the shell at ${width}px and 200% text`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await installSyntheticApi(page);
    let sessions = [currentSession, otherSession];
    await page.route('**/api/v1/sessions', route => route.fulfill({ json: { sessions } }));
    await page.route(`**/api/v1/sessions/${otherSession.id}`, route => {
      expect(route.request().method()).toBe('DELETE');
      sessions = [currentSession];
      return route.fulfill({ status: 204 });
    });
    for (const enlarged of [false, true]) {
      await page.goto('/more');
      const section = page.getByRole('region', { name: 'Sessions', exact: true });
      const marker = section.getByText('Current session', { exact: true });
      await expect(marker).toBeVisible();
      const methods = page.getByRole('region', { name: 'Sign-in methods', exact: true });
      await expect(methods.locator('[aria-busy="true"]')).toHaveCount(0);
      await expect(methods.getByLabel('Nostr signer', { exact: true })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      if (enlarged) await doubleText(page);
      await section.scrollIntoViewIfNeeded();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      for (const text of [marker, ...await section.locator('time').all()]) {
        expect(await text.evaluate(element => {
          const range = document.createRange();
          range.selectNodeContents(element);
          const rects = [...range.getClientRects()];
          if (!rects.length) return false;
          if (!rects.every(rect => rect.left >= -1 && rect.right <= innerWidth + 1)) return false;
          // Readable means inside the viewport and not cut by a clipping ancestor; the inline
          // element's own box is font-metric noise at 200% (glyph boxes overhang the line box).
          for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
            const style = getComputedStyle(ancestor);
            if (!['auto', 'scroll', 'hidden', 'clip'].some(value => style.overflowX === value || style.overflowY === value)) continue;
            const clip = ancestor.getBoundingClientRect();
            return rects.every(rect => rect.left >= clip.left - 1 && rect.right <= clip.right + 1 && rect.top >= clip.top - 1 && rect.bottom <= clip.bottom + 1);
          }
          return true;
        })).toBe(true);
      }
      const signOut = section.getByRole('button', { name: 'Sign out', exact: true });
      await signOut.focus();
      await signOut.scrollIntoViewIfNeeded();
      const geometry = await signOut.evaluate(element => {
        const r = element.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        const tabs = document.querySelector('nav[aria-label="Sections"]')?.getBoundingClientRect();
        return { width: r.width, height: r.height, bottom: r.bottom, tabsTop: tabs?.top, hit: hit === element || element.contains(hit) };
      });
      expect(geometry.hit).toBe(true);
      if (width === 390) {
        expect(geometry.width).toBeGreaterThanOrEqual(44);
        expect(geometry.height).toBeGreaterThanOrEqual(44);
        expect(geometry.bottom).toBeLessThan(geometry.tabsTop!);
      }
    }
    const section = page.getByRole('region', { name: 'Sessions', exact: true });
    await section.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(section.getByText('No other sessions.')).toBeVisible();
    await expect(section.getByRole('listitem')).toHaveCount(1);
    await expect(section.getByText('Current session')).toBeVisible();
  });
}
