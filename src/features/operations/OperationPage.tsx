import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Flex } from '@jfrader/ui';
import { getRouteApi } from '@tanstack/react-router';
import { operationQueryOptions } from '../../api/node-queries';
import { ErrorNotice } from '../../components/ErrorNotice';
import { LoadingState } from '../../components/LoadingState';
import { publicPolicyQueryOptions } from '../auth/queries';
import { useNodeLookup } from '../nodes/use-current-node';
import { isInFlight } from './labels';
import { OperationView } from './OperationView';

const route = getRouteApi('/_authed/nodes/$nodeId/operations/$operationId');

/**
 * One journaled operation, bound to the node in the URL: its review while it awaits confirmation,
 * and afterwards (or once a confirm got no answer) what happened to it.
 */
export function OperationPage() {
  const { nodeId, operationId } = route.useParams();
  const unanswered = route.useSearch().confirmation === 'unanswered';
  const { node } = useNodeLookup();
  const pollMs = useSuspenseQuery(publicPolicyQueryOptions).data.operation_poll_seconds * 1000;
  const operation = useQuery({
    ...operationQueryOptions(nodeId, operationId),
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      if (state === undefined) return false;
      return isInFlight(state) || (unanswered && state === 'awaiting_confirmation') ? pollMs : false;
    },
  });

  if (operation.isPending) return <LoadingState label="Loading operation" />;
  if (operation.isError && !operation.data) return <ErrorNotice error={operation.error} onRetry={() => void operation.refetch()} />;
  if (!operation.data) return null;

  return (
    <Flex direction="column" gap="md">
      {operation.isError && <ErrorNotice error={operation.error} stale onRetry={() => void operation.refetch()} />}
      <OperationView operation={operation.data} node={node} unanswered={unanswered} stale={operation.isError} />
    </Flex>
  );
}
