import { Flex, Pill, styled } from '@jfrader/ui';
import type { NodeSummary } from '../../api/types';
import { InlineCode } from '../../components/InlineCode';
import { BACKEND_LABEL, NETWORK_LABEL } from './labels';

const Title = styled.h1(({ theme }) => ({
  margin: 0,
  fontSize: theme.textSize['2xl'],
  fontWeight: theme.fontWeight.semibold,
  overflowWrap: 'anywhere',
}));

const Meta = styled.span(({ theme }) => ({ color: theme.color.textMuted, fontSize: theme.textSize.sm }));

/** Node identity at the top of its screens. Live state (access, connection, freshness) is in the shell. */
export function NodeHeader({ node }: { node: NodeSummary }) {
  return (
    <Flex direction="column" gap="xs">
      <Title>{node.label}</Title>
      <Flex wrap gap="sm" align="center">
        <Pill tone={node.network === 'unknown' ? 'warning' : 'neutral'}>{NETWORK_LABEL[node.network]}</Pill>
        <InlineCode>{node.id}</InlineCode>
        <Meta>{BACKEND_LABEL[node.backend]}</Meta>
      </Flex>
    </Flex>
  );
}
