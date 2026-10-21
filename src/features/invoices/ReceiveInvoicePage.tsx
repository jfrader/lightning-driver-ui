import { FlowFrame } from '../forms/FlowFrame';
import { ReceiveInvoiceForm } from './ReceiveInvoiceForm';

export function ReceiveInvoicePage() {
  return (
    <FlowFrame title="Receive" capability="create_invoice">
      {({ node, policy }) => <ReceiveInvoiceForm nodeId={node.id} policy={policy} />}
    </FlowFrame>
  );
}
