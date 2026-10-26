import type { ReactNode } from 'react';
import { useIsMutating, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { operationQueryOptions } from '../../api/node-queries';
import type { NodeSummary } from '../../api/types';
import { ErrorNotice } from '../../components/ErrorNotice';
import { LoadingState } from '../../components/LoadingState';
import { OperationSheet } from '../../components/OperationSheet';
import { publicPolicyQueryOptions } from '../auth/queries';
import { isInFlight, OPERATION_KIND } from '../operations/labels';
import { OperationView } from '../operations/OperationView';
import { OperationSheetContext } from '../operations/sheet-context';
import { useMoneySheet } from './use-money-sheet';

export function GlobalMoneySheet({ node }: { node: NodeSummary }) {
  const sheet = useMoneySheet();
  const { operation: operationId } = sheet.search;
  const unanswered = sheet.search.confirmation === 'unanswered';
  const pollMs = useSuspenseQuery(publicPolicyQueryOptions).data.operation_poll_seconds * 1000;
  const operation = useQuery({
    ...operationQueryOptions(node.id, operationId ?? ''),
    enabled: !!operationId,
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      return state && (isInFlight(state) || (unanswered && state === 'awaiting_confirmation')) ? pollMs : false;
    },
  });
  const busy = useIsMutating({ mutationKey: ['confirm-operation', operationId] }) > 0;
  const current = operation.data;
  const review = current?.state === 'awaiting_confirmation' && !unanswered;
  const title = current ? OPERATION_KIND[current.request.kind] : 'Operation';

  let content: ReactNode;
  if (operation.isPending) content = <LoadingState label="Loading operation" />;
  else if (operation.isError) content = <ErrorNotice error={operation.error} onRetry={() => void operation.refetch()} />;
  else content = <OperationView operation={operation.data} node={node} unanswered={unanswered} />;

  return (
    <OperationSheetContext value={{
      onCreated: (created) => sheet.update({ operation: created.id }),
      onUnanswered: () => sheet.update({ operation: operationId, confirmation: 'unanswered' }),
      discard: sheet.close,
    }}>
      <OperationSheet title={title} hasReview={review} busy={busy} onClose={sheet.close} onDiscard={sheet.close}>
        {content}
      </OperationSheet>
    </OperationSheetContext>
  );
}
