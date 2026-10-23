import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: ['real.spec.ts', 'restart.spec.ts'],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 900_000,
  expect: { timeout: 20_000 },
  reporter: 'list',
  outputDir: process.env.E2E_DATA ? `${process.env.E2E_DATA}/playwright` : 'test-results/e2e',
  use: {
    baseURL: process.env.E2E_BASE_URL,
    headless: true,
    viewport: { width: 1440, height: 1000 },
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    },
  },
});
