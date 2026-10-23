import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AuthMethod } from '../../api/types';
import { sessionQueryOptions } from './queries';

/**
 * How this session signed in, which is also how it approves sensitive operations. Read once from
 * the session the authenticated routes loaded: a session never changes method, and a new one
 * clears the cache and remounts. Not subscribed, so a session-loss clear does not re-render the
 * screen into re-adding its reads; the primary method stands in only if no session was cached.
 */
export function useAuthMethod(): AuthMethod {
  const queryClient = useQueryClient();
  const [method] = useState(() => queryClient.getQueryData(sessionQueryOptions.queryKey)?.auth_method ?? 'passkey');
  return method;
}
