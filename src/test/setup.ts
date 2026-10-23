import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { clearSessionCsrfToken } from '../api/csrf';
import { installDomShims } from './dom-shims';
import { TEST_NOW, isWideLayout, setWideLayout } from './environment';
import { server } from './server';

const ASYNC_RENDER_TIMEOUT_MS = 5_000;
configure({ asyncUtilTimeout: ASYNC_RENDER_TIMEOUT_MS });

beforeAll(() => {
  installDomShims();
  server.listen({ onUnhandledFrame: 'error' });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: query.includes('min-width') ? isWideLayout() : false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(TEST_NOW);
  setWideLayout(false);
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  clearSessionCsrfToken();
  delete window.nostr;
  vi.useRealTimers();
});

afterAll(() => server.close());
