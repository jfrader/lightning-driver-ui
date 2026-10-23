import { screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { sessionCsrfToken } from '../../api/csrf';
import { fixture } from '../../test/fixtures';
import { NOSTR_KEYS, installNostrExtension, nostrChallenge, nostrIdentities, nostrIdentity } from '../../test/nostr';
import { assertion } from '../../test/webauthn-mock';
import { renderApp } from '../../test/render-app';
import { api, safeError, server } from '../../test/server';

const webauthn = vi.hoisted(() => ({ startAuthentication: vi.fn(), startRegistration: vi.fn() }));
vi.mock('@simplewebauthn/browser', async (importOriginal) =>
  (await import('../../test/webauthn-mock')).webauthnModule(importOriginal, webauthn),
);

const KEEP_ONE = 'Keep at least one sign-in method.';

interface Calls {
  starts: { body: unknown; csrf: string | null }[];
  finishes: unknown[];
}

/** The operator's methods and the session-bound Nostr ceremony; `finish` decides the answer. */
function methodsServer(
  listed: ReturnType<typeof nostrIdentities>,
  finish: (purpose: string) => Response,
  options: { reauthOnce?: boolean } = {},
): Calls {
  const calls: Calls = { starts: [], finishes: [] };
  let current = listed;
  let purpose = '';
  let reauth = options.reauthOnce ?? false;
  server.use(
    http.get(api('/auth/nostr/identities'), () => HttpResponse.json(current)),
    http.post(api('/auth/nostr/start'), async ({ request }) => {
      const body = await request.json();
      calls.starts.push({ body, csrf: request.headers.get('X-CSRF-Token') });
      purpose = typeof body === 'object' && body !== null && 'purpose' in body ? String(body.purpose) : '';
      if (purpose === 'unlink' && current.passkey_count + current.identities.length <= 1) {
        return HttpResponse.json(safeError('last_credential', 'Last credential.'), { status: 409 });
      }
      if (purpose === 'link' && reauth) {
        reauth = false;
        return HttpResponse.json(safeError('reauth_required', 'Sign in again.'), { status: 403 });
      }
      return HttpResponse.json(nostrChallenge(purpose === 'unlink' ? 'unlink' : 'link'));
    }),
    http.post(api('/auth/nostr/finish'), async ({ request }) => {
      calls.finishes.push(await request.json());
      const response = finish(purpose);
      if (response.ok && purpose === 'link') {
        current = { ...current, identities: [...current.identities, nostrIdentity(1)] };
      }
      return response;
    }),
  );
  return calls;
}

const section = async () => screen.findByRole('region', { name: 'Sign-in methods' });
const fact = (region: HTMLElement, label: string) => within(region).getByText(label, { selector: 'dt' }).nextElementSibling;

describe('More: sign-in methods', () => {
  it('lists the passkey count and each linked key as a truncated npub with copy', async () => {
    methodsServer(nostrIdentities([nostrIdentity(0)], 2), () => HttpResponse.json({}));
    renderApp('/more');
    const region = await section();

    await waitFor(() => expect(fact(region, 'Passkeys')).toHaveTextContent('2'));
    const npub = NOSTR_KEYS[0].npub;
    expect(within(region).getByTitle(npub)).toHaveTextContent(`${npub.slice(0, 8)}…${npub.slice(-6)}`);
    expect(within(region).getByRole('button', { name: 'Copy npub' })).toBeInTheDocument();
    expect(within(region).getByRole('button', { name: 'Remove…' })).toBeEnabled();
  });

  it('disables Link Nostr with the literal reason when there is no extension', async () => {
    renderApp('/more');
    const region = await section();
    const link = within(region).getByRole('button', { name: 'Link Nostr' });
    expect(link).toBeDisabled();
    expect(link).toHaveAccessibleDescription('No Nostr extension found.');
  });

  it('links the extension key with a fresh signature from this session and lists it', async () => {
    const signEvent = installNostrExtension(1);
    const calls = methodsServer(nostrIdentities([], 1), () => HttpResponse.json({ identity: nostrIdentity(1) }));
    const view = renderApp('/more');
    const region = await section();
    await waitFor(() => expect(fact(region, 'Nostr keys')).toHaveTextContent('0'));

    await view.user.click(within(region).getByRole('button', { name: 'Link Nostr' }));

    expect(await within(region).findByTitle(NOSTR_KEYS[1].npub)).toBeInTheDocument();
    expect(calls.starts).toEqual([{ body: { purpose: 'link' }, csrf: fixture('session').csrf_token }]);
    expect(signEvent).toHaveBeenCalledWith(nostrChallenge('link').event);
    expect(view.router.state.location.pathname).toBe('/more');
  });

  it('proves the current method before linking when the server asks for it', async () => {
    const signEvent = installNostrExtension(1);
    const calls = methodsServer(
      nostrIdentities([], 1),
      () => HttpResponse.json({ identity: nostrIdentity(1) }),
      { reauthOnce: true },
    );
    const rotated = { ...fixture('session'), csrf_token: 'ROTATED_SESSION_CSRF' };
    server.use(
      http.post(api('/auth/passkey/start'), () => HttpResponse.json(fixture('login_challenge'))),
      http.post(api('/auth/passkey/finish'), () => HttpResponse.json(rotated)),
    );
    webauthn.startAuthentication.mockResolvedValue(assertion);

    const view = renderApp('/more');
    const region = await section();
    await view.user.click(within(region).getByRole('button', { name: 'Link Nostr' }));

    await waitFor(() => expect(calls.starts).toHaveLength(2));
    expect(await within(region).findByTitle(NOSTR_KEYS[1].npub)).toBeInTheDocument();
    expect(webauthn.startAuthentication).toHaveBeenCalledTimes(1);
    expect(calls.starts.map((call) => (call.body as { purpose: string }).purpose)).toEqual(['link', 'link']);
    expect(calls.starts.map((call) => call.csrf)).toEqual([fixture('session').csrf_token, rotated.csrf_token]);
    expect(signEvent).toHaveBeenCalledTimes(1);
  });

  it('removes a key only after the confirmation, then ends this session', async () => {
    const signEvent = installNostrExtension(0);
    const calls = methodsServer(nostrIdentities([nostrIdentity(0)], 1), () => HttpResponse.json({ removed: true }));
    const view = renderApp('/more');
    const region = await section();

    await view.user.click(await within(region).findByRole('button', { name: 'Remove…' }));
    expect(calls.starts).toEqual([]);
    await view.user.click(within(region).getByRole('button', { name: 'Cancel' }));
    await view.user.click(within(region).getByRole('button', { name: 'Remove…' }));
    await view.user.click(within(region).getByRole('button', { name: 'Remove key' }));

    await waitFor(() => expect(view.router.state.location.pathname).toBe('/login'));
    expect(view.router.state.location.search).toEqual({ notice: 'signed_out' });
    expect(calls.starts).toEqual([{ body: { purpose: 'unlink', pubkey: NOSTR_KEYS[0].pubkey }, csrf: fixture('session').csrf_token }]);
    expect(signEvent).toHaveBeenCalledTimes(1);
    expect(sessionCsrfToken()).toBeNull();
    expect(await screen.findByText('Signed out.')).toBeInTheDocument();
  });

  it('keeps the last sign-in method: no removal, with the literal sentence', async () => {
    installNostrExtension(0);
    methodsServer(nostrIdentities([nostrIdentity(0)], 0), () => HttpResponse.json({ removed: true }));
    renderApp('/more');
    const region = await section();

    expect(await within(region).findByRole('button', { name: 'Remove…' })).toBeDisabled();
    expect(within(region).getByText(KEEP_ONE)).toBeInTheDocument();
  });

  it('reads the server refusal of a last credential with the same sentence and stays signed in', async () => {
    installNostrExtension(0);
    // The list said two keys; the server knows one went meanwhile.
    const calls = methodsServer(nostrIdentities([nostrIdentity(0), nostrIdentity(1)], 0), () => HttpResponse.json({ removed: true }));
    server.use(
      http.post(api('/auth/nostr/start'), () => HttpResponse.json(safeError('last_credential', 'Last credential.'), { status: 409 })),
    );
    const view = renderApp('/more');
    const region = await section();

    const [first] = await within(region).findAllByRole('button', { name: 'Remove…' });
    await view.user.click(first);
    await view.user.click(within(region).getByRole('button', { name: 'Remove key' }));

    expect(await within(region).findByText(KEEP_ONE)).toBeInTheDocument();
    expect(calls.finishes).toEqual([]);
    expect(view.router.state.location.pathname).toBe('/more');
  });

  it('asks for the removed key when the extension signs with another one', async () => {
    installNostrExtension(1);
    methodsServer(nostrIdentities([nostrIdentity(0)], 1), () =>
      HttpResponse.json(safeError('authentication_failed', 'Authentication failed.'), { status: 409 }),
    );
    const view = renderApp('/more');
    const region = await section();
    await view.user.click(await within(region).findByRole('button', { name: 'Remove…' }));
    await view.user.click(within(region).getByRole('button', { name: 'Remove key' }));

    expect(await within(region).findByText('Sign with the key you are removing.')).toBeInTheDocument();
    expect(view.router.state.location.pathname).toBe('/more');
  });

  it('reads a refused link signature and sends no finish', async () => {
    installNostrExtension(1).mockRejectedValue(new Error('User rejected'));
    const calls = methodsServer(nostrIdentities([], 1), () => HttpResponse.json({ identity: nostrIdentity(1) }));
    const view = renderApp('/more');
    const region = await section();
    await view.user.click(within(region).getByRole('button', { name: 'Link Nostr' }));

    expect(await within(region).findByText('Nostr signature canceled. Nothing was sent.')).toBeInTheDocument();
    expect(calls.finishes).toEqual([]);
  });

  it('shows how a Nostr session meets the confirmation policy', async () => {
    server.use(
      http.get(api('/session'), () =>
        HttpResponse.json({ ...fixture('session'), auth_method: 'nostr', nostr_pubkey: NOSTR_KEYS[0].pubkey }),
      ),
    );
    renderApp('/more');
    const session = await screen.findByRole('region', { name: 'Session' });
    await waitFor(() => expect(fact(session, 'Signed in with')).toHaveTextContent('Nostr'));
    expect(fact(session, 'Confirmation')).toHaveTextContent('Nostr signature for every payment');
  });
});
