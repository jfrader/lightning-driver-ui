import { useState, type FormEvent } from 'react';
import { Button, Flex, TextField } from '@jfrader/ui';
import type { NodePolicy } from '../../api/types';
import { msatToWireSat } from '../../lib/money';
import { useDisplayUnit } from '../display/unit-context';
import { AmountField, type AmountEntry } from '../forms/AmountField';
import { FeeRateField } from '../forms/FeeRateField';
import { checkAmount, checkFeeRate, type Checked } from '../forms/validation';
import { SubmitFeedback } from '../operations/SubmitFeedback';
import { useSubmitOperation } from '../operations/use-submit-operation';

const ADDRESS_MAX_LENGTH = 200;

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

/** Fixed amount to one address. The server validates the address for the node's network. */
export function SendOnchainForm({ nodeId, policy }: SendOnchainFormProps) {
  const { unit } = useDisplayUnit();
  const [form, setForm] = useState<FormState>({ address: '', amount: { text: '', unit }, feeRate: '', submitted: false });
  const submit = useSubmitOperation(nodeId);

  const address = form.address.trim();
  const addressCheck: Checked<string> =
    address && address.length <= ADDRESS_MAX_LENGTH && !/\s/.test(address)
      ? { ok: true, value: address }
      : { ok: false, error: 'Enter a Bitcoin address.' };
  const amount = checkAmount(form.amount, { allowMsat: false, bounds: policy.send_onchain_sat, boundsUnit: 'sat' });
  const feeRate = checkFeeRate(form.feeRate, policy.fee_rate_sat_vbyte);
  const show = (check: Checked<unknown>) => (form.submitted && !check.ok ? check.error : undefined);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setForm((current) => ({ ...current, submitted: true }));
    if (!addressCheck.ok || !amount.ok || !feeRate.ok || submit.isPending) return;
    submit.mutate({
      kind: 'send_onchain',
      params: {
        address: addressCheck.value,
        amount_sat: msatToWireSat(amount.value),
        fee_rate_sat_vbyte: feeRate.value.toString(),
      },
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
          error={show(addressCheck)}
          required
        />
        <AmountField
          label="Amount"
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
        <Flex>
          <Button type="submit" tone="accent" loading={submit.isPending}>
            Review send
          </Button>
        </Flex>
        <SubmitFeedback error={submit.error} result={submit.data} />
      </Flex>
    </form>
  );
}
