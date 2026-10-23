import { Alert, Flex } from '@jfrader/ui';
import { Outlet, useLocation } from '@tanstack/react-router';
import type { NodeSummary } from '../../api/types';
import { NodeHeader } from './NodeHeader';
import { ButtonLink } from '../../components/ButtonLink';
import { destinationOf, surfacesFor, NODE_DESTINATIONS } from '../shell/nav-model';
import { useControlSize } from '../shell/use-shell-layout';

/** Every node screen names its node; status, sections and switching live in the shell. */
export function ConfiguredNodeLayout({ node }: { node: NodeSummary }) {
  const size = useControlSize();
  const { pathname } = useLocation();
  const destination = destinationOf(pathname);
  const unavailable =
    destination !== null &&
    (!surfacesFor(node).includes(destination) ||
      (node.kind === 'bitcoin' &&
        pathname !==
          `/nodes/${node.id}${NODE_DESTINATIONS[destination].segment ? `/${NODE_DESTINATIONS[destination].segment}` : ''}`));
  return (
    <Flex direction="column" gap="md">
      <NodeHeader node={node} />
      {unavailable ? (
        <>
          <Alert tone="info" title="Not available for this node" />
          <div>
            <ButtonLink size={size} variant="ghost" to="/nodes/$nodeId" params={{ nodeId: node.id }}>
              Back to Overview
            </ButtonLink>
          </div>
        </>
      ) : (
        <Outlet />
      )}
    </Flex>
  );
}
