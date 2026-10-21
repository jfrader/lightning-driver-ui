import { expect, test, type Locator, type Page } from '@playwright/test';
import { installSyntheticApi, operation } from './synthetic-api';

/** Implementation spec §11 and §13, with Playwright's own emulation only. */
const MIN_TOUCH_PX = 44;
const TAB_BAR_CLEARANCE_PX = 12;
const REVIEW_PATH = `/nodes/lnd-lab/operations/${operation('pay_invoice').id}`;
const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 1024;

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

/** The control is entirely inside the viewport and is what a pointer at its centre would hit. */
async function expectWholeAndOnTop(target: Locator) {
  await target.evaluate((element) => element.scrollIntoView({ block: 'center', inline: 'nearest' }));
  const result = await target.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return {
      inside: box.left >= 0 && box.right <= document.documentElement.clientWidth && box.width > 0 && box.height > 0,
      onTop: hit !== null && (hit === element || element.contains(hit)),
    };
  });
  expect(result).toEqual({ inside: true, onTop: true });
}

async function tabUntil(page: Page, target: Locator, limit = 60) {
  for (let step = 0; step < limit; step += 1) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((element) => element === document.activeElement)) return step + 1;
  }
  throw new Error(`Not reached in ${limit} Tab presses`);
}

test.describe('reduced motion', () => {
  /** Counts `Element.animate` and `document.startViewTransition` calls from the first script on. */
  async function recordMotion(page: Page) {
    await page.addInitScript(() => {
      const motion = { animate: 0, viewTransitions: 0 };
      Object.assign(window, { __motion: motion });
      const animate = Element.prototype.animate;
      Element.prototype.animate = function counted(this: Element, ...args: Parameters<Element['animate']>) {
        motion.animate += 1;
        return animate.apply(this, args);
      };
      const start = document.startViewTransition?.bind(document);
      if (start) {
        document.startViewTransition = ((update?: ViewTransitionUpdateCallback) => {
          motion.viewTransitions += 1;
          return start(update);
        }) as typeof document.startViewTransition;
      }
    });
    return () => page.evaluate(() => (window as unknown as { __motion: { animate: number; viewTransitions: number } }).__motion);
  }

  async function changeScreenThenTheme(page: Page) {
    await installSyntheticApi(page);
    await page.goto('/nodes/lnd-lab');
    await expect(page.getByRole('heading', { name: 'LND lab' })).toBeVisible();
    const nav = isPhone(page) ? 'Sections' : 'Node sections';
    await page.getByRole('navigation', { name: nav }).getByRole('link', { name: isPhone(page) ? 'More' : 'Channels' }).click();
    await expect(page.getByRole('radiogroup', { name: 'Theme' })).toBeVisible();
    await page.getByRole('radiogroup', { name: 'Theme' }).getByRole('radio', { name: 'Light' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  }

  test('reduce: no screen animation and no view transition', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const motion = await recordMotion(page);
    await changeScreenThenTheme(page);
    expect(await motion()).toEqual({ animate: 0, viewTransitions: 0 });
  });

  test('no preference: the screen change animates and the theme crossfades once', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const motion = await recordMotion(page);
    await changeScreenThenTheme(page);
    const counted = await motion();
    expect(counted.animate).toBeGreaterThan(0);
    expect(counted.viewTransitions).toBe(1);
  });
});

