import { Flex } from '@jfrader/ui';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { operationQueryOptions } from '../../api/node-queries';
import { ButtonLink } from '../../components/ButtonLink';
import { ErrorNotice } from '../../components/ErrorNotice';
import { LoadingState } from '../../components/LoadingState';
import { PageHeader } from '../../components/PageHeader';
import { Panel } from '../../components/Panel';
import { publicPolicyQueryOptions } from '../auth/queries';
import { useNodeLookup } from '../nodes/use-current-node';
import { PaymentReview } from '../payments/review/PaymentReview';
import { ConfirmPanel } from './ConfirmPanel';
import { OPERATION_KIND, isInFlight } from './labels';
import { OperationDetail } from './OperationDetail';
import { OperationReviewDetails } from './OperationReviewDetails';

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
  if (operation.isError) return <ErrorNotice error={operation.error} onRetry={() => void operation.refetch()} />;

  const current = operation.data;
  if (current.state !== 'awaiting_confirmation' || unanswered) {
    return <OperationDetail operation={current} node={node} unanswered={unanswered} />;
  }
  if (current.request.kind === 'pay_invoice') {
    return <PaymentReview key={current.id} operation={current} bolt11={current.request.params.bolt11} node={node} />;
  }
  // The other kinds' reviews are rebuilt with their forms; until then they keep this layout.
  return (
    <Flex direction="column" gap="md">
      <PageHeader
        title={OPERATION_KIND[current.request.kind]}
        actions={
          <ButtonLink to="/nodes/$nodeId/operations" params={{ nodeId }} search={{}} variant="ghost">
            All operations
          </ButtonLink>
        }
      />
      <Panel title="Review">
        <OperationReviewDetails operation={current} />
      </Panel>
      <ConfirmPanel key={current.id} operation={current} node={node} />
    </Flex>
  );
}
