import { defineConfig } from '@playwright/test';

const PORT = 4318;
const BASE_URL = `http://127.0.0.1:${PORT}`;

// Uses Playwright's installed Chromium; set this to use another Chromium binary instead.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;

/**
 * README captures, kept out of `npm run test:browser`: these tests write committed PNGs, so they
 * only run on demand through `npm run screenshots`.
 */
export default defineConfig({
  testDir: 'tests/screenshots',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    browserName: 'chromium',
    headless: true,
    locale: 'en-US',
    timezoneId: 'UTC',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    launchOptions: { executablePath },
  },
  webServer: {
    command: `npx vite build && npx vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