test.describe('forced colors', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await installSyntheticApi(page);
  });

  test('the review keeps its text and its primary action visible and focusable with a ring', async ({ page }) => {
    await page.goto(REVIEW_PATH);
    const pay = page.getByRole('button', { name: 'Pay with passkey' });
    await expect(pay).toBeVisible();
    await expect(page.getByText('2,500 sat').first()).toBeVisible();
    const colors = await pay.evaluate((element) => {
      const style = getComputedStyle(element);
      return { text: style.color, background: style.backgroundColor, border: parseFloat(style.borderTopWidth) };
    });
    expect(colors.text).not.toBe(colors.background);
    expect(colors.border).toBeGreaterThan(0);

    await pay.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    const ring = await pay.evaluate((element) => getComputedStyle(element).outlineStyle);
    expect(ring).not.toBe('none');
  });

  test('colour keys and state markers keep their fill, beside their words', async ({ page }) => {
    await page.goto('/nodes/lnd-lab');
    await expect(page.getByText('Confirmed', { exact: true })).toBeVisible();
    // Swatches and state markers opt out of forced colors; each keeps its fill and sits beside a word.
    const keys = await page.locator('body').evaluate((body) =>
      [...body.querySelectorAll('span')]
        .filter((element) => {
          const box = element.getBoundingClientRect();
          return box.width > 1 && box.width <= 12 && getComputedStyle(element).forcedColorAdjust === 'none';
        })
        .map((element) => {
          let holder = element.parentElement;
          while (holder && !(holder.textContent ?? '').trim()) holder = holder.parentElement;
          return { background: getComputedStyle(element).backgroundColor, word: (holder?.textContent ?? '').trim().slice(0, 30) };
        }),
    );
    // Balance keys (4), the online marker, the unresolved marker and the payment state marker.
    expect(keys.length).toBeGreaterThanOrEqual(7);
    expect(keys.filter((key) => key.background === 'rgba(0, 0, 0, 0)' || key.word === '')).toEqual([]);
  });
});

test.describe('200% zoom', () => {
  // 200% zoom halves the CSS viewport: 1280×800 becomes 640×400 (the phone shell, with its tab bar).
  test.use({ viewport: { width: 640, height: 400 } });

  for (const [path, action] of [
    ['/nodes/lnd-lab', { role: 'link', name: 'Pay invoice' }],
    ['/nodes/lnd-lab/payments', { role: 'link', name: 'Pay invoice' }],
    ['/nodes/lnd-lab/channels', { role: 'link', name: 'Open channel…' }],
    ['/nodes/lnd-lab/onchain/send', { role: 'button', name: 'Review send' }],
    [REVIEW_PATH, { role: 'button', name: 'Pay with passkey' }],
    ['/login', { role: 'button', name: 'Continue with passkey' }],
  ] as const) {
    test(`${path}: no horizontal overflow and the primary action is whole`, async ({ page }) => {
      await installSyntheticApi(page);
      await page.goto(path);
      const primary = page.getByRole(action.role, { name: action.name, exact: true }).first();
      await expect(primary).toBeVisible();
      await page.waitForLoadState('networkidle');
      await expectNoHorizontalOverflow(page);
      await expectWholeAndOnTop(primary);
    });
  }
});

test('shortened identifiers in list rows stay on one line, even beside an open inspector', async ({ page }) => {
  await installSyntheticApi(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/nodes/lnd-lab/channels?selected=channel-synthetic-remainder');
  const links = page.getByRole('link', { name: /^Open channel / });
  await expect(links).toHaveCount(3);
  const lineBoxes = await links.evaluateAll((elements) => elements.map((element) => element.getClientRects().length));
  expect(lineBoxes).toEqual([1, 1, 1]);
});

test.describe('keyboard', () => {
  test('the skip link is the first stop and moves focus to the content', async ({ page }) => {
    await installSyntheticApi(page);
    await page.goto('/nodes/lnd-lab');
    await expect(page.getByRole('heading', { name: 'LND lab' })).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('main')).toBeFocused();
  });

  test('Tab reaches the review primary action; the palette returns focus to it; nothing is sent', async ({ page }) => {
    const requests = await installSyntheticApi(page);
    await page.goto(REVIEW_PATH);
    const pay = page.getByRole('button', { name: 'Pay with passkey' });
    await expect(pay).toBeVisible();
    await expect(pay).not.toBeFocused();

    await tabUntil(page, pay);
    await page.keyboard.press('ControlOrMeta+k');
    const palette = page.getByRole('dialog', { name: 'Go to' });
    await expect(palette).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(palette).toBeHidden();
    await expect(pay).toBeFocused();
    // The review's invoice re-check (decode) is a read; nothing authorizes or confirms.
    expect(requests.filter((request) => /\/(authorize|confirm)$/.test(request.path))).toEqual([]);
  });

  test('every control on a form is reachable by Tab, in reading order, to the submit', async ({ page }) => {
    await installSyntheticApi(page);
    await page.goto('/nodes/lnd-lab/channels/new');
    const submit = page.getByRole('button', { name: 'Review channel open' });
    await expect(submit).toBeVisible();
    const order: string[] = [];
    for (let step = 0; step < 60; step += 1) {
      await page.keyboard.press('Tab');
      const label = await page.evaluate(() => {
        const element = document.activeElement;
        if (!element?.closest('main')) return null;
        const label = element instanceof HTMLInputElement ? element.labels?.[0]?.textContent : null;
        return element.getAttribute('aria-label') ?? label ?? element.textContent ?? '';
      });
      if (label !== null) order.push(label.trim());
      if (await submit.evaluate((element) => element === document.activeElement)) break;
    }
    expect(order.at(-1)).toBe('Review channel open');
    const peer = order.findIndex((label) => label.startsWith('Peer public key'));
    const amount = order.findIndex((label) => label.startsWith('Channel size'));
    const feeRate = order.findIndex((label) => label.startsWith('Fee rate'));
    expect(peer).toBeGreaterThanOrEqual(0);
    expect(amount).toBeGreaterThan(peer);
    expect(feeRate).toBeGreaterThan(amount);
  });
});

