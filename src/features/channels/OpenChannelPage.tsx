import { FlowFrame } from '../forms/FlowFrame';
import { OpenChannelForm } from './OpenChannelForm';

export function OpenChannelPage() {
  return (
    <FlowFrame title="Open channel" capability="open_channel">
      {({ node, policy }) => <OpenChannelForm nodeId={node.id} policy={policy} />}
    </FlowFrame>
  );
}
