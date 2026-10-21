import { useState, type FormEvent } from 'react';
import { Alert, Button, Flex } from '@jfrader/ui';
import type { NodePolicy } from '../../api/types';
import { CopyValue } from '../../components/CopyValue';
import { FeeRateField } from '../forms/FeeRateField';
import { checkFeeRate } from '../forms/validation';
import { SubmitFeedback } from '../operations/SubmitFeedback';
import { useSubmitOperation } from '../operations/use-submit-operation';

interface CloseChannelFormProps {
  nodeId: string;
  channelId: string;
  policy: NodePolicy;
}

/** Cooperative close only. The peer negotiates the final fee. */
export function CloseChannelForm({ nodeId, channelId, policy }: CloseChannelFormProps) {
  const [form, setForm] = useState({ feeRate: '', submitted: false });
  const submit = useSubmitOperation(nodeId);
  const feeRate = checkFeeRate(form.feeRate, policy.fee_rate_sat_vbyte);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setForm((current) => ({ ...current, submitted: true }));
    if (!feeRate.ok || submit.isPending) return;
    submit.mutate({
      kind: 'close_channel',
      params: { channel_id: channelId, fee_rate_sat_vbyte: feeRate.value.toString() },
    });
  };

  return (
    <form noValidate onSubmit={onSubmit}>
      <Flex direction="column" gap="md">
        <CopyValue value={channelId} label="Channel ID" />
        <Alert tone="info" title="Cooperative close">
          No force close. The final fee is negotiated with the peer.
        </Alert>
        <FeeRateField
          nodeId={nodeId}
          value={form.feeRate}
          onChange={(value) => setForm((current) => ({ ...current, feeRate: value }))}
          bounds={policy.fee_rate_sat_vbyte}
          error={form.submitted && !feeRate.ok ? feeRate.error : undefined}
        />
        <Flex>
          <Button type="submit" tone="danger" loading={submit.isPending}>
            Review close
          </Button>
        </Flex>
        <SubmitFeedback error={submit.error} result={submit.data} />
      </Flex>
    </form>
  );
}
