import { FlowFrame } from '../forms/FlowFrame';
import { useCurrentNode } from '../nodes/use-current-node';
import { ListLink } from '../operations/review/kind-links';
import { SendOnchainForm } from './SendOnchainForm';

export function SendOnchainPage() {
  const node = useCurrentNode();
  return (
    <FlowFrame title="Send on-chain" capability="send_onchain" back={<ListLink nodeId={node.id} list="onchain" />}>
      {({ policy }) => <SendOnchainForm nodeId={node.id} policy={policy} />}
    </FlowFrame>
  );
}
