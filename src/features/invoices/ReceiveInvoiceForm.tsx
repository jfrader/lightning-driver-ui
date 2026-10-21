import { useState, type FormEvent } from 'react';
import { Button, Flex, TextField, Textarea } from '@jfrader/ui';
import type { NodePolicy } from '../../api/types';
import { msatToWireMsat } from '../../lib/money';
import { useDisplayUnit } from '../display/unit-context';
import { AmountField, type AmountEntry } from '../forms/AmountField';
import { checkAmount, type Checked } from '../forms/validation';
import { SubmitFeedback } from '../operations/SubmitFeedback';
import { useSubmitOperation } from '../operations/use-submit-operation';

const DESCRIPTION_MAX_LENGTH = 640;

interface ReceiveInvoiceFormProps {
  nodeId: string;
  policy: NodePolicy;
}

interface FormState {
  amount: AmountEntry;
  description: string;
  expiry: string;
  submitted: boolean;
}

function checkExpiry(text: string, bounds: NodePolicy['invoice_expiry_seconds']): Checked<number> {
  const value = Number(text);
  if (!/^[0-9]+$/.test(text.trim()) || value < bounds.min || value > bounds.max) {
    return { ok: false, error: `Enter between ${bounds.min} and ${bounds.max} seconds.` };
  }
  return { ok: true, value };
}

export function ReceiveInvoiceForm({ nodeId, policy }: ReceiveInvoiceFormProps) {
  const { unit } = useDisplayUnit();
  const [form, setForm] = useState<FormState>({
    amount: { text: '', unit },
    description: '',
    expiry: String(policy.invoice_expiry_seconds.default),
    submitted: false,
  });
  const submit = useSubmitOperation(nodeId);

  const amount = checkAmount(form.amount, { allowMsat: true, bounds: policy.create_invoice_msat, boundsUnit: 'msat' });
  const expiry = checkExpiry(form.expiry, policy.invoice_expiry_seconds);
  const show = (check: Checked<unknown>) => (form.submitted && !check.ok ? check.error : undefined);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setForm((current) => ({ ...current, submitted: true }));
    if (!amount.ok || !expiry.ok || submit.isPending) return;
    submit.mutate({
      kind: 'create_invoice',
      params: { amount_msat: msatToWireMsat(amount.value), description: form.description, expiry_seconds: expiry.value },
    });
  };

  return (
    <form noValidate onSubmit={onSubmit}>
      <Flex direction="column" gap="md">
        <AmountField
          label="Amount"
          value={form.amount}
          onChange={(value) => setForm((current) => ({ ...current, amount: value }))}
          error={show(amount)}
          required
        />
        <Textarea
          label="Description"
          value={form.description}
          maxLength={DESCRIPTION_MAX_LENGTH}
          onValueChange={(description) => setForm((current) => ({ ...current, description }))}
        />
        <TextField
          label="Expires after (seconds)"
          inputMode="numeric"
          value={form.expiry}
          onValueChange={(value) => setForm((current) => ({ ...current, expiry: value }))}
          error={show(expiry)}
          required
        />
        <Flex>
          <Button type="submit" tone="accent" loading={submit.isPending}>
            Create invoice
          </Button>
        </Flex>
        <SubmitFeedback error={submit.error} result={submit.data} />
      </Flex>
    </form>
  );
}
