import { describe, expect, it } from 'vitest';
import {
  budgetFromMeasurement,
  chartChunk,
  evaluateBudget,
  initialChunks,
  isChartModule,
  withoutChunkHashes,
} from './bundle-budget-lib.mjs';

const ROOT = '/repo';
const chunk = (fileName, overrides = {}) => ({
  fileName,
  isEntry: false,
  imports: [],
  facadeModuleId: null,
  moduleIds: [`${ROOT}/src/${fileName}.tsx`],
  gzipBytes: 0,
  ...overrides,
});

/** Entry with one statically imported vendor chunk, a lazy screen and the lazy chart chunk. */
function build({ entryBytes = 200_000, vendorBytes = 50_000, chartBytes = 80_000, chartInEntry = false } = {}) {
  return [
    chunk('index', {
      isEntry: true,
      imports: ['vendor'],
      gzipBytes: entryBytes,
      moduleIds: [`${ROOT}/src/main.tsx`, ...(chartInEntry ? [`${ROOT}/node_modules/recharts/es6/index.js`] : [])],
    }),
    chunk('vendor', { gzipBytes: vendorBytes, moduleIds: [`${ROOT}/node_modules/react-dom/index.js`] }),
    chunk('PaymentsPage', { imports: ['vendor'], gzipBytes: 1_000, facadeModuleId: `${ROOT}/src/features/payments/PaymentsPage.tsx` }),
    ...(chartInEntry
      ? []
      : [
          chunk('ShareBarChart', {
            gzipBytes: chartBytes,
            facadeModuleId: `${ROOT}/src/charts/ShareBarChart.tsx`,
            moduleIds: [`${ROOT}/src/charts/ShareBarChart.tsx`, `${ROOT}/node_modules/recharts/es6/index.js`],
          }),
        ]),
  ];
}

const BUDGET = { initialRouteGzipBytes: 250_000, chartChunkGzipBytes: 80_000 };

describe('initial route', () => {
  it('is the entry and its static imports, not lazy screens or the chart', () => {
    expect(initialChunks(build()).map((c) => c.fileName)).toEqual(['index', 'vendor']);
  });

  it('refuses a build without exactly one entry', () => {
    expect(() => initialChunks([chunk('a'), chunk('b')])).toThrow('Expected one entry chunk, found 0');
  });

  it('recognises the chart module and its library only', () => {
    expect(isChartModule(`${ROOT}/src/charts/ShareBarChart.tsx`)).toBe(true);
    expect(isChartModule(`${ROOT}/node_modules/recharts/es6/index.js`)).toBe(true);
    expect(isChartModule(`${ROOT}/src/components/ShareBar.tsx`)).toBe(false);
    expect(chartChunk(build())?.fileName).toBe('ShareBarChart');
  });
});

describe('measurement', () => {
  it('drops sibling chunk hashes so a rehash elsewhere does not move a size', () => {
    const names = ['assets/index-AbC123xY.js', 'assets/ShareBar-Zz_9-0aa.js'];
    const first = 'import{a}from"./index-AbC123xY.js";import("./ShareBar-Zz_9-0aa.js")';
    const rehashed = 'import{a}from"./index-QqQqQqQq.js";import("./ShareBar-Zz_9-0aa.js")';
    expect(withoutChunkHashes(first, names)).toBe('import{a}from"./index.js";import("./ShareBar.js")');
    expect(withoutChunkHashes(rehashed, ['assets/index-QqQqQqQq.js', names[1]])).toBe(withoutChunkHashes(first, names));
  });
});

describe('budget gate', () => {
  it('passes at exactly the budget', () => {
    const result = evaluateBudget(build(), BUDGET);
    expect(result.initialGzipBytes).toBe(250_000);
    expect(result.failures).toEqual([]);
  });

  it('fails one byte over the initial-route budget, naming the overrun', () => {
    const result = evaluateBudget(build({ vendorBytes: 50_001 }), BUDGET);
    expect(result.failures).toEqual(['Initial route is 250001 B gzip, over the budget of 250000 B by 1 B.']);
  });

  it('fails when the entry imports the chart module, even within the byte budget', () => {
    const result = evaluateBudget(build({ entryBytes: 100_000, chartInEntry: true }), BUDGET);
    expect(result.failures).toEqual([
      `The initial route imports the chart module through index: ${ROOT}/node_modules/recharts/es6/index.js.`,
      'No separate chart chunk: the chart module must load lazily, on first chart render.',
    ]);
  });

  it('fails when the chart chunk grows past its own budget', () => {
    const result = evaluateBudget(build({ chartBytes: 80_500 }), BUDGET);
    expect(result.failures).toEqual(['Chart chunk is 80500 B gzip, over the budget of 80000 B by 500 B.']);
  });

  it('records the measurement itself as the next budget, with no headroom', () => {
    expect(budgetFromMeasurement(evaluateBudget(build(), BUDGET))).toEqual(BUDGET);
  });
});
