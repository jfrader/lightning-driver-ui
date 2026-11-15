import { screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { sessionCsrfToken } from '../../api/csrf';
import { fixture } from '../../test/fixtures';
import { renderApp } from '../../test/render-app';
import { api, safeError, server } from '../../test/server';

vi.mock('@simplewebauthn/browser', async (importOriginal) => ({
  ...await importOriginal<typeof import('@simplewebauthn/browser')>(),
  browserSupportsWebAuthn: () => true,
}));

describe('session revocation', () => {
  it.each([true, false])('clears private data and reports DELETE success=%s truthfully', async (success) => {
    let succeeds = success;
    const tokens: (string | null)[] = [];
    server.use(http.delete(api('/session'), ({ request }) => {
      tokens.push(request.headers.get('X-CSRF-Token'));
      return succeeds ? new HttpResponse(null, { status: 204 }) : HttpResponse.error();
    }));
    const view = renderApp('/more');
    await screen.findByRole('region', { name: 'Session' });
    view.queryClient.setQueryData(['private-test'], 'secret');
    await view.user.click(screen.getByRole('button', { name: /^Sign out$/ }));
    expect(await screen.findByText(success ? 'Signed out.' : 'Session revocation failed. Retry sign out.')).toBeInTheDocument();
    expect(view.queryClient.getQueryData(['private-test'])).toBeUndefined();
    expect(sessionCsrfToken()).toBeNull();
    expect(screen.queryByRole('region', { name: 'Session' })).not.toBeInTheDocument();
    if (!success) {
      expect(screen.queryByText('Signed out.')).not.toBeInTheDocument();
      succeeds = true;
      await view.user.click(screen.getByRole('button', { name: 'Retry sign out' }));
      expect(await screen.findByText('Signed out.')).toBeInTheDocument();
      await waitFor(() => expect(tokens).toEqual([fixture('session').csrf_token, fixture('session').csrf_token]));
      expect(sessionCsrfToken()).toBeNull();
    }
  });

  it('treats a session already revoked on the server as a completed sign-out', async () => {
    let revokeAttempted = false;
    server.use(
      http.delete(api('/session'), () => { revokeAttempted = true; return HttpResponse.error(); }),
      http.get(api('/session'), () => revokeAttempted
        ? HttpResponse.json(safeError('session_required', 'Sign in required.'), { status: 401 })
        : HttpResponse.json(fixture('session'))),
    );
    const view = renderApp('/more');
    await screen.findByRole('region', { name: 'Session' });
    await view.user.click(screen.getByRole('button', { name: /^Sign out$/ }));
    await screen.findByText('Session revocation failed. Retry sign out.');
    await view.user.click(screen.getByRole('button', { name: 'Retry sign out' }));
    expect(await screen.findByText('Signed out.')).toBeInTheDocument();
    expect(screen.queryByText('Session revocation failed. Retry sign out.')).not.toBeInTheDocument();
  });
});
