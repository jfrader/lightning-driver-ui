import { expect, test, type Page } from '@playwright/test';
import { installSyntheticApi, type RecordedRequest } from './synthetic-api';

const MALFORMED_ERROR = 'Use digits and a decimal point only, without spaces or commas.';
const MALFORMED = ['1,2', '1 2', '1,000', '12,345.67', '1.2.3', '-5', '+5', '1e3', '١٢', '1٫5', '١٢٣٫٤'];

const amountField = (page: Page, unit = 'sat') => page.getByLabel(new RegExp(`^Amount \\(${unit}\\)`));
const unitChoice = (page: Page, unit: 'sat' | 'BTC') =>
  page.getByRole('radiogroup', { name: 'Amount unit' }).getByRole('radio', { name: unit });
const creates = (requests: RecordedRequest[]) => requests.filter((r) => r.path.endsWith('/operations'));

for (const width of [390, 1440]) {
  test(`@layout amount inputs align with their units at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installSyntheticApi(page);
    for (const [path, label] of [
      ['/nodes/lnd-lab?send=1&action=send_onchain', 'Amount'],
      ['/nodes/lnd-lab?receive=1&action=create_invoice', 'Amount'],
      ['/nodes/lnd-lab/channels/new', 'Channel size'],
    ] as const) {
      await page.goto(path);
      const input = page.getByRole('textbox', { name: new RegExp(`^${label} \\(sat\\)`) });
      await expect(input).toBeVisible();
      await input.fill('10000');
      await page.evaluate(() => document.fonts.ready);
      await expect.poll(async () => input.evaluate((element) => {
        const group = element.closest('[data-ui="text-field"]')!.parentElement!.querySelector('[role="radiogroup"]')!;
        const a = element.getBoundingClientRect();
        const b = group.getBoundingClientRect();
        return Math.max(Math.abs(a.top - b.top), Math.abs(a.bottom - b.bottom));
      })).toBeLessThanOrEqual(1);
      await expect.poll(async () => input.evaluate((element) => {
        const radio = element.closest('[data-ui="text-field"]')!.parentElement!.querySelector('[role="radio"]')!;
        const text = radio.querySelector('span[id]')!;
        const marker = document.createElement('span');
        marker.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
        text.append(marker);
        const radioBaseline = marker.getBoundingClientRect().top;
        marker.remove();
        const canvas = document.createElement('canvas').getContext('2d')!;
        canvas.font = getComputedStyle(element).font;
        const metrics = canvas.measureText('10000');
        const rect = element.getBoundingClientRect();
        const inputBaseline = rect.top + rect.height / 2 + (metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) / 2;
        return Math.abs(inputBaseline - radioBaseline);
      })).toBeLessThanOrEqual(1);
    }
  });
}

async function openReceive(page: Page): Promise<RecordedRequest[]> {
  const requests = await installSyntheticApi(page);
  await page.goto('/nodes/lnd-lab/invoices/new');
  await expect(amountField(page)).toBeVisible();
  return requests;
}

for (const [method, enter] of [
  ['typing', (page: Page, text: string) => page.keyboard.type(text)],
  ['inserting text', (page: Page, text: string) => page.keyboard.insertText(text)],
] as const) {
  test.describe(`malformed amounts by ${method}`, () => {
    for (const text of MALFORMED) {
      test(`keeps ${JSON.stringify(text)} as entered and sends nothing`, async ({ page }) => {
        const requests = await openReceive(page);
        await amountField(page).click();
        await enter(page, text);

        await expect(amountField(page)).toHaveValue(text);
        await page.getByRole('dialog').getByRole('button', { name: 'Create invoice', exact: true }).click();

        await expect(page.getByText(MALFORMED_ERROR)).toBeVisible();
        expect(requests).toEqual([]);
      });
    }
  });
}

test('keeps a pasted malformed amount as pasted and sends nothing', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const requests = await openReceive(page);
  await page.evaluate(() => navigator.clipboard.writeText('1,234.5'));
  await amountField(page).click();
  await page.keyboard.press('ControlOrMeta+V');

  await expect(amountField(page)).toHaveValue('1,234.5');
  await page.getByRole('dialog').getByRole('button', { name: 'Create invoice', exact: true }).click();
  await expect(page.getByText(MALFORMED_ERROR)).toBeVisible();
  expect(requests).toEqual([]);
});

test('keeps every digit of a large amount through editing, arrow keys, blur and unit switches', async ({ page }) => {
  const requests = await openReceive(page);
  const field = amountField(page);
  await field.click();
  await page.keyboard.type('9007199254740.99');
  await page.keyboard.press('ArrowUp');
  await expect(field).toHaveValue('9007199254740.99');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(field).toHaveValue('9007199254740.99');
  await page.keyboard.press('End');
  await page.keyboard.type('4');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('3');
  await expect(field).toHaveValue('9007199254740.993');

  await page.keyboard.press('Tab');
  await expect(field).toHaveValue('9007199254740.993');

  await unitChoice(page, 'BTC').click();
  await expect(amountField(page, 'BTC')).toHaveValue('90071.99254740993');
  await unitChoice(page, 'sat').click();
  await expect(amountField(page)).toHaveValue('9007199254740.993');

  await page.getByRole('dialog').getByRole('button', { name: 'Create invoice', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Invoice operation' })).toBeVisible();

  expect(creates(requests)).toEqual([
    {
      method: 'POST',
      path: '/nodes/lnd-lab/operations',
      body: { kind: 'create_invoice', params: { amount_msat: '9007199254740993', description: '', expiry_seconds: 3600 } },
    },
  ]);
});

test('keeps a pasted large amount exact', async ({ page }) => {
  const requests = await openReceive(page);
  await amountField(page).click();
  await page.keyboard.insertText('9007199254740.993');
  await page.keyboard.press('ArrowUp');
  await expect(amountField(page)).toHaveValue('9007199254740.993');

  await page.getByRole('dialog').getByRole('button', { name: 'Create invoice', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Invoice operation' })).toBeVisible();
  expect(creates(requests).map((r) => r.body)).toEqual([
    { kind: 'create_invoice', params: { amount_msat: '9007199254740993', description: '', expiry_seconds: 3600 } },
  ]);
});

test('refuses to change the unit of an invalid amount', async ({ page }) => {
  await openReceive(page);
  await amountField(page).click();
  await page.keyboard.type('0.1234');

  await unitChoice(page, 'BTC').click();

  await expect(amountField(page)).toHaveValue('0.1234');
  await expect(page.getByText('Correct the amount before changing the unit.')).toBeVisible();
});

test.describe('whole satoshis on-chain', () => {
  async function fillSend(page: Page, amount: string) {
    const requests = await installSyntheticApi(page);
    await page.goto('/nodes/lnd-lab/onchain/send');
    await page.getByRole('textbox', { name: /^Address/ }).fill('SYNTHETIC_REGTEST_ADDRESS_NOT_SENDABLE');
    await amountField(page).click();
    await page.keyboard.type(amount);
    await page.getByLabel(/^Fee rate/).click();
    await page.keyboard.type('2');
    await page.getByRole('button', { name: 'Review send' }).click();
    return requests;
  }

  test('rejects a sub-satoshi amount', async ({ page }) => {
    const requests = await fillSend(page, '1.5');
    await expect(page.getByText('On-chain amounts are whole satoshis.')).toBeVisible();
    expect(requests).toEqual([]);
  });

  test('rejects an amount above the node policy with the policy bounds', async ({ page }) => {
    const requests = await fillSend(page, '100000001');
    await expect(page.getByText('Enter an amount from 1,000 sat to 100,000,000 sat.')).toBeVisible();
    expect(requests).toEqual([]);
  });

  test('sends one review for a valid whole amount', async ({ page }) => {
    const requests = await fillSend(page, '10000');
    await expect(page.getByRole('button', { name: 'Send with passkey' })).toBeVisible();
    expect(requests.map((r) => r.body)).toEqual([
      {
        kind: 'send_onchain',
        params: { address: 'SYNTHETIC_REGTEST_ADDRESS_NOT_SENDABLE', amount_sat: '10000', fee_rate_sat_vbyte: '2' },
      },
    ]);
  });
});
