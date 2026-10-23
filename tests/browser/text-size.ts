import type { Page } from '@playwright/test';

export async function doubleText(page: Page) {
  await page.evaluate(() => {
    const sizes = [...document.body.querySelectorAll<HTMLElement>('*')].map((element) => ({
      element,
      font: parseFloat(getComputedStyle(element).fontSize),
      line: parseFloat(getComputedStyle(element).lineHeight),
    }));
    for (const { element, font, line } of sizes) {
      element.style.setProperty('font-size', `${font * 2}px`, 'important');
      if (Number.isFinite(line)) element.style.setProperty('line-height', `${line * 2}px`, 'important');
    }
  });
}
