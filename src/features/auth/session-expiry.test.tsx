import { screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { nodeKeys } from '../../api/node-queries';
import { REMEMBERED_NODE_STORAGE_KEY, THEME_STORAGE_KEY } from '../../config';
import { TEST_NOW } from '../../test/environment';
import { fixture } from '../../test/fixtures';
import { renderApp } from '../../test/render-app';
import { api, safeError, server } from '../../test/server';

const webauthn = vi.hoisted(() => ({ startAuthentication: vi.fn(), startRegistration: vi.fn() }));
vi.mock('@simplewebauthn/browser', async (importOriginal) =>
  (await import('../../test/webauthn-mock')).webauthnModule(importOriginal, webauthn),
);

/** One second after the test clock: the earliest deadline the re-check floor allows. */
const SOON = new Date(TEST_NOW.getTime() + 1_000).toISOString();
const LATER = new Date(TEST_NOW.getTime() + 3_600_000).toISOString();
const WAIT = { timeout: 4_000 };

function sessionReads(answers: ((read: number) => Response)[]) {
  let reads = 0;
  server.use(
    http.get(api('/session'), () => {
      reads += 1;
      return (answers[reads - 1] ?? answers[answers.length - 1])(reads);
    }),
  );
  return () => reads;
}

const alive = (idle: string, absolute = fixture('session').expires_at) => () =>
  HttpResponse.json({ ...fixture('session'), idle_expires_at: idle, expires_at: absolute });
const ended = () => HttpResponse.json(safeError('session_required', 'Session expired.'), { status: 401 });

describe('session expiry (screens spec §6.5)', () => {
  it.each([
    ['idle', SOON, fixture('session').expires_at],
    ['absolute', LATER, SOON],
  ])('at the %s deadline asks the server, and a 401 ends the session cleanly', async (_, idle, absolute) => {
    const reads = sessionReads([alive(idle, absolute), ended]);
    const view = renderApp('/nodes/lnd-lab');
    expect(await screen.findByText('500,000.123 sat')).toBeInTheDocument();

    await waitFor(() => expect(view.router.state.location.pathname).toBe('/login'), WAIT);
    expect(view.router.state.location.search).toEqual({ redirect: '/nodes/lnd-lab', notice: 'session_ended' });
    expect(await screen.findByText('Session ended.')).toBeInTheDocument();
    expect(reads()).toBe(2);
    expect(view.queryClient.getQueryData(nodeKeys.summary('lnd-lab'))).toBeUndefined();
    expect(screen.queryByText('500,000.123 sat')).not.toBeInTheDocument();
    // Only the two approved preferences may be in storage; no balance, payment or token.
    expect(Object.keys(window.localStorage).every((key) => [REMEMBERED_NODE_STORAGE_KEY, THEME_STORAGE_KEY].includes(key))).toBe(true);
    expect(Object.keys(window.sessionStorage)).toEqual([]);
  });

  it('keeps a session the server extended and checks again at its new deadline', async () => {
    const reads = sessionReads([alive(SOON), alive(LATER)]);
    const view = renderApp('/nodes/lnd-lab');
    await screen.findByText('500,000.123 sat');

    await waitFor(() => expect(reads()).toBe(2), WAIT);
    expect(view.router.state.location.pathname).toBe('/nodes/lnd-lab');
    expect(screen.getByText('500,000.123 sat')).toBeInTheDocument();
  });
});
