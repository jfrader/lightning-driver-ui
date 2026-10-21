import { Flex, styled } from '@jfrader/ui';
import { Outlet } from '@tanstack/react-router';
import type { NodeSummary } from '../../api/types';
import { WIDE_LAYOUT_MEDIA } from '../../config';
import { NodeHeader } from './NodeHeader';
import { NodeSectionNav } from './NodeSectionNav';
import { UnresolvedNotice } from './UnresolvedNotice';

const Body = styled.div(({ theme }) => ({
  display: 'grid',
  gap: theme.space[4],
  [WIDE_LAYOUT_MEDIA]: { gridTemplateColumns: '12rem minmax(0, 1fr)', alignItems: 'start' },
}));

const Content = styled.div(({ theme }) => ({ display: 'grid', gap: theme.space[4], minInlineSize: 0 }));

export function ConfiguredNodeLayout({ node }: { node: NodeSummary }) {
  return (
    <Flex direction="column" gap="md">
      <NodeHeader node={node} />
      <UnresolvedNotice node={node} />
      <Body>
        <NodeSectionNav nodeId={node.id} nodeLabel={node.label} />
        <Content>
          <Outlet />
        </Content>
      </Body>
    </Flex>
  );
}
