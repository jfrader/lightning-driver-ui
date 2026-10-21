import type { ReactNode } from 'react';
import { Flex, styled } from '@jfrader/ui';
import type { CapabilityKey, NodePolicy, NodeSummary } from '../../api/types';
import { READING_WIDTH } from '../../config';
import { CapabilityGate } from '../nodes/CapabilityGate';
import { useCurrentNode } from '../nodes/use-current-node';
import { PolicyLoader } from './PolicyLoader';

const Head = styled.div(({ theme }) => ({ display: 'grid', gap: theme.space[1], justifyItems: 'start' }));

const Title = styled.h2(({ theme }) => ({ margin: 0, fontSize: theme.textSize.xl, fontWeight: theme.fontWeight.semibold }));

const Body = styled.div({ maxInlineSize: READING_WIDTH, minInlineSize: 0 });

interface FlowFrameProps {
  title: string;
  capability: CapabilityKey;
  /** Link back to the list this action belongs to (shown above the title and when blocked). */
  back: ReactNode;
  children: (context: { node: NodeSummary; policy: NodePolicy }) => ReactNode;
}

/**
 * Every mutation form: back link and title, then the capability gate (read-only, offline, syncing,
 * unverified… with the reason shown literally) and the node's server policy. A form only creates a
 * review; nothing here dispatches.
 */
export function FlowFrame({ title, capability, back, children }: FlowFrameProps) {
  const node = useCurrentNode();
  return (
    <Flex direction="column" gap="md">
      <Head>
        {back}
        <Title>{title}</Title>
      </Head>
      <Body>
        <CapabilityGate node={node} capability={capability} back={null}>
          <PolicyLoader nodeId={node.id}>{(policy) => children({ node, policy })}</PolicyLoader>
        </CapabilityGate>
      </Body>
    </Flex>
  );
}
