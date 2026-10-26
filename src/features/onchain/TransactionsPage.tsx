import type { ReactNode } from 'react';
import { Flex, styled } from '@jfrader/ui';
import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { transactionsQueryOptions } from '../../api/node-queries';
import type { Transaction } from '../../api/types';
import { ButtonLink } from '../../components/ButtonLink';
import { InspectorLayout } from '../../components/InspectorLayout';
import { PageHeader } from '../../components/PageHeader';
import { PagedList } from '../../components/PagedList';
import type { ResourceColumn } from '../../components/ResourceList';
import { ROW_PRIMARY_LINK } from '../../components/row-link';
import { TextLink } from '../../components/TextLink';
import { VisuallyHidden } from '../../components/VisuallyHidden';
import { Amount } from '../display/Amount';
import { ShortIdentifier } from '../display/Identifier';
import { CapabilityAction } from '../nodes/CapabilityAction';
import { useCurrentNode } from '../nodes/use-current-node';
import { useControlSize } from '../shell/use-shell-layout';
import { MoneyActionButton } from '../shell/MoneyActionButton';
import {
  TransactionBlock,
  TransactionConfirmations,
  TransactionDirection,
  TransactionTime,
} from './TransactionCells';
import { TransactionInspector } from './TransactionInspector';

const route = getRouteApi('/_authed/nodes/$nodeId/_configured/onchain');

const RowBody = styled.div(({ theme }) => ({ display: 'grid', gap: theme.space[1], minInlineSize: 0 }));

const Line = styled.div(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  columnGap: theme.space[3],
  rowGap: theme.space[1],
  minInlineSize: 0,
}));

const Small = styled.span(({ theme }) => ({
  display: 'inline-flex',
  flexWrap: 'wrap',
  gap: '0.4em',
  fontSize: theme.textSize.xs,
  color: theme.color.textMuted,
}));

type Open = (transaction: Transaction, label: ReactNode) => ReactNode;

function columns(open: Open): ResourceColumn<Transaction>[] {
  return [
    { id: 'time', header: 'Time (UTC)', width: '9rem', cell: (tx) => open(tx, <TransactionTime transaction={tx} />) },
    { id: 'direction', header: 'Direction', cell: (tx) => <TransactionDirection transaction={tx} /> },
    { id: 'amount', header: 'Amount', numeric: true, cell: (tx) => <Amount value={tx.amount_sat} unit="sat" /> },
    { id: 'fee', header: 'Fee', numeric: true, cell: (tx) => <Amount value={tx.fee_sat} unit="sat" /> },
    { id: 'confirmations', header: 'Confirmations', cell: (tx) => <TransactionConfirmations transaction={tx} /> },
    { id: 'block', header: 'Block', cell: (tx) => <TransactionBlock transaction={tx} /> },
    { id: 'txid', header: 'Txid', cell: (tx) => <ShortIdentifier value={tx.txid} /> },
  ];
}

/** Phone row: amount and direction, confirmations and fee, time and txid. */
function TransactionRow({ transaction, open }: { transaction: Transaction; open: Open }) {
  return (
    <RowBody>
      <Line>
        <Amount value={transaction.amount_sat} unit="sat" />
        <TransactionDirection transaction={transaction} />
      </Line>
      <Line>
        <TransactionConfirmations transaction={transaction} />
        <Small>
          <span>Fee</span>
          <Amount value={transaction.fee_sat} unit="sat" />
        </Small>
      </Line>
      <Line>
        <Small>{open(transaction, <TransactionTime transaction={transaction} />)}</Small>
        <ShortIdentifier value={transaction.txid} />
      </Line>
    </RowBody>
  );
}

const open: Open = (transaction, label) => (
  <TextLink
    from="/nodes/$nodeId/onchain"
    search={(previous) => ({ ...previous, selected: transaction.txid })}
    {...ROW_PRIMARY_LINK}
  >
    {label}
    <VisuallyHidden>{` (Open transaction ${transaction.txid.slice(0, 8)})`}</VisuallyHidden>
  </TextLink>
);
const listColumns = columns(open);
const getRowId = (transaction: Transaction) => transaction.txid;
const renderRow = (transaction: Transaction) => <TransactionRow transaction={transaction} open={open} />;

/** On-chain transactions of the node's wallet; no balances here (they live on Overview). */
export function TransactionsPage() {
  const node = useCurrentNode();
  const size = useControlSize();
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const transactions = useQuery(transactionsQueryOptions(node.id, { cursor: search.cursor }));
  const selected = search.selected
    ? (transactions.data?.items.find((transaction) => transaction.txid === search.selected) ?? null)
    : undefined;

  const list = (
    <PagedList
      caption="Transactions"
      query={transactions}
      columns={listColumns}
      getRowId={getRowId}
      renderRow={renderRow}
      emptyTitle="No on-chain transactions on this node."
      cursor={search.cursor}
      onCursor={(cursor) => void navigate({ search: { cursor } })}
    />
  );

  return (
    <Flex direction="column" gap="md">
      <InspectorLayout
        header={
          <PageHeader
            title="On-chain"
            actions={
              <>
                <CapabilityAction node={node} capability="new_address">
                  <MoneyActionButton action="new_address" size={size} variant="outline">
                    New address
                  </MoneyActionButton>
                </CapabilityAction>
                <CapabilityAction node={node} capability="send_onchain">
                  <MoneyActionButton action="send_onchain" size={size} variant="outline">
                    Send on-chain
                  </MoneyActionButton>
                </CapabilityAction>
              </>
            }
          />
        }
        list={list}
        inspectorLabel="Selected transaction"
        inspector={
          selected === undefined || transactions.isPending ? null : (
            <TransactionInspector
              transaction={selected}
              close={
                <ButtonLink
                  variant="ghost"
                  size={size}
                  from="/nodes/$nodeId/onchain"
                  search={(previous) => ({ ...previous, selected: undefined })}
                  resetScroll={false}
                >
                  Hide
                </ButtonLink>
              }
            />
          )
        }
      />
    </Flex>
  );
}
