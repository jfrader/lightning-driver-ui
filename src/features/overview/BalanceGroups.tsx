import { styled } from '@jfrader/ui';
import { useQuery } from '@tanstack/react-query';
import { balancesQueryOptions } from '../../api/node-queries';
import type { Balances } from '../../api/types';
import { ErrorNotice } from '../../components/ErrorNotice';
import { Freshness } from '../../components/Freshness';
import { LoadingState } from '../../components/LoadingState';
import { TABLE_MEDIA } from '../../config';
import { Amount } from '../display/Amount';
import { type WireUnit } from '../../lib/money';
import { BalanceComposition } from './BalanceComposition';
import { ShareSwatch } from '../display/ShareSwatch';

const Grid = styled.div(({ theme }) => ({
  display: 'grid',
  gap: theme.space[6],
  [TABLE_MEDIA]: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: theme.space[8] },
}));

const Group = styled.section({ display: 'grid', alignContent: 'start', minInlineSize: 0 });

const GroupTitle = styled.h3(({ theme }) => ({
  margin: 0,
  marginBlockEnd: theme.space[1],
  fontSize: theme.textSize.sm,
  fontWeight: theme.fontWeight.medium,
  color: theme.color.textMuted,
}));

const Rows = styled.dl({ margin: 0, display: 'grid' });

const Row = styled.div<{ lead: boolean }>(({ theme, lead }) => ({
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  columnGap: theme.space[3],
  paddingBlock: theme.space[2],
  fontSize: lead ? theme.textSize.xl : theme.textSize.sm,
  fontWeight: lead ? theme.fontWeight.medium : theme.fontWeight.regular,
  borderBlockEnd: `1px solid ${lead ? theme.color.border : theme.color.borderSubtle}`,
  '&:last-of-type': { borderBlockEnd: 'none' },
}));

const Term = styled.dt<{ lead: boolean }>(({ theme, lead }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  fontSize: theme.textSize.sm,
  fontWeight: theme.fontWeight.regular,
  color: lead ? theme.color.text : theme.color.textMuted,
}));

const Value = styled.dd({ margin: 0 });

interface BalanceLine {
  label: string;
  field: keyof Pick<
    Balances,
    | 'onchain_confirmed_sat'
    | 'onchain_unconfirmed_sat'
    | 'onchain_spendable_sat'
    | 'channel_local_msat'
    | 'channel_remote_msat'
    | 'channel_spendable_msat'
  >;
  unit: WireUnit;
}

interface BalanceGroup {
  title: string;
  /** The lead figure and the first supporting row form the composition. */
  lead: BalanceLine;
  rows: readonly [BalanceLine, BalanceLine];
}

/** Two groups, never summed together: on-chain and channel balances are different things. */
const GROUPS: readonly BalanceGroup[] = [
  {
    title: 'On-chain',
    lead: { label: 'Confirmed', field: 'onchain_confirmed_sat', unit: 'sat' },
    rows: [
      { label: 'Unconfirmed', field: 'onchain_unconfirmed_sat', unit: 'sat' },
      { label: 'Spendable', field: 'onchain_spendable_sat', unit: 'sat' },
    ],
  },
  {
    title: 'Lightning channels',
    lead: { label: 'Local balance', field: 'channel_local_msat', unit: 'msat' },
    rows: [
      { label: 'Remote balance', field: 'channel_remote_msat', unit: 'msat' },
      { label: 'Spendable', field: 'channel_spendable_msat', unit: 'msat' },
    ],
  },
];

/** Exact balances per group; `Not reported` for nulls. Remote balance is a balance, not receive capacity. */
export function BalanceGroups({ nodeId }: { nodeId: string }) {
  const balances = useQuery(balancesQueryOptions(nodeId));
  if (balances.isPending) return <LoadingState label="Loading balances" />;
  if (balances.isError) return <ErrorNotice error={balances.error} onRetry={() => void balances.refetch()} />;
  const data = balances.data;
  return (
    <>
      <Grid>
        {GROUPS.map((group) => {
          const lines = [group.lead, ...group.rows];
          return (
            <Group key={group.title} aria-label={group.title}>
              <GroupTitle>{group.title}</GroupTitle>
              <Rows>
                {lines.map((line, index) => (
                  <Row key={line.field} lead={index === 0}>
                    <Term lead={index === 0}>
                      {index < 2 && <ShareSwatch tone={index === 0 ? 'primary' : 'secondary'} />}
                      {line.label}
                    </Term>
                    <Value>
                      <Amount value={data[line.field]} unit={line.unit} />
                    </Value>
                  </Row>
                ))}
              </Rows>
              <BalanceComposition
                title={group.title}
                first={{ label: group.lead.label, value: data[group.lead.field], unit: group.lead.unit }}
                second={{ label: group.rows[0].label, value: data[group.rows[0].field], unit: group.rows[0].unit }}
              />
            </Group>
          );
        })}
      </Grid>
      <Freshness observedAt={data.observed_at} stale={data.stale} />
    </>
  );
}
