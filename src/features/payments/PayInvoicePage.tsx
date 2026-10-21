import { FlowFrame } from '../forms/FlowFrame';
import { useCurrentNode } from '../nodes/use-current-node';
import { ListLink } from '../operations/review/kind-links';
import { PayInvoiceForm } from './PayInvoiceForm';

export function PayInvoicePage() {
  const node = useCurrentNode();
  return (
    <FlowFrame title="Pay invoice" capability="pay_invoice" back={<ListLink nodeId={node.id} list="payments" />}>
      {({ policy }) => <PayInvoiceForm node={node} policy={policy} />}
    </FlowFrame>
  );
}
