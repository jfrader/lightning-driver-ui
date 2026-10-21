import { useState, type FormEvent } from 'react';
import { Flex, TextField } from '@jfrader/ui';
import type { NodePolicy } from '../../api/types';
import { msatToWireSat } from '../../lib/money';
import { useDisplayUnit } from '../display/unit-context';
import { AmountField, type AmountEntry } from '../forms/AmountField';
import { createFieldError } from '../forms/create-errors';
import { FeeRateField } from '../forms/FeeRateField';
import { ReviewSubmit } from '../forms/ReviewSubmit';
import { checkAddress, checkAmount, checkFeeRate, rangeText, type Checked } from '../forms/validation';
import { useSubmitOperation } from '../operations/use-submit-operation';

const FIELDS = ['address', 'amount'] as const;

interface SendOnchainFormProps {
  nodeId: string;
  policy: NodePolicy;
}

interface FormState {
  address: string;
  amount: AmountEntry;
  feeRate: string;
  submitted: boolean;
}

/** A fixed amount to one address; no send-all, no coin selection. The server validates the address (§7.8). */
export function SendOnchainForm({ nodeId, policy }: SendOnchainFormProps) {
  const { unit } = useDisplayUnit();
  const [form, setForm] = useState<FormState>({ address: '', amount: { text: '', unit }, feeRate: '', submitted: false });
  const submit = useSubmitOperation(nodeId);

  const address = checkAddress(form.address);
  const amount = checkAmount(form.amount, { allowMsat: false, bounds: policy.send_onchain_sat, boundsUnit: 'sat' });
  const feeRate = checkFeeRate(form.feeRate, policy.fee_rate_sat_vbyte);
  const show = (check: Checked<unknown>) => (form.submitted && !check.ok ? check.error : undefined);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setForm((current) => ({ ...current, submitted: true }));
    if (!address.ok || !amount.ok || !feeRate.ok || submit.isPending) return;
    submit.mutate({
      kind: 'send_onchain',
      params: { address: address.value, amount_sat: msatToWireSat(amount.value), fee_rate_sat_vbyte: feeRate.value.toString() },
    });
  };

  return (
    <form noValidate onSubmit={onSubmit}>
      <Flex direction="column" gap="md">
        <TextField
          label="Address"
          value={form.address}
          onValueChange={(value) => setForm((current) => ({ ...current, address: value }))}
          autoComplete="off"
          spellCheck={false}
          error={show(address) ?? createFieldError(submit.error, 'address', FIELDS)}
          required
        />
        <AmountField
          label="Amount"
          value={form.amount}
          onChange={(value) => setForm((current) => ({ ...current, amount: value }))}
          description={`Allowed: ${rangeText(policy.send_onchain_sat, 'sat', form.amount.unit)}`}
          error={show(amount) ?? createFieldError(submit.error, 'amount', FIELDS)}
          required
        />
        <FeeRateField
          nodeId={nodeId}
          value={form.feeRate}
          onChange={(value) => setForm((current) => ({ ...current, feeRate: value }))}
          bounds={policy.fee_rate_sat_vbyte}
          error={show(feeRate)}
        />
        <ReviewSubmit label="Review send" pending={submit.isPending} error={submit.error} nodeId={nodeId} fields={FIELDS} />
      </Flex>
    </form>
  );
}
