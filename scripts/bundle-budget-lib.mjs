// Pure budget logic for scripts/bundle-budget.mjs, kept free of the build so it can be unit-tested.

/** Module ids that belong to the chart module and its library; none may load with the initial route. */
const CHART_MODULE = /[\\/](src[\\/]charts[\\/]|node_modules[\\/]recharts[\\/])/;

/**
 * Chunk code with the content hashes of sibling chunk file names removed (`index-AbC123xY.js` →
 * `index.js`). Chunks import each other by hashed name; without this, an unrelated change that
 * rehashes one chunk moves the gzip size of every chunk importing it by a byte or two.
 *
 * @param {string} code
 * @param {string[]} fileNames emitted chunk file names, e.g. `assets/index-AbC123xY.js`
 */
export function withoutChunkHashes(code, fileNames) {
  let normalised = code;
  for (const fileName of fileNames) {
    const base = fileName.split('/').pop();
    const stable = base.replace(/-[\w-]+(\.js)$/, '$1');
    if (stable !== base) normalised = normalised.replaceAll(base, stable);
  }
  return normalised;
}

export function isChartModule(id) {
  return CHART_MODULE.test(id);
}

/**
 * The chunks the browser loads before the first screen renders: the entry and, transitively, every
 * chunk it imports statically (Vite emits a modulepreload link for each of them).
 *
 * @param {{ fileName: string, isEntry: boolean, imports: string[] }[]} chunks
 */
export function initialChunks(chunks) {
  const byName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
  const entries = chunks.filter((chunk) => chunk.isEntry);
  if (entries.length !== 1) throw new Error(`Expected one entry chunk, found ${entries.length}`);
  const seen = new Set();
  const visit = (chunk) => {
    if (seen.has(chunk.fileName)) return;
    seen.add(chunk.fileName);
    for (const name of chunk.imports) {
      const imported = byName.get(name);
      if (imported) visit(imported);
    }
  };
  visit(entries[0]);
  return chunks.filter((chunk) => seen.has(chunk.fileName));
}

/** The lazily loaded chunk whose facade is the chart module, or `null` when it was not split out. */
export function chartChunk(chunks) {
  return chunks.find((chunk) => chunk.facadeModuleId !== null && isChartModule(chunk.facadeModuleId)) ?? null;
}

/**
 * Compares a measured build with the committed budget.
 *
 * @param {{ fileName: string, isEntry: boolean, imports: string[], facadeModuleId: string | null,
 *   moduleIds: string[], gzipBytes: number }[]} chunks
 * @param {{ initialRouteGzipBytes: number, chartChunkGzipBytes: number }} budget
 */
export function evaluateBudget(chunks, budget) {
  const initial = initialChunks(chunks);
  const initialGzipBytes = initial.reduce((sum, chunk) => sum + chunk.gzipBytes, 0);
  const chart = chartChunk(chunks);
  const failures = [];

  if (initialGzipBytes > budget.initialRouteGzipBytes) {
    failures.push(
      `Initial route is ${initialGzipBytes} B gzip, over the budget of ${budget.initialRouteGzipBytes} B by ${initialGzipBytes - budget.initialRouteGzipBytes} B.`,
    );
  }
  for (const chunk of initial) {
    const charts = chunk.moduleIds.filter(isChartModule);
    if (charts.length > 0) {
      failures.push(`The initial route imports the chart module through ${chunk.fileName}: ${charts.slice(0, 3).join(', ')}.`);
    }
  }
  if (chart === null) {
    failures.push('No separate chart chunk: the chart module must load lazily, on first chart render.');
  } else if (chart.gzipBytes > budget.chartChunkGzipBytes) {
    failures.push(
      `Chart chunk is ${chart.gzipBytes} B gzip, over the budget of ${budget.chartChunkGzipBytes} B by ${chart.gzipBytes - budget.chartChunkGzipBytes} B.`,
    );
  }

  return { initial, initialGzipBytes, chart, failures };
}

/** The measured values as a budget file body: the measurement itself, no headroom. */
export function budgetFromMeasurement(result) {
  return { initialRouteGzipBytes: result.initialGzipBytes, chartChunkGzipBytes: result.chart?.gzipBytes ?? 0 };
}
