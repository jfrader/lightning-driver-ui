/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);
const DEFAULT_DEV_API_ORIGIN = 'http://127.0.0.1:8080';

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
  plugins: [react({ jsxImportSource: '@emotion/react' })],
  server: {
    host: '127.0.0.1',
    strictPort: true,
    proxy: command === 'serve' ? { '/api': { target: devApiOrigin() } } : undefined,
  },
  preview: { host: '127.0.0.1' },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    maxWorkers: 2,
    restoreMocks: true,
  },
}));
