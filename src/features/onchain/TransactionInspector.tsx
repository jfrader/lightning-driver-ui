import type { ReactNode } from 'react';
import { styled } from '@jfrader/ui';
import type { Transaction } from '../../api/types';
import { DetailList } from '../../components/DetailList';
import { Section } from '../../components/Section';
import { LiveUtcTime } from '../../components/UtcTime';
import { Amount } from '../display/Amount';
import { Identifier } from '../display/Identifier';
import { NotReported } from '../display/NotReported';
import { TransactionBlock, TransactionConfirmations, TransactionDirection } from './TransactionCells';
import { OUTPUT_OWNER } from './labels';

const Stack = styled.div(({ theme }) => ({ display: 'grid', gap: theme.space[4], minInlineSize: 0 }));

const Note = styled.p(({ theme }) => ({ margin: 0, fontSize: theme.textSize.sm, color: theme.color.textMuted }));

const Outputs = styled.ol({ margin: 0, padding: 0, listStyle: 'none' });

const Output = styled.li(({ theme }) => ({
  display: 'grid',
  gap: theme.space[1],
  paddingBlock: theme.space[2],
  borderBlockEnd: `1px solid ${theme.color.borderSubtle}`,
  '&:last-of-type': { borderBlockEnd: 'none' },
}));

const Line = styled.div(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  columnGap: theme.space[3],
  fontSize: theme.textSize.sm,
}));

const Index = styled.span(({ theme }) => ({ fontFamily: theme.font.mono, color: theme.color.textMuted }));

interface TransactionInspectorProps {
  /** The selected transaction, or `null` when its txid is not on the loaded page. */
  transaction: Transaction | null;
  close: ReactNode;
}

/** One transaction: the wallet change, fee, confirmations, the full txid and its outputs in index order. */
export function TransactionInspector({ transaction, close }: TransactionInspectorProps) {
  if (!transaction) {
    return (
      <Section title="Transaction" action={close}>
        <Note>This transaction is not on the loaded page.</Note>
      </Section>
    );
  }
  const outputs = [...transaction.outputs].sort((a, b) => a.index - b.index);
  return (
    <Section title="Transaction" action={close}>
      <Stack>
        <DetailList
          items={[
            { label: 'Direction', value: <TransactionDirection transaction={transaction} /> },
            { label: 'Wallet change', numeric: true, value: <Amount value={transaction.amount_sat} unit="sat" /> },
            { label: 'Fee', numeric: true, value: <Amount value={transaction.fee_sat} unit="sat" /> },
            { label: 'Confirmations', value: <TransactionConfirmations transaction={transaction} /> },
            { label: 'Block', value: <TransactionBlock transaction={transaction} /> },
            { label: 'Time', value: <LiveUtcTime value={transaction.occurred_at} /> },
            { label: 'Txid', stacked: true, value: <Identifier value={transaction.txid} label="Txid" /> },
          ]}
        />
        {transaction.confirmations === '0' && <Note>Not yet in a block.</Note>}
        <Section title="Outputs">
          {outputs.length === 0 ? (
            <Note>No outputs reported.</Note>
          ) : (
            <Outputs aria-label="Outputs">
              {outputs.map((output) => (
                <Output key={output.index}>
                  <Line>
                    <Index>#{output.index}</Index>
                    <Amount value={output.amount_sat} unit="sat" />
                  </Line>
                  {output.address ? <Identifier value={output.address} label="Address" /> : <NotReported>Address not reported</NotReported>}
                  <Line>
                    {output.is_ours === null ? <NotReported>Owner not reported</NotReported> : <span>{OUTPUT_OWNER[`${output.is_ours}`]}</span>}
                  </Line>
                </Output>
              ))}
            </Outputs>
          )}
        </Section>
      </Stack>
    </Section>
  );
}
