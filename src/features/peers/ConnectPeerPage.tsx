import { FlowFrame } from '../forms/FlowFrame';
import { useCurrentNode } from '../nodes/use-current-node';
import { ListLink } from '../operations/review/kind-links';
import { ConnectPeerForm } from './ConnectPeerForm';

export function ConnectPeerPage() {
  const node = useCurrentNode();
  return (
    <FlowFrame title="Connect peer" capability="connect_peer" back={<ListLink nodeId={node.id} list="peers" />}>
      {() => <ConnectPeerForm nodeId={node.id} />}
    </FlowFrame>
  );
}
