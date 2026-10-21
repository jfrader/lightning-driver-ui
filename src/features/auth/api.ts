import { apiRequest, apiRequestNoContent } from '../../api/client';
import {
  AuthBootstrap,
  AuthenticationChallenge,
  PublicPolicy,
  RegistrationChallenge,
  Session,
} from '../../api/generated/validators';
import type { AuthenticationCredential, RegistrationCredential } from '../../api/types';

export function getBootstrap(signal?: AbortSignal) {
  return apiRequest({ method: 'GET', path: '/auth/bootstrap', response: AuthBootstrap, signal });
}

export function getSession(signal?: AbortSignal) {
  return apiRequest({ method: 'GET', path: '/session', response: Session, signal });
}

export function getPublicPolicy(signal?: AbortSignal) {
  return apiRequest({ method: 'GET', path: '/config', response: PublicPolicy, signal });
}

export function startLogin(preauthToken: string) {
  return apiRequest({
    method: 'POST',
    path: '/auth/passkey/start',
    body: {},
    csrf: { kind: 'preauth', token: preauthToken },
    response: AuthenticationChallenge,
  });
}

export function finishLogin(preauthToken: string, challengeId: string, credential: AuthenticationCredential) {
  return apiRequest({
    method: 'POST',
    path: '/auth/passkey/finish',
    body: { challenge_id: challengeId, credential },
    csrf: { kind: 'preauth', token: preauthToken },
    response: Session,
  });
}

export function startEnrollment(preauthToken: string, enrollmentToken: string) {
  return apiRequest({
    method: 'POST',
    path: '/auth/enrollment/start',
    body: { enrollment_token: enrollmentToken },
    csrf: { kind: 'preauth', token: preauthToken },
    response: RegistrationChallenge,
  });
}

export function finishEnrollment(preauthToken: string, challengeId: string, credential: RegistrationCredential) {
  return apiRequest({
    method: 'POST',
    path: '/auth/enrollment/finish',
    body: { challenge_id: challengeId, credential },
    csrf: { kind: 'preauth', token: preauthToken },
    response: Session,
  });
}

export function logout() {
  return apiRequestNoContent({ method: 'DELETE', path: '/session' });
}
