import { getRouteApi } from '@tanstack/react-router';
import { FlowFrame } from '../forms/FlowFrame';
import { CloseChannelForm } from './CloseChannelForm';

const route = getRouteApi('/_authed/nodes/$nodeId/channels/$channelId/close');

export function CloseChannelPage() {
  const { channelId } = route.useParams();
  return (
    <FlowFrame title="Close channel" capability="close_channel">
      {({ node, policy }) => <CloseChannelForm nodeId={node.id} channelId={channelId} policy={policy} />}
    </FlowFrame>
  );
}
