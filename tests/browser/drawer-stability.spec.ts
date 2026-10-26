import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { installSyntheticApi } from './synthetic-api';

type Transition = {
  start: number;
  retained: { id: number; tag: string; ui: string | null }[];
  mutations: { time: number; action: string; id: number; tag: string; ui: string | null; dialogs: number }[];
  frames: { time: number; url: string; dialogs: number[]; forms: number[]; text: string[]; rects: { x: number; y: number; width: number; height: number }[] }[];
  shifts: { time: number; value: number }[];
  longTasks: { time: number; duration: number }[];
};

declare global {
  interface Window {
    drawerTransition: Transition;
    startDrawerTransition: () => void;
  }
}

const surfaces = [
  { path: 'channels', trigger: 'Open channel…' },
  { path: 'payments', trigger: 'Pay invoice' },
  { path: 'onchain', trigger: 'New address' },
];
const MAX_LAYOUT_SHIFT = 0.01;

for (const width of [1440, 390]) {
  for (const surface of surfaces) {
    test(`${surface.path} action surface keeps its mounted identity at ${width}`, async ({ page }) => {
      const money = surface.path !== 'channels';
      const popover = money && width >= 1024;
      await page.setViewportSize({ width, height: 900 });
      await installSyntheticApi(page);
      await page.addInitScript(() => {
        let sequence = 0;
        const ids = new WeakMap<Element, number>();
        const identity = (element: Element) => {
          if (!ids.has(element)) ids.set(element, ++sequence);
          return ids.get(element)!;
        };
        let active = false;
        const time = () => performance.now() - window.drawerTransition.start;
        const observer = new MutationObserver((records) => {
          if (!active) return;
          for (const record of records) {
            for (const [action, nodes] of [['mount', record.addedNodes], ['unmount', record.removedNodes]] as const) {
              for (const node of nodes) {
                if (!(node instanceof Element)) continue;
                const selector = '[data-ui], form, dialog, [role="dialog"]';
                const elements = [...(node.matches(selector) ? [node] : []), ...node.querySelectorAll(selector)];
                for (const element of elements) window.drawerTransition.mutations.push({
                  time: time(), action, id: identity(element), tag: element.tagName,
                  ui: element.getAttribute('data-ui'), dialogs: document.querySelectorAll('dialog[open], [role="dialog"]').length,
                });
              }
            }
          }
        });
        observer.observe(document, { childList: true, subtree: true });
        new PerformanceObserver((list) => {
          if (active) for (const entry of list.getEntries()) {
            if (entry.startTime >= window.drawerTransition.start && 'value' in entry) {
              window.drawerTransition.shifts.push({ time: entry.startTime - window.drawerTransition.start, value: Number(entry.value) });
            }
          }
        }).observe({ type: 'layout-shift', buffered: true });
        new PerformanceObserver((list) => {
          if (active) for (const entry of list.getEntries()) {
            if (entry.startTime >= window.drawerTransition.start) window.drawerTransition.longTasks.push({ time: entry.startTime - window.drawerTransition.start, duration: entry.duration });
          }
        }).observe({ type: 'longtask', buffered: true });
        window.startDrawerTransition = () => {
          observer.takeRecords();
          const retained = [...document.querySelectorAll('dialog, [data-ui="morph-surface"], [data-ui$="-panel"], [data-ui$="-body"]')].map(element => ({ id: identity(element), tag: element.tagName, ui: element.getAttribute('data-ui') }));
          window.drawerTransition = { start: performance.now(), retained, mutations: [], frames: [], shifts: [], longTasks: [] };
          active = true;
          const sample = () => {
            const dialogs = [...document.querySelectorAll('dialog[open], [role="dialog"]')];
            window.drawerTransition.frames.push({
              time: time(), url: location.href, dialogs: dialogs.map(identity), forms: [...document.querySelectorAll('dialog[open] form, [role="dialog"] form')].map(identity),
              text: dialogs.map((element) => element.textContent ?? ''),
              rects: dialogs.map((element) => {
                const { x, y, width, height } = (element.querySelector('[data-ui$="-panel"]') ?? element).getBoundingClientRect();
                return { x, y, width, height };
              }),
            });
            if (time() < 1000) requestAnimationFrame(sample);
            else active = false;
          };
          requestAnimationFrame(sample);
        };
      });
      const warnings: string[] = [];
      const errors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'warning') warnings.push(message.text());
        if (message.type() === 'error') errors.push(message.text());
      });
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`/nodes/lnd-lab/${surface.path}`);
      const trigger = page.getByRole(money ? 'button' : 'link', { name: surface.trigger, exact: true });
      await expect(trigger).toBeVisible();
      await page.waitForLoadState('networkidle');
      const box = await trigger.boundingBox();
      if (!box) throw new Error('Missing drawer trigger');
      const phase = process.env.DRAWER_EVIDENCE_PHASE;
      const directory = join(process.env.DRAWER_EVIDENCE_DIR ?? test.info().outputPath('frames'), phase ?? 'test', `${surface.path}-${width}`);
      if (phase) await mkdir(directory, { recursive: true });
      await page.evaluate(() => {
        document.addEventListener('click', () => window.startDrawerTransition(), { capture: true, once: true });
      });
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      const screenshots: { file: string; time: number }[] = [];
      if (phase) {
        const started = Date.now();
        for (let frame = 0; Date.now() - started < 800; frame++) {
          const file = `${String(frame).padStart(3, '0')}.png`;
          const time = await page.evaluate(() => performance.now() - window.drawerTransition.start);
          await page.screenshot({ path: `${directory}/${file}` });
          screenshots.push({ file, time });
          await page.waitForTimeout(Math.max(0, 30 - (Date.now() - started - frame * 30)));
        }
      }
      await expect(page.getByRole('dialog')).toHaveCount(1);
      await page.waitForTimeout(1100);
      const transition = await page.evaluate(() => window.drawerTransition);
      if (phase) await writeFile(`${directory}/timeline.json`, JSON.stringify({ ...transition, screenshots, warnings, errors }, null, 2));
      await test.info().attach('drawer-transition', { body: JSON.stringify({ ...transition, warnings, errors }), contentType: 'application/json' });
      const dialogIds = [...new Set(transition.frames.flatMap((frame) => frame.dialogs))];
      const formIds = [...new Set(transition.frames.flatMap((frame) => frame.forms))];
      const retained = money ? transition.retained : [];
      const expectStable = (matches: (entry: Transition['retained'][number]) => boolean, label: string) => {
        const elements = [...retained.filter(matches), ...transition.mutations.filter(entry => entry.action === 'mount' && matches(entry))];
        expect.soft([...new Set(elements.map(element => element.id))], `${label} has one retained or mounted identity`).toHaveLength(1);
        expect.soft(transition.mutations.filter(entry => entry.action === 'unmount' && elements.some(element => element.id === entry.id)), `${label} stays mounted`).toEqual([]);
      };
      expect.soft(dialogIds, 'one dialog identity throughout opening').toHaveLength(1);
      expectStable(entry => popover ? entry.ui === 'morph-surface' : entry.tag === 'DIALOG', 'dialog');
      expect.soft(formIds, 'one form identity throughout opening').toHaveLength(1);
      expectStable(entry => entry.tag === 'FORM', 'form');
      for (const slot of ['panel', 'body']) {
        const morphSlot = slot === 'panel' ? 'morph-surface' : 'morph-step';
        expectStable(entry => money && (popover || slot === 'body') ? entry.ui === morphSlot : entry.ui === `drawer-${slot}` || entry.ui === `bottom-sheet-${slot}`, slot);
      }
      const firstDialog = transition.frames.findIndex((frame) => frame.dialogs.length > 0);
      expect.soft(transition.frames.slice(firstDialog).every((frame) => frame.dialogs.length === 1), 'no missing or duplicate dialog after first mount').toBe(true);
      expect.soft(transition.frames.slice(firstDialog).every((frame) => frame.forms.length === 1), 'the form is ready in the first visible dialog frame').toBe(true);
      expect.soft(transition.mutations.filter((entry) => entry.ui === 'skeleton' && entry.action === 'mount'), 'no opening skeleton-to-form flash').toEqual([]);
      expect.soft(transition.shifts.filter((entry) => entry.value > MAX_LAYOUT_SHIFT), `no layout shift above ${MAX_LAYOUT_SHIFT}`).toEqual([]);
      expect.soft(errors).toEqual([]);
    });
  }
}
