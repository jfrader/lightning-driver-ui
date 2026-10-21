import type { ReactNode } from 'react';
import { Flex, styled } from '@jfrader/ui';

const Title = styled.h2(({ theme }) => ({
  margin: 0,
  fontSize: theme.textSize.xl,
  fontWeight: theme.fontWeight.semibold,
}));

interface PageHeaderProps {
  title: string;
  actions?: ReactNode;
  /** 1 on screens outside a node, which have no node heading above them. */
  level?: 1 | 2;
}

export function PageHeader({ title, actions, level = 2 }: PageHeaderProps) {
  return (
    <Flex wrap gap="sm" align="center" justify="between">
      <Title as={level === 1 ? 'h1' : 'h2'}>{title}</Title>
      {actions && (
        <Flex wrap gap="sm">
          {actions}
        </Flex>
      )}
    </Flex>
  );
}
