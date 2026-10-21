import type { Session } from '../../api/types';
import { finishEnrollment, finishLogin, getBootstrap, startEnrollment, startLogin } from './api';
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
