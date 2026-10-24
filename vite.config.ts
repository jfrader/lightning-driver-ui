/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react-swc';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version?: string };

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);
const DEFAULT_DEV_API_ORIGIN = 'http://127.0.0.1:8080';

/**
 * Contract validators are a development and test guarantee: they catch a drifted response at the
 * boundary. A production build replaces the generated Ajv module with accept-all stubs, keeping
 * its 60 kB gzip out of the shipped bundle. Types and the frozen snapshot still guard the build,
 * and vitest keeps the real module (this plugin only applies to builds).
 */
function stripContractValidators(): Plugin {
  const STUB = '\0contract-validators-stub';
  return {
    name: 'strip-contract-validators',
    apply: 'build',
    enforce: 'pre',
    resolveId(source) {
      return /(^|\/)generated\/validators(\.js)?$/.test(source) ? STUB : null;
    },
    load(id) {
      if (id !== STUB) return null;
      const source = readFileSync(new URL('./src/api/generated/validators.js', import.meta.url), 'utf8');
      const exported = source.match(/export\s*\{([^}]*)\}/);
      if (!exported) throw new Error('generated validators module has no export list');
      const names = exported[1]
        .split(',')
        .map((entry) => entry.trim().split(/\s+as\s+/).pop())
        .filter((name): name is string => Boolean(name));
      return names.map((name) => `export const ${name} = () => true;`).join('\n');
    },
  };
}

/** The development proxy only ever forwards to a loopback backend. */
function devApiOrigin(): string {
  const origin = process.env.LIGHTNING_DRIVER_DEV_API_ORIGIN ?? DEFAULT_DEV_API_ORIGIN;
  const url = new URL(origin);
  if (!LOOPBACK_HOSTS.has(url.hostname)) {
    throw new Error(`LIGHTNING_DRIVER_DEV_API_ORIGIN must be a loopback origin, got ${url.hostname}`);
  }
  return url.origin;
}

export default defineConfig(({ command }) => ({
  plugins: [stripContractValidators(), react({ jsxImportSource: '@emotion/react' })],
  define: { __APP_VERSION__: JSON.stringify(version ?? '') },
  build: {
    rollupOptions: {
      output: {
        advancedChunks: {
          groups: [
            { name: 'vendor-react', test: /\/node_modules\/(react|react-dom|scheduler)\//, priority: 40 },
            { name: 'vendor-tanstack', test: /\/node_modules\/@tanstack\//, priority: 30 },
            { name: 'vendor-motion', test: /\/node_modules\/(motion|framer-motion|motion-dom|motion-utils)\//, priority: 20 },
          ],
        },
      },
    },
  },
  server: {
    host: '127.0.0.1',
    strictPort: true,
    proxy: command === 'serve' ? { '/api': { target: devApiOrigin() } } : undefined,
  },
  preview: { host: '127.0.0.1' },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs'],
    setupFiles: ['./src/test/setup.ts'],
    maxWorkers: 2,
    // The cold multi-action pay flow took 13 s with a second Vitest process running.
    // This is the whole-test allowance; async render/assertion deadlines stay at 5 s or less.
    testTimeout: 15_000,
    restoreMocks: true,
  },
}));
