import { useState } from 'react';
import { useIsMutating, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { operationQueryOptions } from '../../api/node-queries';
import { ErrorNotice } from '../../components/ErrorNotice';
import { LoadingState } from '../../components/LoadingState';
import { OperationSheet } from '../../components/OperationSheet';
import { publicPolicyQueryOptions } from '../auth/queries';
import { FlowFrame } from '../forms/FlowFrame';
import { useCurrentNode } from '../nodes/use-current-node';
import { isInFlight } from '../operations/labels';
import { OperationDetail } from '../operations/OperationDetail';
import { OperationSheetContext } from '../operations/sheet-context';
import { PayInvoiceForm } from './PayInvoiceForm';
import { PaymentReview } from './review/PaymentReview';

const route = getRouteApi('/_authed/nodes/$nodeId/_configured/payments/new');

export function PayInvoicePage() {
  const node = useCurrentNode();
  const navigate = route.useNavigate();
  const [operationId, setOperationId] = useState<string | null>(null);
  const [unanswered, setUnanswered] = useState(false);
  const busy = useIsMutating({ mutationKey: ['confirm-operation', operationId] }) > 0;
  const pollMs = useSuspenseQuery(publicPolicyQueryOptions).data.operation_poll_seconds * 1000;
  const operation = useQuery({
    ...operationQueryOptions(node.id, operationId ?? ''),
    enabled: operationId !== null,
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      return state && (isInFlight(state) || (unanswered && state === 'awaiting_confirmation')) ? pollMs : false;
    },
  });
  const close = () => void navigate({ to: '/nodes/$nodeId/payments', params: { nodeId: node.id }, search: (previous) => previous });
  const discard = () => {
    setOperationId(null);
    setUnanswered(false);
  };
  const current = operation.data;
  const reviewing = operationId !== null && (!current || (current.state === 'awaiting_confirmation' && !unanswered));
  let content = (
    <FlowFrame title="Pay invoice" capability="pay_invoice" back={null}>
      {({ policy }) => <PayInvoiceForm node={node} policy={policy} />}
    </FlowFrame>
  );
  if (operationId !== null) {
    if (operation.isPending) content = <LoadingState label="Loading operation" />;
    else if (operation.isError) content = <ErrorNotice error={operation.error} onRetry={() => void operation.refetch()} />;
    else {
      const reviewed = operation.data;
      content = reviewed.state === 'awaiting_confirmation' && !unanswered && reviewed.request.kind === 'pay_invoice'
        ? <PaymentReview key={reviewed.id} operation={reviewed} bolt11={reviewed.request.params.bolt11} node={node} />
        : <OperationDetail operation={reviewed} node={node} unanswered={unanswered} />;
    }
  }
  return (
    <OperationSheetContext value={{ onCreated: (created) => setOperationId(created.id), onUnanswered: () => setUnanswered(true), discard }}>
      <OperationSheet title="Pay invoice" hasReview={reviewing} busy={busy} onClose={close} onDiscard={discard}>
        {content}
      </OperationSheet>
    </OperationSheetContext>
  );
}
