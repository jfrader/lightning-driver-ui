import { FlowFrame } from '../forms/FlowFrame';
import { ReceiveAddressForm } from './ReceiveAddressForm';

export function ReceiveAddressPage() {
  return (
    <FlowFrame title="New address" capability="new_address">
      {({ node }) => <ReceiveAddressForm nodeId={node.id} />}
    </FlowFrame>
  );
}
