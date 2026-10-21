import { useState, type FormEvent } from 'react';
import { Button, Checkbox, Flex, TextField } from '@jfrader/ui';
import type { NodePolicy } from '../../api/types';
import { msatToWireSat } from '../../lib/money';
import { useDisplayUnit } from '../display/unit-context';
import { AmountField, type AmountEntry } from '../forms/AmountField';
import { FeeRateField } from '../forms/FeeRateField';
import { checkAmount, checkFeeRate, type Checked } from '../forms/validation';
import { SubmitFeedback } from '../operations/SubmitFeedback';
import { useSubmitOperation } from '../operations/use-submit-operation';
import { isPubkey } from '../peers/peer-address';

interface OpenChannelFormProps {
  nodeId: string;
  policy: NodePolicy;
}

interface FormState {
  peer: string;
  amount: AmountEntry;
  feeRate: string;
  private: boolean;
  submitted: boolean;
}

export function OpenChannelForm({ nodeId, policy }: OpenChannelFormProps) {
  const { unit } = useDisplayUnit();
  const [form, setForm] = useState<FormState>({
    peer: '',
    amount: { text: '', unit },
    feeRate: '',
    private: false,
    submitted: false,
  });
  const submit = useSubmitOperation(nodeId);

  const peer = form.peer.trim().toLowerCase();
  const peerCheck: Checked<string> = isPubkey(peer)
    ? { ok: true, value: peer }
    : { ok: false, error: 'Enter the peer public key (66 hex characters).' };
  const amount = checkAmount(form.amount, { allowMsat: false, bounds: policy.open_channel_sat, boundsUnit: 'sat' });
  const feeRate = checkFeeRate(form.feeRate, policy.fee_rate_sat_vbyte);
  const show = (check: Checked<unknown>) => (form.submitted && !check.ok ? check.error : undefined);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setForm((current) => ({ ...current, submitted: true }));
    if (!peerCheck.ok || !amount.ok || !feeRate.ok || submit.isPending) return;
    submit.mutate({
      kind: 'open_channel',
      params: {
        peer_pubkey: peerCheck.value,
        amount_sat: msatToWireSat(amount.value),
        private: form.private,
        fee_rate_sat_vbyte: feeRate.value.toString(),
      },
    });
  };

  return (
    <form noValidate onSubmit={onSubmit}>
      <Flex direction="column" gap="md">
        <TextField
          label="Peer public key"
          description="The peer must already be connected."
          value={form.peer}
          onValueChange={(value) => setForm((current) => ({ ...current, peer: value }))}
          autoComplete="off"
          spellCheck={false}
          error={show(peerCheck)}
          required
        />
        <AmountField
          label="Channel size"
          value={form.amount}
          onChange={(value) => setForm((current) => ({ ...current, amount: value }))}
          error={show(amount)}
          required
        />
        <FeeRateField
          nodeId={nodeId}
          value={form.feeRate}
          onChange={(value) => setForm((current) => ({ ...current, feeRate: value }))}
          bounds={policy.fee_rate_sat_vbyte}
          error={show(feeRate)}
        />
        <Checkbox
          label="Private channel"
          checked={form.private}
          onCheckedChange={(checked) => setForm((current) => ({ ...current, private: checked === true }))}
        />
        <Flex>
          <Button type="submit" tone="accent" loading={submit.isPending}>
            Review channel
          </Button>
        </Flex>
        <SubmitFeedback error={submit.error} result={submit.data} />
      </Flex>
    </form>
  );
}
