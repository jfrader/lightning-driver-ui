import { styled } from '@jfrader/ui';
import type { ChartTone } from '../appearance/appearance-context';
import { ShareSwatch } from './ShareSwatch';

const List = styled.ul(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  columnGap: theme.space[4],
  rowGap: theme.space[1],
  margin: 0,
  padding: 0,
  listStyle: 'none',
  fontSize: theme.textSize.xs,
  color: theme.color.textMuted,
}));

const Item = styled.li({ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' });

/** One shared key above a list of bars, never one per chart. */
export function ShareKey({ label, items }: { label: string; items: readonly { label: string; tone: ChartTone }[] }) {
  return (
    <List aria-label={label}>
      {items.map((item) => (
        <Item key={item.tone}>
          <ShareSwatch tone={item.tone} />
          {item.label}
        </Item>
      ))}
    </List>
  );
}
