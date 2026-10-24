import type { ReactNode } from 'react';
import { styled } from '@jfrader/ui';

export interface DetailItem {
  label: string;
  value: ReactNode;
  /** Right-aligned value with tabular figures (amounts, counts). */
  numeric?: boolean;
  /** Long value (identifier, description) on its own line under the label. */
  stacked?: boolean;
}

const List = styled.dl({ margin: 0, display: 'grid', inlineSize: '100%', minInlineSize: 0, containerType: 'inline-size' });

const Pair = styled.div<{ stacked: boolean }>(({ theme, stacked }) => ({
  display: 'grid',
  gridTemplateColumns: stacked ? 'minmax(0, 1fr)' : 'minmax(8rem, max-content) minmax(0, 1fr)',
  alignItems: 'baseline',
  columnGap: theme.space[4],
  rowGap: theme.space[1],
  paddingBlock: theme.space[2],
  borderBlockEnd: `1px solid ${theme.color.borderSubtle}`,
  '&:last-of-type': { borderBlockEnd: 'none' },
  '@container (max-width: 30em)': { gridTemplateColumns: 'minmax(0, 1fr)' },
}));

const Term = styled.dt(({ theme }) => ({ color: theme.color.textMuted, fontSize: theme.textSize.sm }));

const Value = styled.dd<{ numeric: boolean }>(({ numeric }) => ({
  margin: 0,
  minInlineSize: 0,
  overflowWrap: 'anywhere',
  textAlign: numeric ? 'end' : 'start',
}));

/** Label/value rows separated by hairlines. */
export function DetailList({ items }: { items: readonly DetailItem[] }) {
  return (
    <List>
      {items.map((item) => (
        <Pair key={item.label} stacked={item.stacked ?? false}>
          <Term>{item.label}</Term>
          <Value numeric={(item.numeric ?? false) && !item.stacked}>{item.value}</Value>
        </Pair>
      ))}
    </List>
  );
}
