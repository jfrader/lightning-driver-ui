import type { ReactNode } from 'react';
import { Alert } from '@jfrader/ui';
import type { Channel } from '../../api/types';
import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { channelsQueryOptions } from '../../api/node-queries';
import { ErrorNotice } from '../../components/ErrorNotice';
import { LoadingState } from '../../components/LoadingState';
import { FlowFrame } from '../forms/FlowFrame';
import { useCurrentNode } from '../nodes/use-current-node';
import { ListLink } from '../operations/review/kind-links';
import { CloseChannelForm } from './CloseChannelForm';
import { isClosable } from './labels';

const route = getRouteApi('/_authed/nodes/$nodeId/_configured/channels/$channelId/close');

interface ChannelLookupProps {
  nodeId: string;
  channelId: string;
  children: (channel: Channel) => ReactNode;
}

/** The channel is read from the node's channel list; there is no single-channel read (G-2). */
function ChannelLookup({ nodeId, channelId, children }: ChannelLookupProps) {
  const channels = useQuery(channelsQueryOptions(nodeId, {}));
  if (channels.isPending) return <LoadingState label="Loading the channel" />;
  if (channels.isError) return <ErrorNotice error={channels.error} onRetry={() => void channels.refetch()} />;
  const channel = channels.data.items.find((item) => item.id === channelId);
  if (!channel) return <Alert tone="info" title="This channel is not on this node's channel list." />;
  if (!isClosable(channel)) return <Alert tone="info" title="Only an active or inactive channel can be closed." />;
  return children(channel);
}

export function CloseChannelPage() {
  const node = useCurrentNode();
  const { channelId } = route.useParams();
  return (
    <FlowFrame title="Close channel" capability="close_channel" back={<ListLink nodeId={node.id} list="channels" />}>
      {({ policy }) => (
        <ChannelLookup nodeId={node.id} channelId={channelId}>
          {(channel) => <CloseChannelForm nodeId={node.id} channel={channel} policy={policy} />}
        </ChannelLookup>
      )}
    </FlowFrame>
  );
}
