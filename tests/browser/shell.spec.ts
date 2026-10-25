import { expect, test, type Page } from '@playwright/test';
import { fixture, installSyntheticApi } from './synthetic-api';
import { doubleText } from './text-size';

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 1024;

test('@layout missing-node recovery is touch-sized and opens the fleet', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await installSyntheticApi(page);
  for (const enlarged of [false, true]) {
    await page.goto('/nodes/unconfigured-synthetic-node');
    await expect(page.getByRole('heading', { name: 'Node not found', exact: true })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Sections', exact: true }).getByRole('link', { name: /^(Overview|Wallet|Channels)$/ })).toHaveCount(0);
    if (enlarged) await doubleText(page);
    const recovery = page.getByRole('link', { name: 'Open fleet', exact: true });
    const box = await recovery.boundingBox();
    if (!box) throw new Error('Missing node recovery geometry');
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    await recovery.click();
    await expect(page.getByRole('heading', { name: 'Fleet', exact: true })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Sections', exact: true }).getByRole('link', { name: /^(Overview|Wallet|Channels)$/ })).toHaveCount(0);
  }
});

test('phone node choices have usable targets and keyboard selection reaches the fleet', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installSyntheticApi(page);
  await page.goto('/nodes/lnd-lab');
  const chooser = page.getByRole('combobox', { name: 'Node' });
  await chooser.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('option', { name: 'All nodes', exact: true })).toBeVisible();
  for (const option of await page.getByRole('option').all()) {
    const box = await option.boundingBox();
    if (!box) throw new Error('Missing node choice geometry');
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Fleet', exact: true })).toBeVisible();
});

test('@layout enlarged Lightning header controls remain separate and quick actions show their full labels', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await installSyntheticApi(page);
  const node = { ...fixture('node_lnd'), unresolved_operation_count: '9007199254740993' };
  await page.route('**/api/v1/nodes/lnd-lab', route => route.fulfill({ json: node }));
  await page.goto('/nodes/lnd-lab');
  await expect(page.getByRole('heading', { name: 'Balances', exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await doubleText(page);
  const chooser = page.getByRole('combobox', { name: 'Node' });
  const unresolved = page.getByRole('link', { name: /unresolved$/, exact: false }).first();
  await expectNoHorizontalOverflow(page, 1);
  const first = await chooser.boundingBox();
  const second = await unresolved.boundingBox();
  if (!first || !second) throw new Error('Missing header control geometry');
  expect(first.x + first.width <= second.x || second.x + second.width <= first.x || first.y + first.height <= second.y || second.y + second.height <= first.y, 'header targets must not overlap').toBe(true);
  for (const control of [chooser, unresolved, page.getByRole('link', { name: 'Pay invoice', exact: true }), page.getByRole('link', { name: 'Receive', exact: true })]) {
    await control.scrollIntoViewIfNeeded();
    const usable = await control.evaluate(element => {
      const r = element.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      const range = document.createRange();
      range.selectNodeContents(element);
      const text = range.getBoundingClientRect();
      return (hit === element || element.contains(hit)) && text.left >= r.left - 1 && text.right <= r.right + 1 && text.top >= r.top - 1 && text.bottom <= r.bottom + 1;
    });
    expect(usable, await control.textContent() ?? 'control').toBe(true);
  }
});

test('@layout keyboard-focused phone actions stay visible inside the sheet at enlarged text size', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installSyntheticApi(page);
  await page.goto('/nodes/lnd-lab/invoices/new');
  await expect(page.getByRole('button', { name: 'Review invoice' })).toBeVisible();
  await doubleText(page);
  const submit = page.getByRole('button', { name: 'Review invoice' });
  for (let step = 0; step < 20 && !await submit.evaluate(el => el === document.activeElement); step++) {
    await page.keyboard.press('Tab');
    await expect.poll(async () => page.evaluate(() => {
      const el = document.activeElement;
      if (!el?.closest('dialog') || !el.matches('a,button,input,select,textarea')) return true;
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return r.top >= 0 && r.bottom <= innerHeight && (hit === el || el.contains(hit));
    })).toBe(true);
  }
  await expect(submit).toBeFocused();
  const action = await submit.boundingBox();
  if (!action) throw new Error('Missing focused control geometry');
  expect(action.y + action.height, 'tab navigation must reveal the entire focused action').toBeLessThanOrEqual(page.viewportSize()!.height);
});

test('@layout enlarged desktop preferences stay inside the rail instead of covering the workspace', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await installSyntheticApi(page);
  await page.goto('/nodes/lnd-lab/invoices');
  await expect(page.getByRole('heading', { name: 'Invoices', exact: true })).toBeVisible();
  await doubleText(page);
  const rail = await page.getByRole('complementary', { name: 'Node and sections' }).boundingBox();
  if (!rail) throw new Error('Missing rail geometry');
  const controls = [...await page.getByRole('radiogroup', { name: 'Theme' }).getByRole('radio').all(), page.getByRole('button', { name: 'Sign out' })];
  for (const control of controls) {
    const box = await control.boundingBox();
    if (!box) throw new Error('Missing rail control');
    expect.soft(box.x + box.width, await control.textContent() ?? 'rail control').toBeLessThanOrEqual(rail.x + rail.width);
  }
  const stripControls = [
    page.getByRole('link', { name: '1 unresolved', exact: true }),
    ...await page.getByRole('radiogroup', { name: 'Display unit' }).getByRole('radio').all(),
    page.getByRole('button', { name: /^Go to/ }),
  ];
  for (const control of stripControls) {
    const usable = await control.evaluate(element => {
      const box = element.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(element);
      const text = range.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return (hit === element || element.contains(hit)) && text.left >= box.left - 1 && text.right <= box.right + 1 && text.top >= box.top - 1 && text.bottom <= box.bottom + 1;
    });
    expect.soft(usable, await control.textContent() ?? 'strip control').toBe(true);
  }
});

