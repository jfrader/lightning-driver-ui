import { styled } from '@jfrader/ui';

/**
 * Phone list row: a vertical stack of wrapped lines. The table layout takes over from 48rem, so this
 * only has to read well as a card. `md` is for rows whose first line is a name plus a state.
 */
export const RowBody = styled.div<{ gap?: 'sm' | 'md' }>(({ theme, gap = 'sm' }) => ({
  display: 'grid',
  gap: gap === 'md' ? theme.space[2] : theme.space[1],
  minInlineSize: 0,
}));

/** One line of a row: its ends meet the card edges and the content wraps instead of overflowing. */
export const RowLine = styled.div<{ align?: 'baseline' | 'center' }>(({ theme, align = 'baseline' }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: align,
  justifyContent: 'space-between',
  columnGap: theme.space[3],
  rowGap: theme.space[1],
  minInlineSize: 0,
}));
