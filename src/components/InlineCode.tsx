import { styled } from '@jfrader/ui';

export const InlineCode = styled.code(({ theme }) => ({
  fontFamily: theme.font.mono,
  fontSize: theme.textSize.sm,
  overflowWrap: 'anywhere',
  minInlineSize: 0,
}));
