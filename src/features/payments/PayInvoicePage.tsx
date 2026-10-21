import { FlowFrame } from '../forms/FlowFrame';
import { PayInvoiceForm } from './PayInvoiceForm';

export function PayInvoicePage() {
  return (
    <FlowFrame title="Pay invoice" capability="pay_invoice">
      {({ node, policy }) => <PayInvoiceForm nodeId={node.id} policy={policy} />}
    </FlowFrame>
  );
}
