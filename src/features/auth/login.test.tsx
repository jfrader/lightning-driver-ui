import { screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, delay, http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fixture } from '../../test/fixtures';
import { renderApp } from '../../test/render-app';
import { api, safeError, server } from '../../test/server';
import { assertion } from '../../test/webauthn-mock';

const webauthn = vi.hoisted(() => ({
  startAuthentication: vi.fn(),
  startRegistration: vi.fn(),
  browserSupportsWebAuthn: vi.fn(() => true),
}));
vi.mock('@simplewebauthn/browser', async (importOriginal) =>
  (await import('../../test/webauthn-mock')).webauthnModule(importOriginal, webauthn),
);

const HOST_COMMAND = 'api-server auth enrollment --config <path>';
const TOKEN = 'host-issued-enrollment-token-0123456789abcdef';

function hostAllows(login: boolean, enrollment: boolean) {
  let reads = 0;
  server.use(
    http.get(api('/auth/bootstrap'), () => {
      reads += 1;
      return HttpResponse.json({ ...fixture('bootstrap'), login_available: login, enrollment_available: enrollment });
    }),
  );
  return { reads: () => reads };
}

function failSignIn(code: string, status: number, headers: Record<string, string> = {}) {
  server.use(
    http.post(api('/auth/passkey/start'), () => HttpResponse.json(fixture('login_challenge'))),
    http.post(api('/auth/passkey/finish'), () => HttpResponse.json(safeError(code, `server: ${code}`), { status, headers })),
  );
  webauthn.startAuthentication.mockResolvedValue(assertion);
}

const pane = () => screen.getByRole('main');
const continueButton = () => screen.getByRole('button', { name: 'Continue with passkey' });

beforeEach(() => {
  webauthn.browserSupportsWebAuthn.mockReturnValue(true);
});

