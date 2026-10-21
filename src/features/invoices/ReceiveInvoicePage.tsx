import { FlowFrame } from '../forms/FlowFrame';
import { useCurrentNode } from '../nodes/use-current-node';
import { ListLink } from '../operations/review/kind-links';
import { ReceiveInvoiceForm } from './ReceiveInvoiceForm';

export function ReceiveInvoicePage() {
  const node = useCurrentNode();
  return (
    <FlowFrame title="Create invoice" capability="create_invoice" back={<ListLink nodeId={node.id} list="invoices" />}>
      {({ policy }) => <ReceiveInvoiceForm nodeId={node.id} policy={policy} />}
    </FlowFrame>
  );
}