async function expectNoHorizontalOverflow(page: Page, tolerance = 0) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(tolerance);
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

test('the phone sheet primary action is unobscured when scrolled to the end', async ({ page }) => {
  test.skip(!isPhone(page), 'phone shell only');
  await installSyntheticApi(page);
  await page.goto('/nodes/lnd-lab/invoices/new');
  const submit = page.getByRole('button', { name: 'Review invoice' });
  await expect(submit).toBeVisible();
  await submit.scrollIntoViewIfNeeded();
  const action = await submit.boundingBox();
  if (!action) throw new Error('Missing geometry');
  expect(action.y + action.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  expect(await submit.evaluate(element => {
    const box = element.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return hit === element || element.contains(hit);
  })).toBe(true);
});

test('the palette opens with the keyboard, traps focus and returns it on close', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installSyntheticApi(page);
  await page.goto('/nodes/lnd-lab');
  await expect(page.getByRole('heading', { name: 'LND lab' })).toBeVisible();
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await page.keyboard.press('Tab');
  await expect(skip).toBeFocused();

  await page.keyboard.press('Control+k');
  const dialog = page.getByRole('dialog', { name: 'Go to' });
  await expect(dialog).toBeVisible();
  if (isPhone(page)) {
    const options = await dialog.getByRole('option').evaluateAll(elements => elements.map(element => {
      const { width, height } = element.getBoundingClientRect();
      return { width, height };
    }));
    expect(options.length).toBeGreaterThan(0);
    for (const option of options) {
      expect(option.width).toBeGreaterThanOrEqual(44);
      expect(option.height).toBeGreaterThanOrEqual(44);
    }
  }
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

test('@layout every status strip control shares one height and baseline', async ({ page }) => {
  await installSyntheticApi(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/nodes/lnd-lab');
  await expect(page.getByRole('main')).toBeVisible();
  await page.waitForTimeout(300);
  const heights = await page.evaluate(() => {
    const strip = [...document.querySelectorAll('div')].find((element) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return style.position === 'sticky' && box.top <= 1 && box.height < 120;
    });
    if (!strip) return [];
    return [...strip.querySelectorAll('button, a, [role="radiogroup"]')]
      .map((element) => element.getBoundingClientRect())
      .filter((box) => box.height >= 18)
      .map((box) => Math.round(box.height));
  });
  expect(heights.length).toBeGreaterThan(4);
  expect(new Set(heights)).toEqual(new Set([40]));
});
