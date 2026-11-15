import { lazy, Suspense } from 'react';
import { Button, Kbd, styled } from '@jfrader/ui';
import { useQuery } from '@tanstack/react-query';
import { useMediaQuery } from '../../lib/use-media-query';
import { fleetQueryOptions } from '../../api/node-queries';
import { STRIP_HEIGHT } from '../../config';
import { wrappingControlText } from '../../components/control-styles';
import { UnitToggle } from '../display/UnitToggle';
import { RegistryFacts, StatusFacts } from './StatusFacts';
import { useShellNode } from './use-shell-node';

const GlobalMoneyActions = lazy(() => import('./GlobalMoneyActions').then((module) => ({ default: module.GlobalMoneyActions })));

const Strip = styled.div(({ theme }) => ({
  position: 'sticky',
  insetBlockStart: 0,
  zIndex: 1,
  boxSizing: 'border-box',
  minBlockSize: STRIP_HEIGHT,
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: theme.space[4],
  paddingInline: theme.space[8],
  backgroundColor: theme.color.bg,
  borderBlockEnd: `1px solid ${theme.color.border}`,
}));

const Controls = styled.div(({ theme }) => ({
  marginInlineStart: 'auto',
  display: 'flex',
  flexWrap: 'wrap',
  maxInlineSize: '100%',
  alignItems: 'center',
  gap: theme.space[2],
  '& > *': { flexShrink: 0 },
}));

const APPLE_PLATFORM = /mac|iphone|ipad/i;

function isApple(): boolean {
  return APPLE_PLATFORM.test(navigator.platform);
}

/** Desktop status strip: node state, unresolved count, unit and the palette trigger. */
export function StatusStrip({ onOpenPalette }: { onOpenPalette: () => void }) {
  const { node, nodeId, pathname } = useShellNode();
  // Below 90rem the strip keeps one row by dropping the observation clock (the age stays).
  const wide = useMediaQuery('(min-width: 90rem)');
  // Only the fleet landing screen reads the registry summary; node screens have their own strip.
  const fleet = useQuery({ ...fleetQueryOptions(), enabled: !node && pathname === '/fleet' });
  return (
    <Strip>
      {node && <StatusFacts node={node} compact={!wide} />}
      {!node && pathname === '/fleet' && fleet.data && (
        <RegistryFacts observedAt={fleet.data.observed_at} stale={fleet.data.stale} />
      )}
      <Controls>
        <Suspense fallback={null}><GlobalMoneyActions node={node} nodeId={nodeId} /></Suspense>
        <UnitToggle />
        <Button
          size="sm"
          // A keyboard hint never breaks across lines: the shortcut is one unit even when the strip
          // is tight or the text is enlarged.
          sx={{ ...wrappingControlText('sm'), whiteSpace: 'nowrap', overflowWrap: 'normal', flexShrink: 0 }}
          variant="ghost"
          aria-keyshortcuts="Control+K Meta+K"
          onClick={onOpenPalette}
          endIcon={
            <Kbd.Group sx={{ flexWrap: 'nowrap', flexShrink: 0 }}>
              <Kbd sx={{ flexShrink: 0 }}>{isApple() ? '⌘' : 'Ctrl'}</Kbd>
              <Kbd sx={{ flexShrink: 0 }}>K</Kbd>
            </Kbd.Group>
          }
        >
          Go to
        </Button>
      </Controls>
    </Strip>
  );
}
