import type { DecodedInvoice } from '../../api/types';
import { CopyValue } from '../../components/CopyValue';
import { DateTimeText } from '../../components/DateTimeText';
import { DetailList } from '../../components/DetailList';
import { Amount } from '../display/Amount';
import { NETWORK_LABEL } from '../nodes/labels';

export function DecodedInvoiceDetails({ invoice }: { invoice: DecodedInvoice }) {
  return (
    <DetailList
      items={[
        {
          label: 'Amount',
          value: invoice.amount_msat === null ? 'Not set; enter an amount' : <Amount value={invoice.amount_msat} unit="msat" />,
        },
        { label: 'Destination', value: <CopyValue value={invoice.destination} label="Destination" /> },
        { label: 'Description', value: invoice.description ?? (invoice.description_hash ? 'Hashed description' : 'None') },
        { label: 'Network', value: NETWORK_LABEL[invoice.network] },
        { label: 'Expires', value: <DateTimeText value={invoice.expires_at} /> },
        { label: 'Payment hash', value: <CopyValue value={invoice.payment_hash} label="Payment hash" /> },
      ]}
    />
  );
}
