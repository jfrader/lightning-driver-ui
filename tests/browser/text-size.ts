import type { Page } from '@playwright/test';

/**
 * Simulates 200% text: every element's font and line box are doubled. The line box keeps at least a
 * 1.5 ratio to the enlarged font, so the helper itself does not violate WCAG text spacing and the
 * layout is stressed the way a large-text operator sees it.
 */
export async function doubleText(page: Page) {
  await page.evaluate(() => {
    const sizes = [...document.body.querySelectorAll<HTMLElement>('*')].map((element) => ({
      element,
      font: parseFloat(getComputedStyle(element).fontSize),
      line: parseFloat(getComputedStyle(element).lineHeight),
    }));
    for (const { element, font, line } of sizes) {
      const enlarged = font * 2;
      element.style.setProperty('font-size', `${enlarged}px`, 'important');
      if (Number.isFinite(line)) element.style.setProperty('line-height', `${Math.max(line * 2, enlarged * 1.5)}px`, 'important');
    }
  });
}
