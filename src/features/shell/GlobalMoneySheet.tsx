import type { ReactNode } from 'react';
import { Button, Flex } from '@jfrader/ui';
import { useIsMutating, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { operationQueryOptions } from '../../api/node-queries';
import type { NodePolicy, NodeSummary } from '../../api/types';
import { MONEY_ACTIONS, type MoneySearch } from '../../app/search';
import { ErrorNotice } from '../../components/ErrorNotice';
import { LoadingState } from '../../components/LoadingState';
import { OperationSheet } from '../../components/OperationSheet';
import { publicPolicyQueryOptions } from '../auth/queries';
import { FlowFrame } from '../forms/FlowFrame';
import { ReceiveInvoiceForm } from '../invoices/ReceiveInvoiceForm';
import { CAPABILITY_LABEL } from '../nodes/labels';
import { CapabilityAction } from '../nodes/CapabilityAction';
import { ReceiveAddressForm } from '../onchain/ReceiveAddressForm';
import { SendOnchainForm } from '../onchain/SendOnchainForm';
import { isInFlight, OPERATION_KIND } from '../operations/labels';
import { OperationView } from '../operations/OperationView';
import { OperationSheetContext } from '../operations/sheet-context';
import { PayInvoiceForm } from '../payments/PayInvoiceForm';
import { useControlSize } from './use-shell-layout';
import { useMoneySheet } from './use-money-sheet';

const TITLES = { send: 'Send', receive: 'Receive' } as const;
type MoneyAction = NonNullable<MoneySearch['action']>;
const FORMS: Record<MoneyAction, (node: NodeSummary, policy: NodePolicy) => ReactNode> = {
  pay_invoice: (node, policy) => <PayInvoiceForm node={node} policy={policy} />,
  send_onchain: (node, policy) => <SendOnchainForm nodeId={node.id} policy={policy} />,
  create_invoice: (node, policy) => <ReceiveInvoiceForm nodeId={node.id} policy={policy} />,
  new_address: (node) => <ReceiveAddressForm nodeId={node.id} />,
};

export function GlobalMoneySheet({ node }: { node: NodeSummary }) {
  const sheet = useMoneySheet();
  const size = useControlSize();
  const mode = sheet.search.send ? 'send' : 'receive';
  const { action, operation: operationId } = sheet.search;
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
  let title = action ? CAPABILITY_LABEL[action] : TITLES[mode];
  if (operationId) title = current ? OPERATION_KIND[current.request.kind] : 'Operation';

  let content: ReactNode;
  if (operationId) {
    if (operation.isPending) content = <LoadingState label="Loading operation" />;
    else if (operation.isError) content = <ErrorNotice error={operation.error} onRetry={() => void operation.refetch()} />;
    else content = <OperationView operation={operation.data} node={node} unanswered={unanswered} />;
  } else if (action) {
    content = (
      <Flex direction="column" gap="md">
        <Button size={size} variant="ghost" onClick={() => sheet.update(mode === 'send' ? { send: 1 } : { receive: 1 })}>Back to {TITLES[mode]}</Button>
        <FlowFrame title={title} capability={action} back={null}>
          {({ policy }) => FORMS[action](node, policy)}
        </FlowFrame>
      </Flex>
    );
  } else {
    content = (
      <Flex direction="column" gap="md" align="start">
        {MONEY_ACTIONS[mode].map((kind) => (
          <CapabilityAction key={kind} node={node} capability={kind} showUnavailable>
            <Button size={size} variant="outline" onClick={() => sheet.update({ ...(mode === 'send' ? { send: 1 } : { receive: 1 }), action: kind })}>{CAPABILITY_LABEL[kind]}</Button>
          </CapabilityAction>
        ))}
      </Flex>
    );
  }

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
