import type { ReactNode } from 'react';
import { styled } from '@jfrader/ui';
import { NARROW_LAYOUT_MEDIA } from '../config';

export interface DetailItem {
  label: string;
  value: ReactNode;
}

const List = styled.dl(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'minmax(8rem, max-content) minmax(0, 1fr)',
  gap: `${theme.space[2]} ${theme.space[4]}`,
  margin: 0,
  [NARROW_LAYOUT_MEDIA]: { gridTemplateColumns: 'minmax(0, 1fr)', rowGap: theme.space[1] },
}));

const Term = styled.dt(({ theme }) => ({ color: theme.color.textMuted, fontSize: theme.textSize.sm }));
const Value = styled.dd(({ theme }) => ({
  margin: 0,
  minInlineSize: 0,
  overflowWrap: 'anywhere',
  [NARROW_LAYOUT_MEDIA]: { marginBlockEnd: theme.space[2] },
}));
const Pair = styled.div({ display: 'contents' });

export function DetailList({ items }: { items: readonly DetailItem[] }) {
  return (
    <List>
      {items.map((item) => (
        <Pair key={item.label}>
          <Term>{item.label}</Term>
          <Value>{item.value}</Value>
        </Pair>
      ))}
    </List>
  );
}
