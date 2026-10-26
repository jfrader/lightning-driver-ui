import { useState } from 'react';
import { Select, styled } from '@jfrader/ui';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { fleetQueryOptions } from '../../api/node-queries';
import { TOUCH_TARGET } from '../../config';
import { accessLabel, NODE_STATUS, nodeChoiceLabel } from '../nodes/labels';
import { useConfirmInFlight } from '../operations/confirming';
import { NODE_DESTINATIONS, surfacesFor } from './nav-model';
import { useShellNode } from './use-shell-node';
import { visuallyHidden } from './visually-hidden';

/** Not a valid node ID, so it can never collide with one. */
const ALL_NODES = '*';
const Choice = styled.div({ minInlineSize: 0, inlineSize: '100%' });
const Marker = styled.span<{ ready: boolean }>(({ theme, ready }) => ({ inlineSize: theme.space[2], blockSize: theme.space[2], flexShrink: 0, borderRadius: theme.radius.full, backgroundColor: ready ? theme.color.success : theme.color.warning, forcedColorAdjust: 'none' }));

/**
 * Switching is a URL change: the same list on the other node, else its Overview. While a sent
 * confirmation has not answered, switching is locked so no review is left half-confirmed.
 */
export function NodeChooser() {
  const locked = useConfirmInFlight();
  const router = useRouter();
  const navigate = useNavigate();
  const size = 'lg';
  const { nodeId, node, destination, pathname } = useShellNode();
  // The fleet feeds the open listbox only; every screen already has its own node summary.
  const [open, setOpen] = useState(false);
  const fleet = useQuery({ ...fleetQueryOptions(), enabled: open, staleTime: 0 });

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
    <Choice>
    <Select
      disabled={locked}
      value={nodeId ?? ALL_NODES}
      onOpenChange={setOpen}
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
    >
      <Select.Label sx={visuallyHidden}>Node</Select.Label>
      <Select.Trigger size={size} sx={{ inlineSize: '100%', minInlineSize: 0 }} title={node ? nodeChoiceLabel(node) : 'All nodes'}>
        {node && <Marker ready={node.status.status === 'online' && !node.read_only && node.kind !== 'bitcoin'} aria-hidden="true" />}
        <Select.Value sx={{ minInlineSize: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} />
      </Select.Trigger>
      {(node || locked) && <Select.Description sx={locked ? undefined : visuallyHidden}>{locked ? 'Sending…' : node && `${NODE_STATUS[node.status.status].label} · ${accessLabel(node)}`}</Select.Description>}
      <Select.Content>
        {options.map((option) => <Select.Item key={option.value} value={option.value} sx={{ minBlockSize: TOUCH_TARGET }}>{option.label}</Select.Item>)}
      </Select.Content>
    </Select>
    </Choice>
  );
}
