import { FlowFrame } from '../forms/FlowFrame';
import { useCurrentNode } from '../nodes/use-current-node';
import { ListLink } from '../operations/review/kind-links';
import { ReceiveAddressForm } from './ReceiveAddressForm';

export function ReceiveAddressPage() {
  const node = useCurrentNode();
  return (
    <FlowFrame title="New address" capability="new_address" back={<ListLink nodeId={node.id} list="onchain" />}>
      {() => <ReceiveAddressForm nodeId={node.id} />}
    </FlowFrame>
  );
}