test.describe('phone targets', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const path of [
    '/nodes/lnd-lab',
    '/nodes/lnd-lab/payments',
    '/nodes/lnd-lab/invoices',
    '/nodes/lnd-lab/onchain',
    '/nodes/lnd-lab/channels',
    '/nodes/lnd-lab/peers',
    '/nodes/lnd-lab/operations',
    '/nodes/lnd-lab/onchain/send',
    '/nodes/lnd-lab/peers/new',
    REVIEW_PATH,
    '/fleet',
    '/more',
    '/login',
  ]) {
    test(`${path}: every control is at least 44px tall`, async ({ page }) => {
      await installSyntheticApi(page);
      await page.goto(path);
      await expect(page.locator('main').first()).toBeVisible();
      await page.waitForLoadState('networkidle');
      const small = await page.evaluate((min) => {
        const controls = document.querySelectorAll(
          'a[href], button, input:not([type="hidden"]), select, textarea, [role="radio"], [role="tab"]',
        );
        return [...controls]
          .filter((element) => {
            const style = getComputedStyle(element);
            const box = element.getBoundingClientRect();
            return box.width > 1 && box.height > 1 && style.visibility !== 'hidden';
          })
          .map((element) => {
            // A row's primary link covers its whole row; the row is the target.
            const area = element.hasAttribute('data-row-primary') ? (element.closest('li') ?? element) : element;
            const box = area.getBoundingClientRect();
            return { name: (element.getAttribute('aria-label') ?? element.textContent ?? '').trim().slice(0, 40), height: Math.round(box.height) };
          })
          .filter((target) => target.height < min);
      }, MIN_TOUCH_PX);
      // The skip link is off-screen until focused; it has the same size when shown.
      expect(small.filter((target) => target.name !== 'Skip to content')).toEqual([]);
    });
  }

  test('a second link in a phone row keeps its words apart at touch size', async ({ page }) => {
    await installSyntheticApi(page);
    await page.goto('/fleet');
    const unresolved = page.getByRole('main').getByRole('link', { name: '1 unresolved' });
    await expect(unresolved).toBeVisible();
    expect(await unresolved.evaluate((element) => (element as HTMLElement).innerText)).toBe('1 unresolved');
    expect((await unresolved.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(MIN_TOUCH_PX);
  });

  test('the skip link is a full target when it shows', async ({ page }) => {
    await installSyntheticApi(page);
    await page.goto('/nodes/lnd-lab');
    await expect(page.getByRole('heading', { name: 'LND lab' })).toBeVisible();
    await page.keyboard.press('Tab');
    const box = await page.getByRole('link', { name: 'Skip to content' }).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(MIN_TOUCH_PX);
  });

  test('the review primary action still clears the tab bar', async ({ page }) => {
    await installSyntheticApi(page);
    await page.goto(REVIEW_PATH);
    const pay = page.getByRole('button', { name: 'Pay with passkey' });
    await expect(pay).toBeVisible();
    const tabs = await page.getByRole('navigation', { name: 'Sections' }).boundingBox();
    const action = await pay.boundingBox();
    if (!tabs || !action) throw new Error('Missing geometry');
    expect(action.y + action.height).toBeLessThan(tabs.y - TAB_BAR_CLEARANCE_PX);
  });
});
