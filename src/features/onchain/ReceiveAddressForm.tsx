import type { FormEvent } from 'react';
import { Flex } from '@jfrader/ui';
import { DetailList } from '../../components/DetailList';
import { ReviewSubmit } from '../forms/ReviewSubmit';
import { useSubmitOperation } from '../operations/use-submit-operation';

/** One native SegWit receive address; no editable field (§7.7). Its review shows only the node. */
export function ReceiveAddressForm({ nodeId }: { nodeId: string }) {
  const submit = useSubmitOperation(nodeId);
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!submit.isPending) submit.mutate({ kind: 'new_address', params: { address_type: 'p2wpkh' } });
  };
  return (
    <form noValidate onSubmit={onSubmit}>
      <Flex direction="column" gap="md">
        <DetailList items={[{ label: 'Address type', value: 'Native SegWit (P2WPKH)' }]} />
        <ReviewSubmit label="Create address" pending={submit.isPending} error={submit.error} nodeId={nodeId} />
      </Flex>
    </form>
  );
}
