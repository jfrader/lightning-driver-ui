import { useState } from 'react';
import { Button, Dialog, Flex } from '@jfrader/ui';
import { CopyValue } from '../../components/CopyValue';
import { SubmitFeedback } from '../operations/SubmitFeedback';
import { useSubmitOperation } from '../operations/use-submit-operation';
import { useControlSize } from '../shell/use-shell-layout';

interface DisconnectPeerButtonProps {
  nodeId: string;
  nodeLabel: string;
  pubkey: string;
}

/** Short confirmation, then the same review-and-confirm pipeline as every other action. */
export function DisconnectPeerButton({ nodeId, nodeLabel, pubkey }: DisconnectPeerButtonProps) {
  const [open, setOpen] = useState(false);
  const size = useControlSize();
  const submit = useSubmitOperation(nodeId);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        render={(props) => (
          <Button {...props} size={size} variant="outline" tone="danger">
            Disconnect peer…
          </Button>
        )}
      />
      <Dialog.Content>
        <Dialog.Title>Disconnect peer from {nodeLabel}?</Dialog.Title>
        <Flex direction="column" gap="md">
          <CopyValue value={pubkey} label="Peer" />
          <SubmitFeedback error={submit.error} result={submit.data} />
          <Flex wrap gap="sm" justify="end">
            <Dialog.Close render={(props) => <Button {...props} variant="ghost">Cancel</Button>} />
            <Button
              tone="danger"
              loading={submit.isPending}
              onClick={() => {
                if (!submit.isPending) submit.mutate({ kind: 'disconnect_peer', params: { pubkey } });
              }}
            >
              Disconnect
            </Button>
          </Flex>
        </Flex>
      </Dialog.Content>
    </Dialog>
  );
}
