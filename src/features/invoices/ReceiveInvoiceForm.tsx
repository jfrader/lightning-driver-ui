import { useState, type FormEvent } from 'react';
import { Flex, Textarea } from '@jfrader/ui';
import type { NodePolicy } from '../../api/types';
import { ExactNumberField } from '../../components/ExactNumberField';
import { formatDurationSeconds } from '../../lib/duration';
import { msatToWireMsat } from '../../lib/money';
import { useDisplayUnit } from '../display/unit-context';
import { AmountField, type AmountEntry } from '../forms/AmountField';
import { createFieldError } from '../forms/create-errors';
import { ReviewSubmit } from '../forms/ReviewSubmit';
import { DESCRIPTION_MAX_LENGTH, checkAmount, checkDescription, checkExpiry, rangeText, type Checked } from '../forms/validation';
import { useSubmitOperation } from '../operations/use-submit-operation';

const FIELDS = ['amount'] as const;

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

/** Amount, description and expiry for a new invoice; submitting creates its review (§7.1). */
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
  const description = checkDescription(form.description);
  const expiry = checkExpiry(form.expiry, policy.invoice_expiry_seconds);
  const show = (check: Checked<unknown>) => (form.submitted && !check.ok ? check.error : undefined);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setForm((current) => ({ ...current, submitted: true }));
    if (!amount.ok || !description.ok || !expiry.ok || submit.isPending) return;
    submit.mutate({
      kind: 'create_invoice',
      params: { amount_msat: msatToWireMsat(amount.value), description: description.value, expiry_seconds: expiry.value },
    });
  };

  return (
    <form noValidate onSubmit={onSubmit}>
      <Flex direction="column" gap="md">
        <AmountField
          label="Amount"
          value={form.amount}
          onChange={(value) => setForm((current) => ({ ...current, amount: value }))}
          description={`Allowed: ${rangeText(policy.create_invoice_msat, 'msat', form.amount.unit)}`}
          error={show(amount) ?? createFieldError(submit.error, 'amount', FIELDS)}
          required
        />
        <Textarea
          label="Description"
          description={`${[...form.description].length} / ${DESCRIPTION_MAX_LENGTH}`}
          value={form.description}
          onValueChange={(value) => setForm((current) => ({ ...current, description: value }))}
          error={show(description)}
        />
        <ExactNumberField
          kind="whole"
          label="Expiry (seconds)"
          description={expiry.ok ? formatDurationSeconds(expiry.value) : `Allowed: ${policy.invoice_expiry_seconds.min}–${policy.invoice_expiry_seconds.max} seconds`}
          value={form.expiry}
          onValueChange={(value) => setForm((current) => ({ ...current, expiry: value }))}
          error={show(expiry)}
          required
        />
        <ReviewSubmit label="Create invoice" pending={submit.isPending} error={submit.error} nodeId={nodeId} fields={FIELDS} />
      </Flex>
    </form>
  );
}
