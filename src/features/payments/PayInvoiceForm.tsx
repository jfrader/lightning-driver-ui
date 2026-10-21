import { useState, type FormEvent } from 'react';
import { Alert, Button, Flex, Textarea } from '@jfrader/ui';
import { useMutation } from '@tanstack/react-query';
import { ApiError } from '../../api/errors';
import { decodeInvoice } from '../../api/node-api';
import type { DecodedInvoice, NodePolicy, NodeSummary } from '../../api/types';
import { ErrorNotice } from '../../components/ErrorNotice';
import { formatMsat, formatMsatInput, msatToWireMsat, wireToMsat } from '../../lib/money';
import { useDisplayUnit } from '../display/unit-context';
import { AmountField, type AmountEntry } from '../forms/AmountField';
import { createFieldError } from '../forms/create-errors';
import { ReviewSubmit } from '../forms/ReviewSubmit';
import { checkAmount, checkDescription, checkFeeCap, rangeText, type Checked } from '../forms/validation';
import { useSubmitOperation } from '../operations/use-submit-operation';
import { useControlSize } from '../shell/use-shell-layout';
import { DecodedInvoiceDetails } from './DecodedInvoiceDetails';
import { normalizeBolt11, payBlocker } from './pay-checks';

const FIELDS = ['invoice', 'amount'] as const;
const BOLT11_MAX_LENGTH = 16_384;

interface PayInvoiceFormProps {
  node: NodeSummary;
  policy: NodePolicy;
}

interface FormState {
  invoice: string;
  decoded: { bolt11: string; invoice: DecodedInvoice } | null;
  amount: AmountEntry;
  maxFee: AmountEntry;
  description: string;
  submitted: boolean;
}

function decodeFailure(error: unknown): string | null {
  return error instanceof ApiError && error.status === 422 ? 'This is not a valid BOLT11 invoice.' : null;
}

/**
 * Check the invoice locally, then set what it leaves open (amount for an amountless invoice, the fee
 * cap, a committed description) and create the payment review. Nothing is paid from this form (§7.2).
 */
export function PayInvoiceForm({ node, policy }: PayInvoiceFormProps) {
  const { unit } = useDisplayUnit();
  const size = useControlSize();
  const [form, setForm] = useState<FormState>(() => ({
    invoice: '',
    decoded: null,
    amount: { text: '', unit },
    maxFee: { text: formatMsatInput(wireToMsat(policy.default_max_routing_fee_msat, 'msat'), unit), unit },
    description: '',
    submitted: false,
  }));
  const decode = useMutation({
    mutationFn: (bolt11: string) => decodeInvoice(node.id, bolt11),
    onSuccess: (invoice, bolt11) => setForm((current) => ({ ...current, decoded: { bolt11, invoice }, submitted: false })),
  });
  const submit = useSubmitOperation(node.id);

  const bolt11 = normalizeBolt11(form.invoice);
  const invoice = form.decoded?.bolt11 === bolt11 ? form.decoded.invoice : null;
  const amountless = invoice?.amount_msat === null;
  const amount: Checked<bigint> | null = amountless
    ? form.amount.text === ''
      ? { ok: false, error: 'Enter an amount for this invoice.' }
      : checkAmount(form.amount, { allowMsat: true, bounds: policy.pay_invoice_msat, boundsUnit: 'msat' })
    : null;
  const maxFee = checkFeeCap(form.maxFee, policy);
  const description: Checked<string | null> = !invoice?.requires_description
    ? { ok: true, value: null }
    : form.description.trim() === ''
      ? { ok: false, error: 'Enter the description this invoice commits to.' }
      : checkDescription(form.description);
  const show = (check: Checked<unknown> | null) => (form.submitted && check && !check.ok ? check.error : undefined);
  const blocker = invoice ? payBlocker(invoice, node) : null;

  const onCheck = (event: FormEvent) => {
    event.preventDefault();
    if (bolt11 && bolt11.length <= BOLT11_MAX_LENGTH && !decode.isPending) decode.mutate(bolt11);
  };

  const onReview = (event: FormEvent) => {
    event.preventDefault();
    setForm((current) => ({ ...current, submitted: true }));
    if (!invoice || blocker || !maxFee.ok || !description.ok || (amount && !amount.ok) || submit.isPending) return;
    submit.mutate({
      kind: 'pay_invoice',
      params: {
        bolt11,
        amount_msat: amount?.ok ? msatToWireMsat(amount.value) : null,
        max_fee_msat: msatToWireMsat(maxFee.value),
        description: description.value,
      },
    });
  };

  const maxCap = formatMsat(wireToMsat(policy.max_routing_fee_msat, 'msat'), form.maxFee.unit);
  return (
    <Flex direction="column" gap="md">
      <form noValidate onSubmit={onCheck}>
        <Flex direction="column" gap="sm" align="start">
          <Textarea
            label="Invoice"
            value={form.invoice}
            onValueChange={(value) => setForm((current) => ({ ...current, invoice: value }))}
            autoComplete="off"
            spellCheck={false}
            rows={4}
            error={decodeFailure(decode.error) ?? createFieldError(submit.error, 'invoice', FIELDS)}
            required
            sx={{ inlineSize: '100%' }}
          />
          <Button type="submit" size={size} variant="outline" loading={decode.isPending} disabled={bolt11 === ''}>
            Check invoice
          </Button>
          {decode.isError && !decodeFailure(decode.error) && <ErrorNotice error={decode.error} />}
        </Flex>
      </form>
      {invoice && <DecodedInvoiceDetails invoice={invoice} />}
      {invoice && blocker && <Alert tone="warning" title={blocker} />}
      {invoice && !blocker && (
        <form noValidate onSubmit={onReview}>
          <Flex direction="column" gap="md">
            {amountless && (
              <AmountField
                label="Amount"
                value={form.amount}
                onChange={(value) => setForm((current) => ({ ...current, amount: value }))}
                description={`Allowed: ${rangeText(policy.pay_invoice_msat, 'msat', form.amount.unit)}`}
                error={show(amount) ?? createFieldError(submit.error, 'amount', FIELDS)}
                required
              />
            )}
            <AmountField
              label="Routing fee cap"
              value={form.maxFee}
              onChange={(value) => setForm((current) => ({ ...current, maxFee: value }))}
              description={`Hard cap. The node will not pay more routing fee than this. At most ${maxCap}.`}
              error={show(maxFee)}
              required
            />
            {invoice.requires_description && (
              <Textarea
                label="Description"
                value={form.description}
                onValueChange={(value) => setForm((current) => ({ ...current, description: value }))}
                error={show(description)}
                required
              />
            )}
            <ReviewSubmit label="Review payment" pending={submit.isPending} error={submit.error} nodeId={node.id} fields={FIELDS} />
          </Flex>
        </form>
      )}
    </Flex>
  );
}
