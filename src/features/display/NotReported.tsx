import { styled } from '@jfrader/ui';

const Missing = styled.span(({ theme }) => ({ color: theme.color.textSubtle, fontStyle: 'italic' }));

/** A value the node or server did not report. Never zero, never an empty cell. */
export function NotReported({ children = 'Not reported' }: { children?: string }) {
  return <Missing>{children}</Missing>;
}
