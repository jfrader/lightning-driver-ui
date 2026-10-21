import { FlowFrame } from '../forms/FlowFrame';
import { SendOnchainForm } from './SendOnchainForm';

export function SendOnchainPage() {
  return (
    <FlowFrame title="Send on-chain" capability="send_onchain">
      {({ node, policy }) => <SendOnchainForm nodeId={node.id} policy={policy} />}
    </FlowFrame>
  );
}
