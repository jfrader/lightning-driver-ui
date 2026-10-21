import { Flex } from '@jfrader/ui';
import { Outlet } from '@tanstack/react-router';
import type { NodeSummary } from '../../api/types';
import { NodeHeader } from './NodeHeader';

/** Every node screen names its node; status, sections and switching live in the shell. */
export function ConfiguredNodeLayout({ node }: { node: NodeSummary }) {
  return (
    <Flex direction="column" gap="md">
      <NodeHeader node={node} />
      <Outlet />
    </Flex>
  );
}
