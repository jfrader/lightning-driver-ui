import { Select } from '@jfrader/ui';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { fleetQueryOptions } from '../../api/node-queries';
import { TOUCH_TARGET } from '../../config';
import { nodeChoiceLabel } from '../nodes/labels';
import { useConfirmInFlight } from '../operations/confirming';
import { NODE_DESTINATIONS, surfacesFor } from './nav-model';
import { useControlSize } from './use-shell-layout';
import { useShellNode } from './use-shell-node';
import { visuallyHidden } from './visually-hidden';

/** Not a valid node ID, so it can never collide with one. */
const ALL_NODES = '*';

/**
 * Switching is a URL change: the same list on the other node, else its Overview. While a sent
 * confirmation has not answered, switching is locked so no review is left half-confirmed.
 */
export function NodeChooser() {
  const locked = useConfirmInFlight();
  const router = useRouter();
  const navigate = useNavigate();
  const size = useControlSize();
  const { nodeId, node, destination, pathname } = useShellNode();
  const fleet = useQuery(fleetQueryOptions());

  // The open node reads from its own summary, the read the header shows and refetches with every
  // observation; the fleet page may predate that observation.
  const nodes = (fleet.data?.items ?? (node ? [node] : [])).map((item) => (node && item.id === node.id ? node : item));
  const options = nodes.map((item) => ({ value: item.id, label: nodeChoiceLabel(item) }));
  if (nodeId && !options.some((option) => option.value === nodeId)) {
    options.unshift({ value: nodeId, label: node ? nodeChoiceLabel(node) : nodeId });
  }
  options.push({ value: ALL_NODES, label: 'All nodes' });

  const keepsDestination =
    nodeId !== null &&
    destination !== null &&
    router.buildLocation({ to: NODE_DESTINATIONS[destination].to, params: { nodeId } }).pathname === pathname;

  return (
    <Select
      label="Node"
      size={size}
      disabled={locked}
      description={locked ? 'Sending…' : undefined}
      options={options}
      value={nodeId ?? ALL_NODES}
      onValueChange={(next) => {
        if (next === (nodeId ?? ALL_NODES)) return;
        if (next === ALL_NODES) {
          void navigate({ to: '/fleet' });
          return;
        }
        const target = nodes.find((item) => item.id === next);
        const to =
          keepsDestination && target && surfacesFor(target).includes(destination)
            ? NODE_DESTINATIONS[destination].to
            : NODE_DESTINATIONS.overview.to;
        void navigate({ to, params: { nodeId: next } });
      }}
      slotProps={{
        root: { sx: { inlineSize: '100%', minInlineSize: 0 } },
        label: { sx: visuallyHidden },
        trigger: { sx: { inlineSize: '100%' } },
        item: { sx: { minBlockSize: size === 'lg' ? TOUCH_TARGET : undefined } },
      }}
    />
  );
}
