import type { ReactNode } from 'react';
import { Accordion, CopyButton, styled } from '@jfrader/ui';
import type { Invoice } from '../../api/types';
import { DetailList, type DetailItem } from '../../components/DetailList';
import { Section } from '../../components/Section';
import { UtcTime } from '../../components/UtcTime';
import { Amount } from '../display/Amount';
import { Identifier } from '../display/Identifier';
import { NotReported } from '../display/NotReported';
import { StateWord } from '../display/StateWord';
import { useControlSize } from '../shell/use-shell-layout';
import { InvoiceExpiryText } from './InvoiceCells';
import { INVOICE_STATE, payableBolt11 } from './labels';

const Stack = styled.div(({ theme }) => ({ display: 'grid', gap: theme.space[4], minInlineSize: 0 }));

const Note = styled.p(({ theme }) => ({ margin: 0, fontSize: theme.textSize.sm, color: theme.color.textMuted }));

const Mono = styled.span(({ theme }) => ({ fontFamily: theme.font.mono, fontSize: theme.textSize.sm }));

const FullText = styled.span({ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' });

interface InvoiceInspectorProps {
  /** The selected invoice, or `null` when its hash is not on the loaded page. */
  invoice: Invoice | null;
  now: number;
  close: ReactNode;
}

/** One invoice: amounts side by side (never combined), times, full description and the exact invoice text. */
export function InvoiceInspector({ invoice, now, close }: InvoiceInspectorProps) {
  const size = useControlSize();
  if (!invoice) {
    return (
      <Section title="Invoice" action={close}>
        <Note>This invoice is not on the loaded page.</Note>
      </Section>
    );
  }
  const bolt11 = payableBolt11(invoice, now);
  const facts: (DetailItem | false)[] = [
    { label: 'State', value: <StateWord state={INVOICE_STATE[invoice.state]} /> },
    { label: 'Amount', numeric: true, value: <Amount value={invoice.amount_msat} unit="msat" /> },
    { label: 'Received', numeric: true, value: <Amount value={invoice.received_msat} unit="msat" /> },
    { label: 'Created', value: <UtcTime value={invoice.created_at} now={now} /> },
    { label: 'Expires', value: <InvoiceExpiryText invoice={invoice} now={now} /> },
    (invoice.state === 'paid' || invoice.paid_at !== null) && { label: 'Paid at', value: <UtcTime value={invoice.paid_at} /> },
    {
      label: 'Description',
      stacked: true,
      value: invoice.description === null ? <NotReported>No description</NotReported> : <FullText>{invoice.description}</FullText>,
    },
  ];
  const technical = (
    <DetailList
      items={[
        { label: 'Payment hash', stacked: true, value: <Identifier value={invoice.payment_hash} label="Payment hash" /> },
        {
          label: 'Invoice text',
          stacked: true,
          value: invoice.bolt11 ? <Identifier value={invoice.bolt11} label="Invoice text" /> : <NotReported />,
        },
        { label: 'Node state', value: <Mono>{invoice.backend_state}</Mono> },
      ]}
    />
  );
  return (
    <Section title="Invoice" action={close}>
      <Stack>
        <DetailList items={facts.filter((item): item is DetailItem => item !== false)} />
        {bolt11 !== null ? (
          <CopyButton
            text={bolt11}
            label="Copy invoice"
            pendingLabel="Copying"
            copiedLabel="Invoice copied"
            errorLabel="Copy failed"
            size={size}
            variant="outline"
            sx={{ justifySelf: 'start' }}
          />
        ) : (
          invoice.bolt11 === null && <Note>Invoice text not reported</Note>
        )}
        <Accordion collapsible items={[{ value: 'technical', label: 'Technical details', panel: technical }]} />
      </Stack>
    </Section>
  );
}
