import type { ReactNode } from 'react';
import { styled, type NavigationGroupRecord } from '@jfrader/ui';
import { useRouter } from '@tanstack/react-router';
import { RouterNavigation } from '../../components/RouterNavigation';
import { formatInteger, parseWireDecimal } from '../../lib/money';
import { DESTINATION_GROUPS, NODE_DESTINATIONS, type NodeDestination } from './nav-model';
import { useShellNode } from './use-shell-node';

const Label = styled.span(({ theme }) => ({
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  inlineSize: '100%',
  gap: theme.space[2],
}));

const Count = styled.span(({ theme }) => ({
  fontFamily: theme.font.mono,
  fontSize: theme.textSize.xs,
  fontVariantNumeric: 'tabular-nums',
  color: theme.color.warning,
}));

/** Grouped node sections, then Fleet. Without a node in the URL only Fleet is a destination. */
export function SideNav() {
  const router = useRouter();
  const { nodeId, node, destination, pathname } = useShellNode();
  const unresolved = node ? parseWireDecimal(node.unresolved_operation_count) : 0n;

  const label = (key: NodeDestination): ReactNode => {
    const text = NODE_DESTINATIONS[key].label;
    if (key !== 'operations' || unresolved === 0n) return text;
    return (
      <Label>
        {text}
        <Count aria-label={`${formatInteger(unresolved)} unresolved`}>{formatInteger(unresolved)}</Count>
      </Label>
    );
  };

  const nodeGroups: NavigationGroupRecord[] =
    nodeId === null
      ? []
      : DESTINATION_GROUPS.map((group) => ({
          key: group.key,
          label: group.label,
          items: group.items.map((key) => ({
            key,
            label: label(key),
            href: router.buildLocation({ to: NODE_DESTINATIONS[key].to, params: { nodeId } }).href,
            active: key === destination,
          })),
        }));
  const fleetHref = router.buildLocation({ to: '/fleet' }).href;
  const groups = [...nodeGroups, { key: 'fleet', items: [{ key: 'fleet', label: 'Fleet', href: fleetHref, active: pathname === fleetHref }] }];

  return <RouterNavigation label="Node sections" groups={groups} />;
}
