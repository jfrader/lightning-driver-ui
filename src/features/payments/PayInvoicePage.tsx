import { getRouteApi, useSearch } from '@tanstack/react-router';
import { OperationSheet } from '../../components/OperationSheet';
import { FlowFrame } from '../forms/FlowFrame';
import { useCurrentNode } from '../nodes/use-current-node';
import { OperationSheetContext } from '../operations/sheet-context';
import { PayInvoiceForm } from './PayInvoiceForm';

const route = getRouteApi('/_authed/nodes/$nodeId/_configured/payments/new');

/** The pay form over its list. Creating a review replaces this entry with the review's URL. */
export function PayInvoicePage() {
  const search = useSearch({ strict: false });
  const node = useCurrentNode();
  const navigate = route.useNavigate();
  const list = () => void navigate({ to: '/nodes/$nodeId/payments', params: { nodeId: node.id }, search: (previous) => previous });
  const review = (operationId: string) => void navigate({
    to: '/nodes/$nodeId/payments/review/$operationId',
    params: { nodeId: node.id, operationId },
    search: (previous) => previous,
    replace: true,
  });
  if (search.send || search.receive || search.operation) return null;
  return (
    <OperationSheetContext value={{ onCreated: (created) => review(created.id), onUnanswered: list, discard: list }}>
      <OperationSheet title="Pay invoice" hasReview={false} busy={false} onClose={list} onDiscard={list}>
        <FlowFrame title="Pay invoice" capability="pay_invoice" back={null}>
          {({ policy }) => <PayInvoiceForm node={node} policy={policy} />}
        </FlowFrame>
      </OperationSheet>
    </OperationSheetContext>
  );
}
