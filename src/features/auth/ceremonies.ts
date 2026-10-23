import type { CsrfSource } from '../../api/client';
import { errorCode } from '../../api/errors';
import { NostrIdentityResponse, NostrRemoved, Session as isSession, type ContractValidator } from '../../api/generated/validators';
import type { AuthMethod, NostrIdentity, NostrStart, Session } from '../../api/types';
import {
  finishEnrollment,
  finishLogin,
  finishNostr,
  getBootstrap,
  startEnrollment,
  startLogin,
  startNostr,
} from './api';
import { signNostrEvent } from './nostr';
import { requestPasskeyAssertion, requestPasskeyRegistration } from './passkey';

/** Fresh preauth context, server challenge, passkey assertion, then a new session. */
export async function signInWithPasskey(): Promise<Session> {
  const { csrf_token: preauthToken } = await getBootstrap();
  const challenge = await startLogin(preauthToken);
  const credential = await requestPasskeyAssertion(challenge.options);
  return finishLogin(preauthToken, challenge.challenge_id, credential);
}

/** Registers a passkey with a one-use enrollment token issued on the host. */
export async function enrollPasskey(enrollmentToken: string): Promise<Session> {
  const { csrf_token: preauthToken } = await getBootstrap();
  const challenge = await startEnrollment(preauthToken, enrollmentToken);
  const credential = await requestPasskeyRegistration(challenge.options);
  return finishEnrollment(preauthToken, challenge.challenge_id, credential);
}

/** Server challenge, extension signature over its event template, then the purpose's answer. */
async function nostrCeremony<T>(csrf: CsrfSource, start: NostrStart, response: ContractValidator<T>): Promise<T> {
  const challenge = await startNostr(csrf, start);
  const event = await signNostrEvent(challenge.event);
  return finishNostr(csrf, challenge.challenge_id, event, response);
}

async function preauth(): Promise<CsrfSource> {
  const { csrf_token: token } = await getBootstrap();
  return { kind: 'preauth', token };
}

export async function signInWithNostr(): Promise<Session> {
  return nostrCeremony(await preauth(), { purpose: 'login' }, isSession);
}

/** Enrolls the extension's key with the host token; a failed signature leaves the token usable. */
export async function enrollNostr(enrollmentToken: string): Promise<Session> {
  return nostrCeremony(await preauth(), { purpose: 'enrollment', token: enrollmentToken }, isSession);
}

/** Signs in again with the method that owns this session, replacing it with a fresh one. */
async function proveCurrentMethod(method: AuthMethod): Promise<Session> {
  return method === 'passkey' ? signInWithPasskey() : signInWithNostr();
}

/**
 * Adds the extension's key to the signed-in operator. The server requires a session that
 * proved its own method moments ago, so a stale session signs in again first and the link
 * is retried once on the rotated session.
 */
export async function linkNostr(method: AuthMethod): Promise<NostrIdentity> {
  const link = async () => {
    const { identity } = await nostrCeremony({ kind: 'session' }, { purpose: 'link' }, NostrIdentityResponse);
    return identity;
  };
  try {
    return await link();
  } catch (error) {
    if (errorCode(error) !== 'reauth_required') throw error;
    await proveCurrentMethod(method);
    return link();
  }
}

/** Removes an identity with a signature from that key. The server then ends this session. */
export async function unlinkNostr(pubkey: string): Promise<void> {
  await nostrCeremony({ kind: 'session' }, { purpose: 'unlink', pubkey }, NostrRemoved);
}
