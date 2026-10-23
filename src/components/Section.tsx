import { useId, type ReactNode } from 'react';
import { styled } from '@jfrader/ui';

const Root = styled.section({ minInlineSize: 0 });

const Header = styled.div(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: theme.space[3],
  minBlockSize: theme.space[8],
  marginBlockEnd: theme.space[3],
}));

const Title = styled.h2(({ theme }) => ({
  margin: 0,
  fontSize: theme.textSize.xs,
  fontWeight: theme.fontWeight.semibold,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: theme.color.textMuted,
  minInlineSize: 0,
  overflowWrap: 'anywhere',
}));

const Rule = styled.span(({ theme }) => ({
  flex: 1,
  minInlineSize: theme.space[4],
  borderBlockStart: `1px solid ${theme.color.border}`,
}));

interface SectionProps {
  title: string;
  /** Optional trailing action, e.g. "All payments". */
  action?: ReactNode;
  children: ReactNode;
}

/** Pane title, hairline and optional action; the section is a landmark named by its title. */
export function Section({ title, action, children }: SectionProps) {
  const id = useId();
  return (
    <Root aria-labelledby={id}>
      <Header>
        <Title id={id}>{title}</Title>
        <Rule aria-hidden="true" />
        {action}
      </Header>
      {children}
    </Root>
  );
}
