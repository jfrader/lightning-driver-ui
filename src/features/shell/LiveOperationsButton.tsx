import { useState, type ComponentPropsWithRef, type ReactNode } from 'react';
import { Button, Flex, Pill, Popover, styled } from '@jfrader/ui';
import type { NodeSummary } from '../../api/types';
import { ErrorNotice } from '../../components/ErrorNotice';
import { ButtonLink } from '../../components/ButtonLink';
import { wrappingControlText } from '../../components/control-styles';
import { LoadingState } from '../../components/LoadingState';
import { formatInteger } from '../../lib/money';
import { isInFlight, OPERATION_KIND, OPERATION_STAGE, OPERATION_STATE } from '../operations/labels';
import { OperationAmount } from '../operations/OperationAmount';
import { useOperationList } from '../operations/use-operation-list';
import { useControlSize } from './use-shell-layout';

const List = styled.ul(({ theme }) => ({ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: theme.space[4] }));

function LiveTrigger(props: ComponentPropsWithRef<'button'>) {
  const size = useControlSize();
  return <Button {...props} size={size} variant="ghost" sx={wrappingControlText(size)} />;
}

export function LiveOperationsButton({ node }: { node: NodeSummary }) {
  const [open, setOpen] = useState(false);
  const size = useControlSize();
  const operations = useOperationList(node.id, { state: 'nonterminal' });
  const active = [...new Map(operations.data?.items.filter((operation) => operation.state === 'awaiting_confirmation' || isInFlight(operation.state)).map((operation) => [operation.id, operation])).values()];
  const more = !!(operations.data?.next_cursor || operations.data?.truncated);
  const count = operations.data ? `${formatInteger(BigInt(active.length))}${more ? '+' : ''}` : '…';

  let content: ReactNode;
  if (operations.isPending) content = <LoadingState label="Loading operations" />;
  else if (operations.isError) content = <ErrorNotice error={operations.error} onRetry={() => void operations.refetch()} />;
  else if (active.length === 0) content = <span>No operations in progress.</span>;
  else content = (
    <List>
      {active.map((operation) => (
        <li key={operation.id}>
          <Flex direction="column" gap="sm" align="start">
            <ButtonLink size={size} variant="ghost" to="/nodes/$nodeId/operations/$operationId" params={{ nodeId: node.id, operationId: operation.id }} onClick={() => setOpen(false)}>{OPERATION_KIND[operation.request.kind]}</ButtonLink>
            <OperationAmount operation={operation} />
            <span>{OPERATION_STATE[operation.state].label}</span>
            {operation.stage === 'reconciling' && <span>{OPERATION_STAGE.reconciling}</span>}
          </Flex>
        </li>
      ))}
    </List>
  );

  if (operations.isPending || active.length === 0) return null;
  return (
    <Popover open={open} onOpenChange={setOpen} placement="bottom-end" triggerLabel={<Pill tone="warning">{count}</Pill>} label="Operations" slots={{ trigger: LiveTrigger }} slotProps={{ trigger: { 'aria-label': `Operations: ${count}` }, root: { sx: { flexShrink: 0 } } }} content={
      <Flex direction="column" gap="md">
        {content}
        {more && <ButtonLink size={size} variant="ghost" to="/nodes/$nodeId/operations" params={{ nodeId: node.id }} search={{ state: 'nonterminal' }} onClick={() => setOpen(false)}>All unresolved operations</ButtonLink>}
      </Flex>
    } />
  );
}
