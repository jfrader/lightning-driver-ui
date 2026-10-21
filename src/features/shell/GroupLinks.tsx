import { styled } from '@jfrader/ui';
import { createLink } from '@tanstack/react-router';
import { groupOf, NODE_DESTINATIONS } from './nav-model';
import { useShellNode } from './use-shell-node';

const Row = styled.nav(({ theme }) => ({
  display: 'flex',
  gap: theme.space[1],
  marginBlockEnd: theme.space[4],
  borderBlockEnd: `1px solid ${theme.color.border}`,
  overflowX: 'auto',
}));

const ItemAnchor = styled.a(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  minBlockSize: '2.75rem',
  paddingInline: theme.space[3],
  borderBlockEnd: '2px solid transparent',
  marginBlockEnd: '-1px',
  color: theme.color.textMuted,
  fontSize: theme.textSize.sm,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
  '&[aria-current="page"]': { borderBlockEndColor: theme.color.accent, color: theme.color.text },
  '&:focus-visible': { outline: `2px solid ${theme.color.focusRing}`, outlineOffset: '-2px' },
}));

const Item = createLink(ItemAnchor);

/** Phone only: the sibling destinations of a tab (Wallet: Payments, Invoices, On-chain). */
export function GroupLinks() {
  const { nodeId, destination } = useShellNode();
  const group = destination ? groupOf(destination) : undefined;
  if (nodeId === null || !destination || !group?.label || group.items.length < 2) return null;
  return (
    <Row aria-label={group.label}>
      {group.items.map((key) => (
        <Item
          key={key}
          to={NODE_DESTINATIONS[key].to}
          params={{ nodeId }}
          activeOptions={{ exact: true, includeSearch: false }}
          aria-current={key === destination ? 'page' : undefined}
        >
          {NODE_DESTINATIONS[key].label}
        </Item>
      ))}
    </Row>
  );
}
