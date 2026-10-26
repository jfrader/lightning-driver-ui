import { screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fixture } from '../../test/fixtures';
import { NOSTR_KEYS, installNostrExtension, nostrChallenge, signedEvent } from '../../test/nostr';
import { renderApp } from '../../test/render-app';
import { api, safeError, server } from '../../test/server';

const webauthn = vi.hoisted(() => ({
  startAuthentication: vi.fn(),
  startRegistration: vi.fn(),
  browserSupportsWebAuthn: vi.fn(() => true),
}));
vi.mock('@simplewebauthn/browser', async (importOriginal) =>
  (await import('../../test/webauthn-mock')).webauthnModule(importOriginal, webauthn),
);

const HEX_TOKEN = 'a1'.repeat(32);
const NOSTR_SESSION = { ...fixture('session'), auth_method: 'nostr', nostr_pubkey: NOSTR_KEYS[0].pubkey };

interface Host {
  passkeys?: boolean;
  nostr?: boolean;
  enrollment?: boolean;
}

function host({ passkeys = true, nostr = true, enrollment = false }: Host) {
  server.use(
    http.get(api('/auth/bootstrap'), () =>
      HttpResponse.json({
        ...fixture('bootstrap'),
        login_available: passkeys || nostr,
        passkey_login_available: passkeys,
        nostr_login_available: nostr,
        enrollment_available: enrollment,
      }),
    ),
  );
}

interface Calls {
  starts: { body: unknown; csrf: string | null }[];
  finishes: unknown[];
}

/** The Nostr auth endpoints; `finish` decides the answer, defaulting to a Nostr session. */
function nostrServer(finish: () => Response = () => HttpResponse.json(NOSTR_SESSION)): Calls {
  const calls: Calls = { starts: [], finishes: [] };
  let signedIn = false;
  server.use(
    http.get(api('/session'), () =>
      signedIn ? HttpResponse.json(NOSTR_SESSION) : HttpResponse.json(safeError('session_required', 'Sign in.'), { status: 401 }),
    ),
    http.post(api('/auth/nostr/start'), async ({ request }) => {
      const body = await request.json();
      calls.starts.push({ body, csrf: request.headers.get('X-CSRF-Token') });
      const purpose = typeof body === 'object' && body !== null && 'purpose' in body ? String(body.purpose) : 'login';
      return HttpResponse.json(nostrChallenge(purpose === 'enrollment' ? 'enrollment' : 'login'));
    }),
    http.post(api('/auth/nostr/finish'), async ({ request }) => {
      calls.finishes.push(await request.json());
      const response = finish();
      signedIn = response.ok;
      return response;
    }),
  );
  return calls;
}

const nostrButton = () => screen.findByRole('button', { name: 'Sign in with Nostr' });

beforeEach(() => {
  webauthn.browserSupportsWebAuthn.mockReturnValue(true);
});

