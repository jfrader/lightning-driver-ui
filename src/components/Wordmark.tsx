import { styled } from '@jfrader/ui';

const Mark = styled.span(({ theme }) => ({
  fontFamily: theme.font.mono,
  fontSize: theme.textSize.xs,
  letterSpacing: '0.04em',
  color: theme.color.textSubtle,
}));

export function Wordmark() {
  return <Mark>lightning-driver</Mark>;
}
