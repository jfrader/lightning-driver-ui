import { Button, Flex, styled } from '@jfrader/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ActiveSession } from '../../api/types';
import { DetailList } from '../../components/DetailList';
import { ErrorNotice } from '../../components/ErrorNotice';
import { UtcTime } from '../../components/UtcTime';
import { useControlSize } from '../shell/use-shell-layout';
import { revokeSession } from './api';
import { AUTH_METHOD_LABEL } from './labels';
import { sessionsQueryOptions } from './queries';

const List = styled.ul(({ theme }) => ({
  margin: 0,
  padding: 0,
  listStyle: 'none',
  display: 'grid',
  gap: theme.space[6],
  minInlineSize: 0,
}));

const Line = styled.p({ margin: 0, overflowWrap: 'anywhere' });

function SessionRow({ session }: { session: ActiveSession }) {
  const size = useControlSize();
  const queryClient = useQueryClient();
  const revoke = useMutation({
    mutationFn: () => revokeSession(session.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionsQueryOptions.queryKey }),
  });

  return (
    <li>
      <Flex direction="column" gap="sm" aria-busy={revoke.isPending || undefined}>
        <Flex wrap gap="sm" align="center">
          <strong>{AUTH_METHOD_LABEL[session.method]}</strong>
          {session.current && <span>Current session</span>}
        </Flex>
        <DetailList items={[
          { label: 'Created', value: <UtcTime value={session.created_at} /> },
          { label: 'Expires', value: <UtcTime value={session.expires_at} /> },
        ]} />
        {!session.current && (
          <div>
            <Button size={size} variant="outline" loading={revoke.isPending} onClick={() => revoke.mutate()}>
              {revoke.isPending ? 'Signing out…' : 'Sign out'}
            </Button>
          </div>
        )}
        {revoke.isError && <ErrorNotice error={revoke.error} />}
      </Flex>
    </li>
  );
}

export function Sessions() {
  const sessions = useQuery(sessionsQueryOptions);
  const rows = sessions.data?.sessions.toSorted((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

  return (
    <Flex direction="column" gap="sm" aria-busy={sessions.isPending || undefined}>
      {sessions.isPending && <Line role="status">Loading sessions…</Line>}
      {sessions.isError && <ErrorNotice error={sessions.error} onRetry={() => void sessions.refetch()} />}
      {rows && (
        <>
          {rows.every((session) => session.current) && <Line>No other sessions.</Line>}
          <List aria-label="Active sessions">
            {rows.map((session) => <SessionRow key={session.id} session={session} />)}
          </List>
        </>
      )}
    </Flex>
  );
}