describe('sign in with Nostr', () => {
  it('stays hidden when no Nostr key is enrolled', async () => {
    installNostrExtension();
    host({ nostr: false });
    renderApp('/login');
    expect(await screen.findByRole('button', { name: 'Continue with passkey' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Sign in with Nostr' })).not.toBeInTheDocument();
  });

  it('keeps passkey primary and Nostr second, in that focus order', async () => {
    installNostrExtension();
    host({});
    const view = renderApp('/login');
    const nostr = await nostrButton();
    await view.user.tab();
    expect(screen.getByRole('button', { name: 'Continue with passkey' })).toHaveFocus();
    await view.user.tab();
    expect(nostr).toHaveFocus();
  });

  it('is disabled with the literal reason when the browser has no extension', async () => {
    host({});
    renderApp('/login');
    const nostr = await nostrButton();
    expect(nostr).toBeDisabled();
    expect(nostr).toHaveAccessibleDescription('No Nostr extension found.');
    expect(screen.getByRole('button', { name: 'Continue with passkey' })).toBeEnabled();
  });

  it('signs the server template with the extension and opens the workbench, without WebAuthn', async () => {
    webauthn.browserSupportsWebAuthn.mockReturnValue(false);
    const signEvent = installNostrExtension();
    host({});
    const calls = nostrServer();
    const view = renderApp('/login');

    expect(screen.queryByRole('button', { name: 'Continue with passkey' })).not.toBeInTheDocument();
    await view.user.click(await nostrButton());

    expect(await screen.findByRole('heading', { name: 'Choose a node' })).toBeInTheDocument();
    const template = nostrChallenge('login').event;
    expect(calls.starts).toEqual([{ body: { purpose: 'login' }, csrf: 'SYNTHETIC_PREAUTH_CSRF_ONLY' }]);
    expect(signEvent).toHaveBeenCalledWith(template);
    expect(calls.finishes).toEqual([{ challenge_id: nostrChallenge('login').challenge_id, event: signedEvent(template) }]);
    expect(webauthn.startAuthentication).not.toHaveBeenCalled();
  });

  it('without WebAuthn or an extension, offers a remote signer', async () => {
    webauthn.browserSupportsWebAuthn.mockReturnValue(false);
    host({});
    renderApp('/login');
    expect(await screen.findByLabelText('Bunker URI')).toBeInTheDocument();
    expect(screen.getByText('No Nostr extension found.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect remote signer' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Continue with passkey' })).not.toBeInTheDocument();
  });

  it('reads a refused signature and does not finish', async () => {
    installNostrExtension().mockRejectedValue(new Error('User rejected'));
    host({});
    const calls = nostrServer();
    const view = renderApp('/login');
    await view.user.click(await nostrButton());

    expect(await screen.findByText('Nostr signature canceled.')).toBeInTheDocument();
    expect(calls.finishes).toEqual([]);
    expect(view.router.state.location.pathname).toBe('/login');
  });

  it('names an unenrolled key', async () => {
    installNostrExtension();
    host({});
    nostrServer(() => HttpResponse.json(safeError('authentication_failed', 'Authentication failed.'), { status: 401 }));
    const view = renderApp('/login');
    await view.user.click(await nostrButton());
    expect(await screen.findByText('This Nostr key is not enrolled on this server.')).toBeInTheDocument();
  });

  it('holds both actions for the rate limit and retries nothing', async () => {
    installNostrExtension();
    host({});
    const calls = nostrServer(() =>
      HttpResponse.json(safeError('rate_limited', 'Slow down.'), { status: 429, headers: { 'Retry-After': '30' } }),
    );
    const view = renderApp('/login');
    await view.user.click(await nostrButton());

    expect(await screen.findByText('Too many attempts. Try again in 30 seconds.')).toBeInTheDocument();
    expect(await nostrButton()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Continue with passkey' })).toBeDisabled();
    expect(calls.finishes).toHaveLength(1);
  });
});

describe('enroll with Nostr', () => {
  async function openNostrEnrollment(view: ReturnType<typeof renderApp>) {
    await view.user.click(await screen.findByRole('button', { name: 'Enroll a sign-in method' }));
    await view.user.click(await screen.findByRole('radio', { name: 'Nostr' }));
  }

  it('offers the method choice after the token, Nostr disabled with its reason without an extension', async () => {
    host({ enrollment: true });
    const view = renderApp('/login');
    await view.user.click(await screen.findByRole('button', { name: 'Enroll a sign-in method' }));

    expect(await screen.findByLabelText(/^Enrollment token/)).toHaveFocus();
    expect(screen.getByRole('radio', { name: 'Passkey' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Nostr' })).toBeDisabled();
    expect(screen.getByText('No Nostr extension found.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create passkey' })).toBeInTheDocument();
  });

  it('enrolls the extension key with the host token and signs in, without WebAuthn', async () => {
    webauthn.browserSupportsWebAuthn.mockReturnValue(false);
    const signEvent = installNostrExtension();
    host({ passkeys: false, nostr: false, enrollment: true });
    const calls = nostrServer();
    const view = renderApp('/login');

    expect(await screen.findByRole('heading', { level: 1, name: 'Enroll' })).toBeInTheDocument();
    expect(await screen.findByRole('radio', { name: 'Nostr' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Passkey' })).toBeDisabled();
    await view.user.type(screen.getByLabelText(/^Enrollment token/), HEX_TOKEN);
    await view.user.click(screen.getByRole('button', { name: 'Sign with Nostr' }));

    expect(await screen.findByRole('heading', { name: 'Choose a node' })).toBeInTheDocument();
    expect(calls.starts).toEqual([{ body: { purpose: 'enrollment', token: HEX_TOKEN }, csrf: 'SYNTHETIC_PREAUTH_CSRF_ONLY' }]);
    expect(signEvent).toHaveBeenCalledTimes(1);
    expect(calls.finishes).toHaveLength(1);
    expect(webauthn.startRegistration).not.toHaveBeenCalled();
  });

  it('keeps the token in the field when the signature fails', async () => {
    installNostrExtension().mockRejectedValue(new Error('User rejected'));
    host({ enrollment: true });
    const calls = nostrServer();
    const view = renderApp('/login');
    await openNostrEnrollment(view);
    await view.user.type(screen.getByLabelText(/^Enrollment token/), HEX_TOKEN);
    await view.user.click(screen.getByRole('button', { name: 'Sign with Nostr' }));

    expect(await screen.findByText('Nostr signature canceled.')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Enrollment token/)).toHaveValue(HEX_TOKEN);
    expect(calls.finishes).toEqual([]);
  });

  it('keeps the token when the server refuses the signed enrollment', async () => {
    installNostrExtension();
    host({ enrollment: true });
    nostrServer(() => HttpResponse.json(safeError('authentication_failed', 'Authentication failed.'), { status: 401 }));
    const view = renderApp('/login');
    await openNostrEnrollment(view);
    await view.user.type(screen.getByLabelText(/^Enrollment token/), HEX_TOKEN);
    await view.user.click(screen.getByRole('button', { name: 'Sign with Nostr' }));

    expect(await screen.findByText('The server refused this enrollment. Check the token.')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Enrollment token/)).toHaveValue(HEX_TOKEN);
  });

  it('refuses a token that is not the 64-hex host token before any request', async () => {
    const signEvent = installNostrExtension();
    host({ enrollment: true });
    const calls = nostrServer();
    const view = renderApp('/login');
    await openNostrEnrollment(view);
    await view.user.type(screen.getByLabelText(/^Enrollment token/), 'host-issued-enrollment-token-0123456789abcdef');
    await view.user.click(screen.getByRole('button', { name: 'Sign with Nostr' }));

    expect(await screen.findByText('Enter the full token from the host.')).toBeInTheDocument();
    expect(calls.starts).toEqual([]);
    expect(signEvent).not.toHaveBeenCalled();
  });

  it('starts one enrollment for a double-clicked submit', async () => {
    installNostrExtension();
    host({ enrollment: true });
    const calls = nostrServer();
    const view = renderApp('/login');
    await openNostrEnrollment(view);
    await view.user.type(screen.getByLabelText(/^Enrollment token/), HEX_TOKEN);
    await view.user.dblClick(screen.getByRole('button', { name: 'Sign with Nostr' }));

    await screen.findByRole('heading', { name: 'Choose a node' });
    await waitFor(() => expect(calls.finishes).toHaveLength(1));
    expect(calls.starts).toHaveLength(1);
  });
});
