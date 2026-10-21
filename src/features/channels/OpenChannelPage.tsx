import { getRouteApi } from '@tanstack/react-router';
import { FlowFrame } from '../forms/FlowFrame';
import { useCurrentNode } from '../nodes/use-current-node';
import { ListLink } from '../operations/review/kind-links';
import { OpenChannelForm } from './OpenChannelForm';

const route = getRouteApi('/_authed/nodes/$nodeId/_configured/channels/new');

export function OpenChannelPage() {
  const node = useCurrentNode();
  const { peer } = route.useSearch();
  return (
    <FlowFrame title="Open channel" capability="open_channel" back={<ListLink nodeId={node.id} list="channels" />}>
      {({ policy }) => <OpenChannelForm nodeId={node.id} policy={policy} initialPeer={peer} />}
    </FlowFrame>
  );
}
