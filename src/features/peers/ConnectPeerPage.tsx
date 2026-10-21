import { FlowFrame } from '../forms/FlowFrame';
import { ConnectPeerForm } from './ConnectPeerForm';

export function ConnectPeerPage() {
  return (
    <FlowFrame title="Connect peer" capability="connect_peer">
      {({ node }) => <ConnectPeerForm nodeId={node.id} />}
    </FlowFrame>
  );
}
