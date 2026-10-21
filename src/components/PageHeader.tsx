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
}

export function PageHeader({ title, actions }: PageHeaderProps) {
  return (
    <Flex wrap gap="sm" align="center" justify="between">
      <Title>{title}</Title>
      {actions && (
        <Flex wrap gap="sm">
          {actions}
        </Flex>
      )}
    </Flex>
  );
}
