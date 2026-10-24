import { CommandPalette, type CommandPaletteItemRecord } from '@jfrader/ui';
import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { fleetQueryOptions } from '../../api/node-queries';
import { keysOf } from '../../lib/guards';
import { capabilityBlock, capabilityReasonText, nodeChoiceLabel } from '../nodes/labels';
import { useConfirmInFlight } from '../operations/confirming';
import { ACTION_SURFACES, FORM_DESTINATIONS, GLOBAL_DESTINATIONS, NODE_DESTINATIONS, surfacesFor } from './nav-model';
import { useShellNode } from './use-shell-node';
import { TOUCH_TARGET } from '../../config';
import { useDesktopShell } from './use-shell-layout';

interface NavPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Ctrl/⌘-K: a closed list of destinations, form openings and node switches. Every item only
 * navigates; nothing here creates, authorizes or confirms an operation.
 */
export function NavPalette({ open, onOpenChange }: NavPaletteProps) {
  const desktop = useDesktopShell();
  const navigate = useNavigate();
  const selected = useRef(false);
  const destination = { replace: true, state: { paletteEntry: false } } as const;
  const { nodeId, node } = useShellNode();
  const fleet = useQuery(fleetQueryOptions());
  const switchLocked = useConfirmInFlight();

  const items: CommandPaletteItemRecord[] = [];
  if (nodeId !== null) {
    for (const key of node ? surfacesFor(node) : (['operations'] as const)) {
      const { label, to } = NODE_DESTINATIONS[key];
      items.push({
        value: `go-${key}`,
        label,
        group: 'Go to',
        onSelect: () => void navigate({ ...destination, to, params: { nodeId }, search: {} }),
      });
    }
    if (!node || surfacesFor(node).includes('operations'))
      items.push({
        value: 'go-unresolved',
        label: 'Unresolved operations',
        group: 'Go to',
        keywords: 'unknown pending',
        onSelect: () =>
          void navigate({ ...destination, to: '/nodes/$nodeId/operations', params: { nodeId }, search: { state: 'nonterminal' } }),
      });
  }
  for (const key of keysOf(GLOBAL_DESTINATIONS)) {
    const { label, to, keywords } = GLOBAL_DESTINATIONS[key];
    items.push({ value: `go-${key}`, label, group: 'Go to', keywords, onSelect: () => void navigate({ ...destination, to, search: {} }) });
  }
  if (nodeId !== null && node) {
    for (const form of FORM_DESTINATIONS.filter(
      (form) => node.kind === 'lightning' && surfacesFor(node).includes(ACTION_SURFACES[form.capability]),
    )) {
      const reason = capabilityBlock(node, form.capability);
      items.push({
        value: `form-${form.capability}`,
        label: reason ? `${form.label} ${capabilityReasonText(reason, node)}` : form.label,
        group: 'Open form',
        keywords: form.keywords,
        disabled: reason !== null,
        onSelect: () => void navigate({ ...destination, to: form.to, params: { nodeId }, search: (previous) => ({ ...previous, palette: undefined }) }),
      });
    }
  }
  for (const other of fleet.data?.items ?? []) {
    if (other.id === nodeId) continue;
    items.push({
      value: `node-${other.id}`,
      label: nodeChoiceLabel(other),
      group: 'Switch node',
      disabled: switchLocked,
      onSelect: () => void navigate({ ...destination, to: '/nodes/$nodeId', params: { nodeId: other.id }, search: {} }),
    });
  }
  items.push({
    value: 'node-all',
    label: 'All nodes',
    group: 'Switch node',
    disabled: switchLocked,
    onSelect: () => void navigate({ ...destination, to: '/fleet', search: {} }),
  });

  return (
    <CommandPalette
      label="Go to"
      placeholder="Go to or open a form"
      emptyMessage="No matching destination"
      items={items}
      open={open}
      onOpenChange={(next) => { if (!selected.current) onOpenChange(next); }}
      onSelect={() => { selected.current = true; }}
      slotProps={{ item: { sx: { minBlockSize: desktop ? undefined : TOUCH_TARGET } } }}
    />
  );
}
