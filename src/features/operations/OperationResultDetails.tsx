import { Flex } from '@jfrader/ui';
import type { OperationResult } from '../../api/types';
import { CopyValue } from '../../components/CopyValue';
import { DetailList, type DetailItem } from '../../components/DetailList';
import { InlineCode } from '../../components/InlineCode';
import { formatInteger, parseWireDecimal } from '../../lib/money';
import { CLOSE_TYPE } from '../channels/labels';
import { Amount } from '../display/Amount';

function confirmations(value: string | null): string {
  return value === null ? 'Not reported' : formatInteger(parseWireDecimal(value));
}

function resultItems(result: OperationResult): DetailItem[] {
  switch (result.kind) {
    case 'create_invoice':
      return [
        { label: 'Invoice', value: <InlineCode>{result.bolt11}</InlineCode> },
        { label: 'Payment hash', value: <CopyValue value={result.payment_hash} label="Payment hash" /> },
      ];
    case 'pay_invoice':
      return [
        { label: 'Amount paid', value: <Amount value={result.amount_msat} unit="msat" /> },
        { label: 'Routing fee', value: <Amount value={result.fee_msat} unit="msat" /> },
        { label: 'Payment hash', value: <CopyValue value={result.payment_hash} label="Payment hash" /> },
      ];
    case 'connect_peer':
    case 'disconnect_peer':
      return [
        { label: 'Peer', value: <CopyValue value={result.pubkey} label="Peer" /> },
        { label: 'Connected', value: result.connected ? 'Yes' : 'No' },
      ];
    case 'open_channel':
      return [
        { label: 'Channel', value: result.channel_id ? <CopyValue value={result.channel_id} label="Channel ID" /> : 'Not assigned yet' },
        {
          label: 'Funding output',
          value: result.funding_outpoint ? <CopyValue value={result.funding_outpoint} label="Funding output" /> : 'Not reported yet',
        },
      ];
    case 'close_channel':
      return [
        { label: 'Channel', value: <CopyValue value={result.channel_id} label="Channel ID" /> },
        { label: 'Close type', value: CLOSE_TYPE[result.close_type] },
        ...result.txids.map((txid, index) => ({
          label: `Closing transaction ${index + 1}`,
          value: <CopyValue value={txid} label="Transaction ID" />,
        })),
        { label: 'Confirmations', value: confirmations(result.confirmations) },
      ];
    case 'new_address':
      return [{ label: 'Address', value: <CopyValue value={result.address} label="Address" align="start" /> }];
    case 'send_onchain':
      return [
        { label: 'Transaction', value: <CopyValue value={result.txid} label="Transaction ID" /> },
        { label: 'Amount', value: <Amount value={result.amount_sat} unit="sat" /> },
        { label: 'Fee', value: <Amount value={result.fee_sat} unit="sat" /> },
        { label: 'Confirmations', value: confirmations(result.confirmations) },
      ];
  }
}

/** Server-reported references; they can appear before the operation is final. */
export function OperationResultDetails({ result }: { result: OperationResult }) {
  return (
    <Flex direction="column" gap="md" align="start">
      <DetailList items={resultItems(result)} />
    </Flex>
  );
}