describe('sign-in states and copy (screens spec §6.1)', () => {
  it('L0: titles the pane and announces loading, with no control', async () => {
    server.use(
      http.get(api('/auth/bootstrap'), async () => {
        await delay('infinite');
        return HttpResponse.json(fixture('bootstrap'));
      }),
    );
    renderApp('/login');
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Loading sign-in');
    expect(within(pane()).queryAllByRole('button')).toEqual([]);
  });

  it('L1: a browser without passkeys gets one sentence and no control', async () => {
    webauthn.browserSupportsWebAuthn.mockReturnValue(false);
    renderApp('/login');
    expect(
      await screen.findByText('This browser cannot use passkeys. Open the app in a browser with passkey support.'),
    ).toBeInTheDocument();
    expect(within(pane()).queryAllByRole('button')).toEqual([]);
  });

  it('L2: one passkey action, no password or one-time code, and no enrollment unless the host armed it', async () => {
    hostAllows(true, false);
    const view = renderApp('/login');
    expect(await screen.findByRole('button', { name: 'Continue with passkey' })).toBeEnabled();
    expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enroll a passkey' })).not.toBeInTheDocument();
    expect(view.container.querySelectorAll('input')).toHaveLength(0);
    expect(screen.queryByText(/password|one-time|TOTP/i)).not.toBeInTheDocument();
  });

  it('L2 → enrollment and back: focus follows the operator, no route change', async () => {
    hostAllows(true, true);
    const view = renderApp('/login');
    await view.user.click(await screen.findByRole('button', { name: 'Enroll a passkey' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Enroll a passkey' })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Enrollment token/)).toHaveFocus();
    expect(view.router.state.location.pathname).toBe('/login');

    await view.user.click(screen.getByRole('button', { name: 'Back to sign in' }));
    expect(continueButton()).toHaveFocus();
  });

  it('L3: enrollment without sign-in has no way back to a sign-in that cannot work', async () => {
    hostAllows(false, true);
    renderApp('/login');
    expect(await screen.findByRole('heading', { level: 1, name: 'Enroll a passkey' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back to sign in' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continue with passkey' })).not.toBeInTheDocument();
  });

  it('L4: no passkey and no enrollment names the host command; Reload reads the host again', async () => {
    const host = hostAllows(false, false);
    const view = renderApp('/login');
    expect(await screen.findByText('No passkey is enrolled.')).toBeInTheDocument();
    expect(pane()).toHaveTextContent(`Run ${HOST_COMMAND} on the host, then reload this page.`);
    expect(screen.queryByRole('button', { name: 'Continue with passkey' })).not.toBeInTheDocument();

    const before = host.reads();
    hostAllows(true, false);
    await view.user.click(screen.getByRole('button', { name: 'Reload' }));
    expect(await screen.findByRole('button', { name: 'Continue with passkey' })).toBeInTheDocument();
    expect(before).toBe(1);
  });

  it('L5: a failed bootstrap shows the error block and Reload, nothing else', async () => {
    server.use(http.get(api('/auth/bootstrap'), () => HttpResponse.json(safeError('internal_error', 'Server fault.'), { status: 500 })));
    renderApp('/login');
    expect(await screen.findByText('Server fault.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continue with passkey' })).not.toBeInTheDocument();
  });

  it.each([
    ['session_ended', 'Session ended.'],
    ['signed_out', 'Signed out.'],
  ])('L6/L7: notice %s reads %j above the passkey action', async (notice, text) => {
    renderApp(`/login?notice=${notice}`);
    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(continueButton()).toBeInTheDocument();
  });

  it('ignores an unknown notice', async () => {
    renderApp('/login?notice=hacked');
    await screen.findByRole('button', { name: 'Continue with passkey' });
    expect(screen.queryByText(/Session ended|Signed out/)).not.toBeInTheDocument();
  });

  it('forwards the retired /enroll route to /login', async () => {
    const view = renderApp('/enroll');
    await screen.findByRole('button', { name: 'Continue with passkey' });
    expect(view.router.state.location.pathname).toBe('/login');
  });
});

describe('sign-in errors (screens spec §6.3)', () => {
  it.each([
    ['authentication_failed', 401, 'This passkey is not enrolled on this server.'],
    ['authentication_failed', 403, 'This passkey is not enrolled on this server.'],
    ['challenge_expired', 400, 'The sign-in request expired. Continue with passkey again.'],
    ['csrf', 403, 'Sign-in was rejected by the server. Reload this page.'],
  ])('%s (%s) reads literally and leaves the action available', async (code, status, text) => {
    failSignIn(code, status);
    const view = renderApp('/login');
    await view.user.click(await screen.findByRole('button', { name: 'Continue with passkey' }));
    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(continueButton()).toBeEnabled();
    expect(view.router.state.location.pathname).toBe('/login');
  });

  it('holds the action for Retry-After on a rate limit and never retries by itself', async () => {
    failSignIn('rate_limited', 429, { 'Retry-After': '30' });
    const view = renderApp('/login');
    await view.user.click(await screen.findByRole('button', { name: 'Continue with passkey' }));
    expect(await screen.findByText('Too many attempts. Try again in 30 seconds.')).toBeInTheDocument();
    expect(continueButton()).toBeDisabled();
    expect(webauthn.startAuthentication).toHaveBeenCalledTimes(1);
  });
});

describe('enrollment form (screens spec §6.2)', () => {
  async function openEnrollment() {
    hostAllows(false, true);
    let starts = 0;
    server.use(
      http.post(api('/auth/enrollment/start'), () => {
        starts += 1;
        return HttpResponse.json(fixture('enrollment_challenge'));
      }),
    );
    const view = renderApp('/login');
    const field = await screen.findByLabelText(/^Enrollment token/);
    return { view, field, starts: () => starts };
  }

  it('is a plain single-line field that the browser does not fill, correct or keep', async () => {
    const { field } = await openEnrollment();
    expect(field).toHaveAttribute('type', 'text');
    expect(field).toHaveAttribute('autocomplete', 'off');
    expect(field).toHaveAttribute('spellcheck', 'false');
    expect(field).toHaveAttribute('autocapitalize', 'off');
    expect(screen.getByText('Printed once by api-server auth enrollment on the host.')).toBeInTheDocument();
  });

  it.each(['', 'too-short-token'])('refuses an absent or partial token %j locally and sends nothing', async (text) => {
    const { view, field, starts } = await openEnrollment();
    if (text) await view.user.type(field, text);
    await view.user.click(screen.getByRole('button', { name: 'Create passkey' }));
    expect(await screen.findByText('Enter the full token from the host.')).toBeInTheDocument();
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(starts()).toBe(0);
    expect(webauthn.startRegistration).not.toHaveBeenCalled();
  });

  it('reads a refused token as the host-only wording and keeps the form for a new token', async () => {
    const { view, field } = await openEnrollment();
    server.use(
      http.post(api('/auth/enrollment/start'), () =>
        HttpResponse.json(safeError('enrollment_unavailable', 'Enrollment unavailable.'), { status: 403 }),
      ),
    );
    await view.user.type(field, TOKEN);
    await view.user.click(screen.getByRole('button', { name: 'Create passkey' }));

    expect(await screen.findByText('Enrollment is not available.')).toBeInTheDocument();
    expect(pane()).toHaveTextContent(`Run ${HOST_COMMAND} on the host for a new token.`);
    expect(screen.getByLabelText(/^Enrollment token/)).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Create passkey' })).toBeEnabled();
  });

  it('hands off to the page that asked for sign-in, and stores nothing', async () => {
    let enrolled = false;
    server.use(
      http.get(api('/auth/bootstrap'), () => HttpResponse.json({ ...fixture('bootstrap'), login_available: false, enrollment_available: true })),
      http.post(api('/auth/enrollment/start'), () => HttpResponse.json(fixture('enrollment_challenge'))),
      http.post(api('/auth/enrollment/finish'), () => {
        enrolled = true;
        return HttpResponse.json(fixture('session'));
      }),
      http.get(api('/session'), () =>
        enrolled ? HttpResponse.json(fixture('session')) : HttpResponse.json(safeError('session_required', 'Sign in.'), { status: 401 }),
      ),
    );
    webauthn.startRegistration.mockResolvedValue({
      id: 'c3ludGhldGljLW5ldy1jcmVkZW50aWFs',
      rawId: 'c3ludGhldGljLW5ldy1jcmVkZW50aWFs',
      type: 'public-key',
      response: { clientDataJSON: 'Y2xpZW50', attestationObject: 'YXR0ZXN0' },
      clientExtensionResults: {},
    });
    const view = renderApp('/nodes/lnd-lab/payments');
    await view.user.type(await screen.findByLabelText(/^Enrollment token/), TOKEN);
    await view.user.click(screen.getByRole('button', { name: 'Create passkey' }));

    expect(await screen.findByRole('heading', { name: 'Payments' })).toBeInTheDocument();
    await waitFor(() => expect(view.router.state.location.pathname).toBe('/nodes/lnd-lab/payments'));
    expect(JSON.stringify({ ...window.localStorage })).not.toContain(TOKEN);
    expect(Object.keys(window.sessionStorage)).toEqual([]);
  });
});
