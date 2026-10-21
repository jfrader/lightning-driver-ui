import { useState, type FormEvent } from 'react';
import { Alert, Button, Flex, TextField, Textarea } from '@jfrader/ui';
import { useMutation } from '@tanstack/react-query';
import { decodeInvoice } from '../../api/node-api';
import type { DecodedInvoice, NodePolicy } from '../../api/types';
import { ErrorNotice } from '../../components/ErrorNotice';
import { Panel } from '../../components/Panel';
import { formatMsatInput, msatToWireMsat, wireToMsat } from '../../lib/money';
import { useDisplayUnit } from '../display/unit-context';
import { AmountField, type AmountEntry } from '../forms/AmountField';
import { checkAmount, type Checked } from '../forms/validation';
import { NETWORK_LABEL } from '../nodes/labels';
import { SubmitFeedback } from '../operations/SubmitFeedback';
import { useSubmitOperation } from '../operations/use-submit-operation';
import { DecodedInvoiceDetails } from './DecodedInvoiceDetails';

const MIN_FEE_CAP_MSAT = '1';

interface PayInvoiceFormProps {
  nodeId: string;
  policy: NodePolicy;
}

interface FormState {
  bolt11: string;
  decoded: { bolt11: string; invoice: DecodedInvoice } | null;
  amount: AmountEntry;
  maxFee: AmountEntry;
  description: string;
  submitted: boolean;
}

function payBlocker(invoice: DecodedInvoice): string | null {
  if (invoice.expired) return 'This invoice expired.';
  if (invoice.network_matches_node === null) return 'The node network is unknown. Payments are blocked.';
  if (!invoice.network_matches_node) return `This invoice is for ${NETWORK_LABEL[invoice.network]}, not this node's network.`;
  return null;
}

/** Decode locally first, then create a server review. Nothing is paid until the review is confirmed. */
export function PayInvoiceForm({ nodeId, policy }: PayInvoiceFormProps) {
  const { unit } = useDisplayUnit();
  const [form, setForm] = useState<FormState>(() => ({
    bolt11: '',
    decoded: null,
    amount: { text: '', unit },
    maxFee: { text: formatMsatInput(wireToMsat(policy.default_max_routing_fee_msat, 'msat'), unit), unit },
    description: '',
    submitted: false,
  }));
  const decode = useMutation({
    mutationFn: (bolt11: string) => decodeInvoice(nodeId, bolt11),
    onSuccess: (invoice, bolt11) => setForm((current) => ({ ...current, decoded: { bolt11, invoice }, submitted: false })),
  });
  const submit = useSubmitOperation(nodeId);

  const bolt11 = form.bolt11.trim();
  const invoice = form.decoded?.bolt11 === bolt11 ? form.decoded.invoice : null;
  const amountless = invoice?.amount_msat === null;
  const amount = amountless
    ? checkAmount(form.amount, { allowMsat: true, bounds: policy.pay_invoice_msat, boundsUnit: 'msat' })
    : null;
  const maxFee = checkAmount(form.maxFee, {
    allowMsat: true,
    bounds: { min: MIN_FEE_CAP_MSAT, max: policy.max_routing_fee_msat },
    boundsUnit: 'msat',
  });
  const description: Checked<string | null> =
    invoice?.requires_description && form.description.trim() === ''
      ? { ok: false, error: 'Enter the description this invoice commits to.' }
      : { ok: true, value: invoice?.requires_description ? form.description : null };
  const show = (check: Checked<unknown> | null) => (form.submitted && check && !check.ok ? check.error : undefined);
  const blocker = invoice ? payBlocker(invoice) : null;

  const onDecode = (event: FormEvent) => {
    event.preventDefault();
    if (bolt11 && !decode.isPending) decode.mutate(bolt11);
  };

  const onReview = () => {
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

  return (
    <Flex direction="column" gap="md">
      <form noValidate onSubmit={onDecode}>
        <Flex direction="column" gap="sm">
          <Textarea
            label="Lightning invoice"
            value={form.bolt11}
            onValueChange={(value) => setForm((current) => ({ ...current, bolt11: value }))}
            autoComplete="off"
            spellCheck={false}
            rows={4}
            required
          />
          <Flex>
            <Button type="submit" variant="outline" loading={decode.isPending} disabled={bolt11 === ''}>
              Decode
            </Button>
          </Flex>
          {decode.isError && <ErrorNotice error={decode.error} />}
        </Flex>
      </form>
      {invoice && (
        <Panel title="Invoice">
          <Flex direction="column" gap="md">
            <DecodedInvoiceDetails invoice={invoice} />
            {blocker ? (
              <Alert tone="danger" title={blocker}>
                Nothing was sent.
              </Alert>
            ) : (
              <Flex direction="column" gap="md">
                {amountless && (
                  <AmountField
                    label="Amount"
                    value={form.amount}
                    onChange={(value) => setForm((current) => ({ ...current, amount: value }))}
                    error={show(amount)}
                    required
                  />
                )}
                <AmountField
                  label="Maximum routing fee"
                  value={form.maxFee}
                  onChange={(value) => setForm((current) => ({ ...current, maxFee: value }))}
                  error={show(maxFee)}
                  required
                />
                {invoice.requires_description && (
                  <TextField
                    label="Invoice description"
                    value={form.description}
                    onValueChange={(value) => setForm((current) => ({ ...current, description: value }))}
                    error={show(description)}
                    required
                  />
                )}
                <Flex>
                  <Button tone="accent" loading={submit.isPending} onClick={onReview}>
                    Review payment
                  </Button>
                </Flex>
                <SubmitFeedback error={submit.error} result={submit.data} />
              </Flex>
            )}
          </Flex>
        </Panel>
      )}
    </Flex>
  );
}
