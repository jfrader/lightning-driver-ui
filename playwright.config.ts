import { defineConfig } from '@playwright/test';

const PORT = Number(process.env.LIGHTNING_DRIVER_BROWSER_PORT ?? 4317);
export const BROWSER_ORIGIN = `http://127.0.0.1:${PORT}`;

// Uses Playwright's installed Chromium; set this to use another Chromium binary instead.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;

export default defineConfig({
  testDir: 'tests/browser',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  reporter: 'list',
  use: {
    baseURL: BROWSER_ORIGIN,
    browserName: 'chromium',
    headless: true,
    locale: 'en-US',
    timezoneId: 'UTC',
    launchOptions: { executablePath },
  },
  projects: [
    { name: 'phone-390', use: { viewport: { width: 390, height: 844 } } },
    { name: 'desktop-1280', use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: `npx vite build && npx vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: BROWSER_ORIGIN,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
