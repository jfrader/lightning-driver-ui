import { Flex, styled } from '@jfrader/ui';
import type { NodeSummary } from '../../api/types';
import { Freshness } from '../../components/Freshness';
import { InlineCode } from '../../components/InlineCode';
import { BACKEND_LABEL } from './labels';
import { NodeStatusPills } from './NodeStatusPills';
import { NodeSwitcher } from './NodeSwitcher';

const Title = styled.h1(({ theme }) => ({
  margin: 0,
  fontSize: theme.textSize['2xl'],
  fontWeight: theme.fontWeight.semibold,
  overflowWrap: 'anywhere',
}));

const Meta = styled.span(({ theme }) => ({ color: theme.color.textMuted, fontSize: theme.textSize.sm }));

export function NodeHeader({ node }: { node: NodeSummary }) {
  return (
    <Flex wrap gap="md" align="end" justify="between">
      <Flex direction="column" gap="xs">
        <Title>{node.label}</Title>
        <Flex wrap gap="sm" align="center">
          <InlineCode>{node.id}</InlineCode>
          <Meta>{BACKEND_LABEL[node.backend]}</Meta>
        </Flex>
        <NodeStatusPills node={node} />
        <Freshness observedAt={node.status.observed_at} stale={node.status.stale} />
      </Flex>
      <NodeSwitcher node={node} />
    </Flex>
  );
}
