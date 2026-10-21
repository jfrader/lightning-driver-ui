import { styled } from '@jfrader/ui';
import { createLink } from '@tanstack/react-router';
import { TAB_BAR_HEIGHT, TOUCH_TARGET } from '../../config';
import { groupOf, NODE_DESTINATIONS, PHONE_TABS, type PhoneTab } from './nav-model';
import { useShellNode } from './use-shell-node';

const Bar = styled.nav(({ theme }) => ({
  position: 'fixed',
  insetInline: 0,
  insetBlockEnd: 0,
  zIndex: 2,
  display: 'grid',
  gridTemplateColumns: `repeat(${PHONE_TABS.length}, minmax(0, 1fr))`,
  boxSizing: 'border-box',
  blockSize: `calc(${TAB_BAR_HEIGHT} + env(safe-area-inset-bottom))`,
  paddingBlockEnd: 'env(safe-area-inset-bottom)',
  backgroundColor: theme.color.bgSoft,
  borderBlockStart: `1px solid ${theme.color.border}`,
}));

const TabAnchor = styled.a(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minBlockSize: TOUCH_TARGET,
  borderBlockStart: '2px solid transparent',
  color: theme.color.textMuted,
  fontSize: theme.textSize.sm,
  textDecoration: 'none',
  '&[aria-current="page"]': {
    borderBlockStartColor: theme.color.accent,
    color: theme.color.accentText,
    fontWeight: theme.fontWeight.semibold,
  },
  '&:focus-visible': { outline: `2px solid ${theme.color.focusRing}`, outlineOffset: '-2px' },
}));

const Tab = createLink(TabAnchor);

/** Our own `aria-current` picks the tab; the router may only add it on an exact match. */
const EXACT = { exact: true, includeSearch: false };

/** Phone tabs. Operations belongs to Overview; Fleet is reached from the node chooser. */
export function PhoneTabs() {
  const { tabNodeId, destination, pathname } = useShellNode();
  const active: PhoneTab | null = pathname === '/more' ? 'more' : destination ? (groupOf(destination)?.tab ?? null) : null;

  return (
    <Bar aria-label="Sections">
      {PHONE_TABS.map((tab) => {
        const current = tab.key === active ? 'page' : undefined;
        if (tab.destination === null) {
          return (
            <Tab key={tab.key} activeOptions={EXACT} to="/more" aria-current={current}>
              {tab.label}
            </Tab>
          );
        }
        if (tabNodeId === null) {
          return (
            <Tab key={tab.key} activeOptions={EXACT} to="/" aria-current={current}>
              {tab.label}
            </Tab>
          );
        }
        return (
          <Tab key={tab.key} activeOptions={EXACT} to={NODE_DESTINATIONS[tab.destination].to} params={{ nodeId: tabNodeId }} aria-current={current}>
            {tab.label}
          </Tab>
        );
      })}
    </Bar>
  );
}
