import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Button, Flex, styled } from '@jfrader/ui';
import { Morph } from '@jfrader/ui/morph';
import type { NodePolicy, NodeSummary } from '../../api/types';
import { MONEY_ACTIONS, type MoneySearch } from '../../app/search';
import { FlowFrame } from '../forms/FlowFrame';
import { ReceiveInvoiceForm } from '../invoices/ReceiveInvoiceForm';
import { CAPABILITY_LABEL, capabilityBlock, capabilityReasonText } from '../nodes/labels';
import { ReceiveAddressForm } from '../onchain/ReceiveAddressForm';
import { SendOnchainForm } from '../onchain/SendOnchainForm';
import { OperationSheetContext } from '../operations/sheet-context';
import { PayInvoiceForm } from '../payments/PayInvoiceForm';
import { useControlSize } from './use-shell-layout';
import { useMoneySheet } from './use-money-sheet';

type MoneyAction = NonNullable<MoneySearch['action']>;
const ACTIONS = [...MONEY_ACTIONS.send, ...MONEY_ACTIONS.receive];
const LABELS = { ...CAPABILITY_LABEL, new_address: 'Receive address' };
const FORMS: Record<MoneyAction, (node: NodeSummary, policy: NodePolicy) => ReactNode> = {
  pay_invoice: (node, policy) => <PayInvoiceForm node={node} policy={policy} />,
  send_onchain: (node, policy) => <SendOnchainForm nodeId={node.id} policy={policy} />,
  create_invoice: (node, policy) => <ReceiveInvoiceForm nodeId={node.id} policy={policy} />,
  new_address: (node) => <ReceiveAddressForm nodeId={node.id} />,
};
const GroupTitle = styled.div(({ theme }) => ({ color: theme.color.textMuted, fontSize: theme.textSize.sm, fontWeight: theme.fontWeight.medium }));
const Reason = styled.span(({ theme }) => ({ color: theme.color.textMuted, fontSize: theme.textSize.sm }));
const ActionTitle = styled.h2(({ theme }) => ({ margin: 0, fontSize: theme.textSize.lg, fontWeight: theme.fontWeight.semibold }));

function MoneyMenu({ node }: { node: NodeSummary }) {
  const sheet = useMoneySheet();
  const size = useControlSize();
  const id = useId();
  const first = ACTIONS.find((action) => capabilityBlock(node, action) === null);
  const [active, setActive] = useState(first);
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'));
    const index = items.findIndex((item) => item === document.activeElement);
    const targets: Record<string, number> = { ArrowDown: (index + 1) % items.length, ArrowUp: (index - 1 + items.length) % items.length, Home: 0, End: items.length - 1 };
    if (!(event.key in targets) || !items.length) return;
    event.preventDefault();
    items[targets[event.key]]?.focus();
  }
  return <Flex direction="column" gap="xs" role="menu" aria-label="Send and receive" onKeyDown={onKeyDown}>
    {(['send', 'receive'] as const).map((mode) => <Flex key={mode} direction="column" sx={{ gap: 0 }} role="group" aria-labelledby={`${id}-${mode}`}>
      <GroupTitle id={`${id}-${mode}`}>{mode === 'send' ? 'Send' : 'Receive'}</GroupTitle>
      {MONEY_ACTIONS[mode].map((action) => {
        const reason = capabilityBlock(node, action);
        return <Flex key={action} direction="column" gap="xs">
          <Button size={size} variant="ghost" role="menuitem" disabled={reason !== null} aria-describedby={reason ? `${id}-${action}` : undefined}
            tabIndex={active === action && !reason ? 0 : -1} data-autofocus={first === action ? '' : undefined}
            onFocus={() => setActive(action)} onClick={() => sheet.update({ [mode]: 1, action })} sx={{ justifyContent: 'start', inlineSize: '100%' }}>
            {LABELS[action]}
          </Button>
          {reason && <Reason id={`${id}-${action}`}>{capabilityReasonText(reason, node)}</Reason>}
        </Flex>;
      })}
    </Flex>)}
  </Flex>;
}

function ActionForm({ action, node, policy }: { action: MoneyAction; node: NodeSummary; policy: NodePolicy }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const field = ref.current?.querySelector<HTMLElement>('input:not([type="hidden"]), textarea, select, button');
    field?.setAttribute('data-autofocus', '');
    field?.focus();
  }, []);
  return <div ref={ref}>{FORMS[action](node, policy)}</div>;
}

export function MoneySurface({ node }: { node: NodeSummary }) {
  const sheet = useMoneySheet();
  const size = useControlSize();
  return <OperationSheetContext value={{ onCreated: (created) => sheet.update({ operation: created.id }), onUnanswered: () => sheet.update({ operation: sheet.search.operation, confirmation: 'unanswered' }), discard: sheet.close }}>
    <Morph.Surface label="Send and receive" width={{ menu: '360px', ...Object.fromEntries(ACTIONS.map((action) => [`action:${action}`, '480px'])) }}>
      <Morph.Step id="menu" detent={0.38}>
        <MoneyMenu node={node} />
      </Morph.Step>
      {ACTIONS.map((action) => <Morph.Step key={action} id={`action:${action}`} width="480px" detent={0.68} back>
        <Flex direction="column" gap="md">
          <Flex align="center" justify="between" gap="sm">
            <ActionTitle>{LABELS[action]}</ActionTitle>
            <Button size={size} variant="ghost" onClick={() => sheet.update({ send: sheet.search.send, receive: sheet.search.receive })}>Back</Button>
          </Flex>
          <FlowFrame title={LABELS[action]} capability={action} back={null}>
            {({ policy }) => <ActionForm action={action} node={node} policy={policy} />}
          </FlowFrame>
        </Flex>
      </Morph.Step>)}
    </Morph.Surface>
  </OperationSheetContext>;
}
