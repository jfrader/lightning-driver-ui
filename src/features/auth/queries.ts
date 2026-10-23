import { queryOptions } from '@tanstack/react-query';
import { setSessionCsrfToken } from '../../api/csrf';
import { getBootstrap, getNostrIdentities, getPublicPolicy, getSession } from './api';

export const sessionQueryKey = ['session'] as const;

export const sessionQueryOptions = queryOptions({
  queryKey: sessionQueryKey,
  queryFn: async ({ signal }) => {
    const session = await getSession(signal);
    setSessionCsrfToken(session.csrf_token);
    return session;
  },
});

export const bootstrapQueryOptions = queryOptions({
  queryKey: ['auth-bootstrap'],
  queryFn: ({ signal }) => getBootstrap(signal),
  staleTime: 0,
});

export const nostrIdentitiesQueryOptions = queryOptions({
  queryKey: ['nostr-identities'],
  queryFn: ({ signal }) => getNostrIdentities(signal),
});

export const publicPolicyQueryOptions = queryOptions({
  queryKey: ['public-policy'],
  queryFn: ({ signal }) => getPublicPolicy(signal),
});
