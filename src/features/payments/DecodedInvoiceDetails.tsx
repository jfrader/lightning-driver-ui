import type { DecodedInvoice } from '../../api/types';
import { DetailList } from '../../components/DetailList';
import { UtcTime } from '../../components/UtcTime';
import { Amount } from '../display/Amount';
import { Identifier } from '../display/Identifier';
import { NotReported } from '../display/NotReported';

/** What the invoice says, read-only, before anything is set or reviewed. */
export function DecodedInvoiceDetails({ invoice }: { invoice: DecodedInvoice }) {
  return (
    <DetailList
      items={[
        {
          label: 'Amount',
          numeric: true,
          value: invoice.amount_msat === null ? <NotReported>Amount not set in invoice</NotReported> : <Amount value={invoice.amount_msat} unit="msat" />,
        },
        { label: 'Recipient node', stacked: true, value: <Identifier value={invoice.destination} label="Recipient node" /> },
        {
          label: 'Description',
          stacked: true,
          value: invoice.description ?? <NotReported>{invoice.description_hash ? 'Description hash only' : 'No description'}</NotReported>,
        },
        { label: 'Invoice expires', value: <UtcTime value={invoice.expires_at} /> },
      ]}
    />
  );
}
