import { Flex } from '@jfrader/ui';
import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { transactionsQueryOptions } from '../../api/node-queries';
import type { Transaction } from '../../api/types';
import { ButtonLink } from '../../components/ButtonLink';
import { CopyValue } from '../../components/CopyValue';
import { DateTimeText } from '../../components/DateTimeText';
import { PageHeader } from '../../components/PageHeader';
import { PagedList } from '../../components/PagedList';
import type { ResourceColumn } from '../../components/ResourceList';
import { formatInteger, parseWireDecimal } from '../../lib/money';
import { Amount } from '../display/Amount';
import { CapabilityAction } from '../nodes/CapabilityAction';
import { useCurrentNode } from '../nodes/use-current-node';

const route = getRouteApi('/_authed/nodes/$nodeId/onchain');

const DIRECTION: Record<Transaction['direction'], string> = {
  incoming: 'Received',
  outgoing: 'Sent',
  self: 'To self',
  unknown: 'Not determined',
};

const COLUMNS: readonly ResourceColumn<Transaction>[] = [
  { id: 'time', header: 'Time', cell: (tx) => <DateTimeText value={tx.occurred_at} /> },
  { id: 'direction', header: 'Direction', cell: (tx) => DIRECTION[tx.direction] },
  { id: 'amount', header: 'Amount', numeric: true, cell: (tx) => <Amount value={tx.amount_sat} unit="sat" /> },
  { id: 'fee', header: 'Fee', numeric: true, cell: (tx) => <Amount value={tx.fee_sat} unit="sat" /> },
  {
    id: 'confirmations',
    header: 'Confirmations',
    numeric: true,
    cell: (tx) => (tx.confirmations === null ? 'Not reported' : formatInteger(parseWireDecimal(tx.confirmations))),
  },
  { id: 'txid', header: 'Transaction', cell: (tx) => <CopyValue value={tx.txid} label="Transaction ID" /> },
];

export function TransactionsPage() {
  const node = useCurrentNode();
  const { cursor } = route.useSearch();
  const navigate = route.useNavigate();
  const transactions = useQuery(transactionsQueryOptions(node.id, { cursor }));
  const params = { nodeId: node.id };
  return (
    <Flex direction="column" gap="md">
      <PageHeader
        title="On-chain"
        actions={
          <>
            <CapabilityAction node={node} capability="new_address">
              <ButtonLink to="/nodes/$nodeId/onchain/receive" params={params} variant="outline">
                New address
              </ButtonLink>
            </CapabilityAction>
            <CapabilityAction node={node} capability="send_onchain">
              <ButtonLink to="/nodes/$nodeId/onchain/send" params={params} tone="accent">
                Send
              </ButtonLink>
            </CapabilityAction>
          </>
        }
      />
      <PagedList
        caption="Transactions"
        query={transactions}
        columns={COLUMNS}
        getRowId={(tx) => tx.txid}
        emptyTitle="No transactions"
        cursor={cursor}
        onCursor={(next) => void navigate({ search: { cursor: next } })}
      />
    </Flex>
  );
}
