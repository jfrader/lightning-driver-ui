import type { ReactNode } from 'react';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useIsMutating, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { operationQueryOptions } from '../../api/node-queries';
import type { OperationKind } from '../../api/types';
import { OperationSheet } from '../../components/OperationSheet';
import { LoadingState } from '../../components/LoadingState';
import { ErrorNotice } from '../../components/ErrorNotice';
import { publicPolicyQueryOptions } from '../auth/queries';
import { useCurrentNode } from '../nodes/use-current-node';
import { isInFlight, OPERATION_KIND } from './labels';
import { OperationView } from './OperationView';
import { OperationSheetContext } from './sheet-context';
import { FORM_DESTINATIONS } from '../shell/nav-model';

const OPERATION_LISTS = {
  payments: '/nodes/$nodeId/payments',
  invoices: '/nodes/$nodeId/invoices',
  peers: '/nodes/$nodeId/peers',
  channels: '/nodes/$nodeId/channels',
  onchain: '/nodes/$nodeId/onchain',
} as const;
type OperationList = keyof typeof OPERATION_LISTS;

function useListNavigation(list: OperationList) {
  const node = useCurrentNode();
  const navigate = useNavigate();
  return {
    node,
    close: () => void navigate({ to: OPERATION_LISTS[list], params: { nodeId: node.id }, search: (previous) => previous }),
    review: (operationId: string) => void navigate({ to: `${OPERATION_LISTS[list]}/review/$operationId`, params: { nodeId: node.id, operationId }, search: (previous) => ({ ...previous, confirmation: undefined }), replace: true }),
    unanswered: () => void navigate({ to: '.', search: (previous) => ({ ...previous, confirmation: 'unanswered' }), replace: true }),
  };
}

export function OperationFormRoute({ list, kind, children }: { list: OperationList; kind: OperationKind; children: ReactNode }) {
  const search = useSearch({ strict: false });
  const navigation = useListNavigation(list);
  if (search.send || search.receive || search.operation) return null;
  return (
    <OperationSheetContext value={{ onCreated: (created) => navigation.review(created.id), onUnanswered: navigation.close, discard: navigation.close }}>
      <OperationSheet title={OPERATION_KIND[kind]} hasReview={false} busy={false} onClose={navigation.close} onDiscard={navigation.close}>{children}</OperationSheet>
    </OperationSheetContext>
  );
}

export function OperationReviewRoute({ list }: { list: OperationList }) {
  const search = useSearch({ strict: false });
  const { operationId = '' } = useParams({ strict: false });
  const navigation = useListNavigation(list);
  const pollMs = useSuspenseQuery(publicPolicyQueryOptions).data.operation_poll_seconds * 1000;
  const navigate = useNavigate();
  const unanswered = search.confirmation === 'unanswered';
  const operation = useQuery({
    ...operationQueryOptions(navigation.node.id, operationId),
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      return state && (isInFlight(state) || (unanswered && state === 'awaiting_confirmation')) ? pollMs : false;
    },
  });
  const busy = useIsMutating({ mutationKey: ['confirm-operation', operationId] }) > 0;
  const discard = () => {
    const request = operation.data?.request;
    if (request?.kind === 'close_channel') {
      void navigate({ to: '/nodes/$nodeId/channels/$channelId/close', params: { nodeId: navigation.node.id, channelId: request.params.channel_id }, search: true });
      return;
    }
    const form = FORM_DESTINATIONS.find((candidate) => candidate.capability === request?.kind);
    if (form) void navigate({ to: form.to, params: { nodeId: navigation.node.id }, search: (previous) => previous });
    else navigation.close();
  };
  if (search.send || search.receive || search.operation) return null;
  return (
    <OperationSheetContext value={{ onCreated: (created) => navigation.review(created.id), onUnanswered: navigation.unanswered, discard }}>
      <OperationSheet title={operation.data ? OPERATION_KIND[operation.data.request.kind] : 'Operation'} hasReview={operation.data === undefined || (operation.data.state === 'awaiting_confirmation' && !unanswered)} busy={busy} onClose={navigation.close} onDiscard={discard}>
        {operation.isPending ? <LoadingState label="Loading operation" /> : operation.isError ? <ErrorNotice error={operation.error} onRetry={() => void operation.refetch()} /> : <OperationView operation={operation.data} node={navigation.node} unanswered={unanswered} />}
      </OperationSheet>
    </OperationSheetContext>
  );
}
