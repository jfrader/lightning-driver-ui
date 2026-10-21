import { Button, Flex } from '@jfrader/ui';
import { SubmitFeedback } from '../operations/SubmitFeedback';
import { useSubmitOperation } from '../operations/use-submit-operation';

/** Derives one native SegWit receive address on the node. */
export function ReceiveAddressForm({ nodeId }: { nodeId: string }) {
  const submit = useSubmitOperation(nodeId);
  return (
    <Flex direction="column" gap="md" align="start">
      <Button
        tone="accent"
        loading={submit.isPending}
        onClick={() => {
          if (!submit.isPending) submit.mutate({ kind: 'new_address', params: { address_type: 'p2wpkh' } });
        }}
      >
        Create address
      </Button>
      <SubmitFeedback error={submit.error} result={submit.data} />
    </Flex>
  );
}
