import { Button, Flex } from '@jfrader/ui';
import { SubmitFeedback } from '../operations/SubmitFeedback';
import { useSubmitOperation } from '../operations/use-submit-operation';
import { useControlSize } from '../shell/use-shell-layout';

interface DisconnectPeerButtonProps {
  nodeId: string;
  pubkey: string;
}

/**
 * Creates the disconnect review for this peer and opens it; the disconnect itself is confirmed
 * there with one explicit action. Nothing is sent to the node from here.
 */
export function DisconnectPeerButton({ nodeId, pubkey }: DisconnectPeerButtonProps) {
  const size = useControlSize();
  const submit = useSubmitOperation(nodeId);
  return (
    <Flex direction="column" gap="sm" align="start">
      <Button
        size={size}
        variant="outline"
        tone="danger"
        loading={submit.isPending}
        onClick={() => {
          if (!submit.isPending) submit.mutate({ kind: 'disconnect_peer', params: { pubkey } });
        }}
      >
        Disconnect peer…
      </Button>
      <SubmitFeedback error={submit.error} nodeId={nodeId} />
    </Flex>
  );
}
