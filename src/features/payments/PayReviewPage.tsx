import { useIsMutating, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { operationQueryOptions } from '../../api/node-queries';
import { ErrorNotice } from '../../components/ErrorNotice';
import { LoadingState } from '../../components/LoadingState';
import { OperationSheet } from '../../components/OperationSheet';
import { publicPolicyQueryOptions } from '../auth/queries';
import { useCurrentNode } from '../nodes/use-current-node';
import { isInFlight } from '../operations/labels';
import { OperationDetail } from '../operations/OperationDetail';
import { OperationSheetContext } from '../operations/sheet-context';
import { PaymentReview } from './review/PaymentReview';

const route = getRouteApi('/_authed/nodes/$nodeId/_configured/payments/review/$operationId');

/** The review and result of one payment over its list; the address bar names the operation. */
export function PayReviewPage() {
  const node = useCurrentNode();
  const { operationId } = route.useParams();
  const navigate = route.useNavigate();
  const pollMs = useSuspenseQuery(publicPolicyQueryOptions).data.operation_poll_seconds * 1000;
  const operation = useQuery({
    ...operationQueryOptions(node.id, operationId),
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      return state && isInFlight(state) ? pollMs : false;
    },
  });
  const busy = useIsMutating({ mutationKey: ['confirm-operation', operationId] }) > 0;
  const list = () => void navigate({ to: '/nodes/$nodeId/payments', params: { nodeId: node.id }, search: (previous) => previous });
  const form = () => void navigate({ to: '/nodes/$nodeId/payments/new', params: { nodeId: node.id }, search: (previous) => previous });
  const content = operation.isPending ? (
    <LoadingState label="Loading operation" />
  ) : operation.isError ? (
    <ErrorNotice error={operation.error} onRetry={() => void operation.refetch()} />
  ) : operation.data.request.kind === 'pay_invoice' && operation.data.state === 'awaiting_confirmation' ? (
    <PaymentReview key={operation.data.id} operation={operation.data} bolt11={operation.data.request.params.bolt11} node={node} />
  ) : (
    <OperationDetail operation={operation.data} node={node} unanswered={false} />
  );
  return (
    <OperationSheetContext value={{ onCreated: () => {}, onUnanswered: list, discard: form }}>
      <OperationSheet title="Pay invoice" hasReview busy={busy} onClose={list} onDiscard={form}>
        {content}
      </OperationSheet>
    </OperationSheetContext>
  );
}
