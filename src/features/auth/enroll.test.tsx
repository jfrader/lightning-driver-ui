import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fixture } from '../../test/fixtures';
import { renderApp } from '../../test/render-app';
import { api, safeError, server } from '../../test/server';

const webauthn = vi.hoisted(() => ({ startAuthentication: vi.fn(), startRegistration: vi.fn() }));
vi.mock('@simplewebauthn/browser', async (importOriginal) =>
  (await import('../../test/webauthn-mock')).webauthnModule(importOriginal, webauthn),
);

const TOKEN = 'host-issued-enrollment-token-0123456789abcdef';
const registration = {
  id: 'c3ludGhldGljLW5ldy1jcmVkZW50aWFs',
  rawId: 'c3ludGhldGljLW5ldy1jcmVkZW50aWFs',
  type: 'public-key' as const,
  response: { clientDataJSON: 'c3ludGhldGljLWNsaWVudC1kYXRh', attestationObject: 'c3ludGhldGljLWF0dGVzdGF0aW9u' },
  clientExtensionResults: {},
};

let starts: { body: unknown; csrf: string | null }[] = [];
let finishes: unknown[] = [];

beforeEach(() => {
  starts = [];
  finishes = [];
  let enrolled = false;
  server.use(
    http.get(api('/auth/bootstrap'), () => HttpResponse.json({ ...fixture('bootstrap'), enrollment_available: true })),
    http.get(api('/session'), () =>
      enrolled
        ? HttpResponse.json(fixture('session'))
        : HttpResponse.json(safeError('session_required', 'Sign in.'), { status: 401 }),
    ),
    http.post(api('/auth/enrollment/start'), async ({ request }) => {
      starts.push({ body: await request.json(), csrf: request.headers.get('X-CSRF-Token') });
      return HttpResponse.json(fixture('enrollment_challenge'));
    }),
    http.post(api('/auth/enrollment/finish'), async ({ request }) => {
      finishes.push(await request.json());
      enrolled = true;
      return HttpResponse.json(fixture('session'));
    }),
  );
});

async function submitToken(view: ReturnType<typeof renderApp>, clicks: 1 | 2 = 1) {
  await view.user.type(await screen.findByLabelText(/^Enrollment token/), TOKEN);
  const create = screen.getByRole('button', { name: 'Create passkey' });
  if (clicks === 2) await view.user.dblClick(create);
  else await view.user.click(create);
}

describe('passkey enrollment', () => {
  it('reaches enrollment from sign-in, registers a passkey with the host token and signs in', async () => {
    webauthn.startRegistration.mockResolvedValue(registration);
    const view = renderApp('/login');
    await view.user.click(await screen.findByRole('link', { name: 'Enroll a passkey' }));

    await submitToken(view);

    expect(await screen.findByRole('heading', { name: 'Choose a node' })).toBeInTheDocument();
    expect(starts).toEqual([{ body: { enrollment_token: TOKEN }, csrf: 'SYNTHETIC_PREAUTH_CSRF_ONLY' }]);
    expect(webauthn.startRegistration).toHaveBeenCalledWith({
      optionsJSON: expect.objectContaining({
        challenge: fixture('enrollment_challenge').options.publicKey.challenge,
        authenticatorSelection: expect.objectContaining({ userVerification: 'required' }),
      }),
    });
    expect(finishes).toEqual([
      { challenge_id: fixture('enrollment_challenge').challenge_id, credential: expect.objectContaining({ id: registration.id }) },
    ]);
    expect(window.localStorage.length).toBe(0);
  });

  it('starts one enrollment for a double-clicked submit', async () => {
    webauthn.startRegistration.mockResolvedValue(registration);
    const view = renderApp('/enroll');

    await submitToken(view, 2);

    await screen.findByRole('heading', { name: 'Choose a node' });
    expect(starts).toHaveLength(1);
    expect(finishes).toHaveLength(1);
  });

  it('reports a canceled passkey prompt and does not finish or retry', async () => {
    webauthn.startRegistration.mockRejectedValue(new DOMException('Not allowed', 'NotAllowedError'));
    const view = renderApp('/enroll');

    await submitToken(view);

    expect(await screen.findByText('Passkey request canceled. Nothing was sent.')).toBeInTheDocument();
    expect(starts).toHaveLength(1);
    expect(finishes).toEqual([]);
    expect(screen.getByLabelText(/^Enrollment token/)).toHaveValue('');
    expect(view.router.state.location.pathname).toBe('/enroll');
  });

  it('reports an authenticator failure without finishing', async () => {
    webauthn.startRegistration.mockRejectedValue(new DOMException('Already registered', 'InvalidStateError'));
    const view = renderApp('/enroll');

    await submitToken(view);

    expect(
      await screen.findByText('This device could not complete the passkey request. Try again or use another passkey.'),
    ).toBeInTheDocument();
    expect(finishes).toEqual([]);
  });

  it('shows the server refusal of a used or expired token and never opens a passkey prompt', async () => {
    server.use(
      http.post(api('/auth/enrollment/start'), () =>
        HttpResponse.json(safeError('enrollment_unavailable', 'This enrollment token is not valid.'), { status: 403 }),
      ),
    );
    const view = renderApp('/enroll');

    await submitToken(view);

    expect(await screen.findByText('This enrollment token is not valid.')).toBeInTheDocument();
    expect(webauthn.startRegistration).not.toHaveBeenCalled();
    expect(finishes).toEqual([]);
  });
});
