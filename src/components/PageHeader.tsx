import type { ReactNode } from 'react';
import { styled } from '@jfrader/ui';

const Header = styled.div(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  alignItems: 'center',
  gap: theme.space[2],
  minInlineSize: 0,
}));

const Actions = styled.div(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: theme.space[2],
  minInlineSize: 0,
}));

const Title = styled.h2(({ theme }) => ({
  margin: 0,
  fontSize: theme.textSize.xl,
  fontWeight: theme.fontWeight.semibold,
  minInlineSize: 0,
  overflowWrap: 'anywhere',
  '&:only-child': { gridColumn: '1 / -1' },
}));

interface PageHeaderProps {
  title: string;
  actions?: ReactNode;
  /** 1 on screens outside a node, which have no node heading above them. */
  level?: 1 | 2;
}

export function PageHeader({ title, actions, level = 2 }: PageHeaderProps) {
  return (
    <Header>
      <Title as={level === 1 ? 'h1' : 'h2'}>{title}</Title>
      {actions && (
        <Actions>
          {actions}
        </Actions>
      )}
    </Header>
  );
}
