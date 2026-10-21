import type { ReactNode } from 'react';
import { Flex, Surface, styled } from '@jfrader/ui';

const Frame = styled(Surface)(({ theme }) => ({ padding: theme.space[4], minInlineSize: 0 }));

const Heading = styled.h3(({ theme }) => ({
  margin: 0,
  fontSize: theme.textSize.md,
  fontWeight: theme.fontWeight.semibold,
}));

interface PanelProps {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}

/** One titled block of related node data. */
export function Panel({ title, actions, children }: PanelProps) {
  return (
    <Frame>
      <Flex direction="column" gap="md">
        <Flex wrap gap="sm" align="center" justify="between">
          <Heading>{title}</Heading>
          {actions}
        </Flex>
        {children}
      </Flex>
    </Frame>
  );
}
