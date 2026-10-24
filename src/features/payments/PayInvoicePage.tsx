import { FlowFrame } from '../forms/FlowFrame';
import { useCurrentNode } from '../nodes/use-current-node';
import { PayInvoiceForm } from './PayInvoiceForm';

export function PayInvoicePage() {
  const node = useCurrentNode();
  return <FlowFrame title="Pay invoice" capability="pay_invoice" back={null}>
    {({ policy }) => <PayInvoiceForm node={node} policy={policy} />}
  </FlowFrame>;
}
