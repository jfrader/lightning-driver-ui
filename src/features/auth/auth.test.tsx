import { screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { nodeKeys } from '../../api/node-queries';
import { setWideLayout } from '../../test/environment';
import { fixture } from '../../test/fixtures';
import { renderApp } from '../../test/render-app';
import { api, safeError, server } from '../../test/server';
import { assertion, canceledPasskey } from '../../test/webauthn-mock';

const webauthn = vi.hoisted(() => ({ startAuthentication: vi.fn(), startRegistration: vi.fn() }));
vi.mock('@simplewebauthn/browser', async (importOriginal) =>
  (await import('../../test/webauthn-mock')).webauthnModule(importOriginal, webauthn),
);

function signedOut() {
  let authenticated = false;
  const finishBodies: unknown[] = [];
  const finishCsrf: (string | null)[] = [];
  server.use(
    http.get(api('/session'), () =>
      authenticated
        ? HttpResponse.json(fixture('session'))
        : HttpResponse.json(safeError('session_required', 'Sign in.'), { status: 401 }),
    ),
    http.post(api('/auth/passkey/start'), () => HttpResponse.json(fixture('login_challenge'))),
    http.post(api('/auth/passkey/finish'), async ({ request }) => {
      finishBodies.push(await request.json());
      finishCsrf.push(request.headers.get('X-CSRF-Token'));
      authenticated = true;
      return HttpResponse.json(fixture('session'));
    }),
  );
  return { finishBodies, finishCsrf };
}

describe('passkey sign-in', () => {
  it('sends a signed-out visitor to sign-in and returns them to the page after a passkey', async () => {
    const { finishBodies, finishCsrf } = signedOut();
    webauthn.startAuthentication.mockResolvedValue(assertion);
    const { user, router } = renderApp('/nodes/lnd-lab/payments');

    await user.click(await screen.findByRole('button', { name: 'Sign in with passkey' }));

    expect(await screen.findByRole('heading', { name: 'Payments' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/nodes/lnd-lab/payments');
    expect(finishCsrf).toEqual(['SYNTHETIC_PREAUTH_CSRF_ONLY']);
    expect(finishBodies).toEqual([{ challenge_id: fixture('login_challenge').challenge_id, credential: expect.objectContaining({ id: assertion.id }) }]);
    expect(webauthn.startAuthentication).toHaveBeenCalledWith({
      optionsJSON: expect.objectContaining({ challenge: fixture('login_challenge').options.publicKey.challenge, userVerification: 'required' }),
    });
  });

  it('treats a canceled passkey prompt as canceled, not as a failure, and sends nothing', async () => {
    const { finishBodies } = signedOut();
    webauthn.startAuthentication.mockRejectedValue(canceledPasskey());
    const { user, router } = renderApp('/login');

    await user.click(await screen.findByRole('button', { name: 'Sign in with passkey' }));

    expect(await screen.findByText('Passkey request canceled. Nothing was sent.')).toBeInTheDocument();
    expect(finishBodies).toEqual([]);
    expect(router.state.location.pathname).toBe('/login');
    expect(screen.getByRole('button', { name: 'Sign in with passkey' })).toBeEnabled();
  });

  it.each(['https://evil.example/steal', '//evil.example/steal', '/\\evil.example'])(
    'ignores an off-site redirect %j after sign-in',
    async (redirect) => {
      signedOut();
      webauthn.startAuthentication.mockResolvedValue(assertion);
      const { user, router } = renderApp(`/login?redirect=${encodeURIComponent(redirect)}`);

      await user.click(await screen.findByRole('button', { name: 'Sign in with passkey' }));

      expect(await screen.findByRole('heading', { name: 'Choose a node' })).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/');
    },
  );
});

describe('session loss', () => {
  it('returns to sign-in and drops every cached node read on a 401', async () => {
    setWideLayout(true);
    const { user, queryClient, router } = renderApp('/nodes/lnd-lab');
    expect(await screen.findByRole('heading', { name: 'LND lab' })).toBeInTheDocument();
    expect(await screen.findByText('500,000.123 sat')).toBeInTheDocument();
    expect(queryClient.getQueryData(nodeKeys.summary('lnd-lab'))).toBeDefined();

    server.use(
      http.get(api('/nodes/:nodeId/invoices'), () =>
        HttpResponse.json(safeError('session_required', 'Session expired.'), { status: 401 }),
      ),
      http.get(api('/session'), () => HttpResponse.json(safeError('session_required', 'Sign in.'), { status: 401 })),
    );
    await user.click(screen.getByRole('link', { name: 'Invoices' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toEqual({ redirect: '/nodes/lnd-lab/invoices' });
    expect(queryClient.getQueryData(nodeKeys.summary('lnd-lab'))).toBeUndefined();
    expect(queryClient.getQueryData(nodeKeys.detail('lnd-lab', 'balances'))).toBeUndefined();
    expect(screen.queryByText('500,000.123 sat')).not.toBeInTheDocument();
  });
});
