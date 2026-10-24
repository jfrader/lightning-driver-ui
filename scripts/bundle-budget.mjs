// Builds the app, measures the initial route and the chart chunk (gzip level 9, chunk-name hashes
// removed so sizes do not move when an unrelated chunk is rehashed), and compares them
// with bundle-budget.json. Allows initial-route growth of 0.5% (at least 1 kB); fails when the chart chunk
// grows past its budget, or when the chart module loads with the initial route.
//
//   npm run budget                 check against the committed budget
//   npm run budget -- --record     write the measured values as the new budget
//   npm run budget -- --top 25     also list the largest modules of the initial route
import { readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { build } from 'vite';
import { budgetFromMeasurement, evaluateBudget, initialRouteLimit, withoutChunkHashes } from './bundle-budget-lib.mjs';

const BUDGET_FILE = new URL('../bundle-budget.json', import.meta.url);
const GZIP_LEVEL = 9;

const args = process.argv.slice(2);
const record = args.includes('--record');
const topIndex = args.indexOf('--top');
const top = topIndex === -1 ? 0 : Number(args[topIndex + 1]);

const bytes = new Intl.NumberFormat('en-US');
const kb = (value) => `${bytes.format(value)} B (${(value / 1000).toFixed(2)} kB)`;

const result = await build({ logLevel: 'warn' });
const emitted = (Array.isArray(result) ? result[0] : result).output.filter((item) => item.type === 'chunk');
const fileNames = emitted.map((chunk) => chunk.fileName);
const chunks = emitted.map((chunk) => ({
  fileName: chunk.fileName,
  isEntry: chunk.isEntry,
  imports: chunk.imports,
  facadeModuleId: chunk.facadeModuleId,
  moduleIds: chunk.moduleIds,
  modules: chunk.modules,
  gzipBytes: gzipSync(withoutChunkHashes(chunk.code, fileNames), { level: GZIP_LEVEL }).length,
}));

const budget = record ? null : JSON.parse(await readFile(BUDGET_FILE, 'utf8'));
const measured = evaluateBudget(chunks, budget ?? { initialRouteGzipBytes: Infinity, chartChunkGzipBytes: Infinity });

console.log(`Initial route (entry + static imports, gzip -${GZIP_LEVEL}):`);
for (const chunk of measured.initial) console.log(`  ${chunk.fileName}  ${kb(chunk.gzipBytes)}`);
console.log(`  total  ${kb(measured.initialGzipBytes)}${budget ? `  budget ${kb(budget.initialRouteGzipBytes)}` : ''}`);
if (budget) console.log(`  tolerated limit  ${kb(initialRouteLimit(budget.initialRouteGzipBytes))} (0.5% growth, 1 kB floor)`);
console.log(
  `Chart chunk: ${measured.chart ? `${measured.chart.fileName}  ${kb(measured.chart.gzipBytes)}` : 'none'}${budget ? `  budget ${kb(budget.chartChunkGzipBytes)}` : ''}`,
);
const lazy = chunks.filter((chunk) => !measured.initial.includes(chunk) && chunk !== measured.chart);
const lazyLargest = lazy.reduce((max, chunk) => (chunk.gzipBytes > (max?.gzipBytes ?? -1) ? chunk : max), null);
console.log(`Lazy chunks: ${lazy.length}, largest ${lazyLargest ? `${lazyLargest.fileName}  ${kb(lazyLargest.gzipBytes)}` : 'none'}`);

if (top > 0) {
  const modules = measured.initial
    .flatMap((chunk) => Object.entries(chunk.modules).map(([id, info]) => ({ id, length: info.renderedLength })))
    .sort((a, b) => b.length - a.length)
    .slice(0, top);
  console.log(`Largest ${top} modules of the initial route (minified, before gzip):`);
  for (const module of modules) console.log(`  ${bytes.format(module.length).padStart(9)}  ${module.id.replace(process.cwd(), '.')}`);
}

if (record) {
  const next = budgetFromMeasurement(measured);
  await writeFile(BUDGET_FILE, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`Recorded ${new URL(BUDGET_FILE).pathname}: ${JSON.stringify(next)}`);
  // Recording never hides a structural failure.
  if (measured.failures.length > 0) {
    for (const failure of measured.failures) console.error(`FAIL ${failure}`);
    process.exit(1);
  }
} else if (measured.failures.length > 0) {
  for (const failure of measured.failures) console.error(`FAIL ${failure}`);
  process.exit(1);
} else {
  console.log('Bundle budget: within budget.');
}
