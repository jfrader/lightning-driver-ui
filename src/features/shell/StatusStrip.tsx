import { Button, Kbd, styled } from '@jfrader/ui';
import { useQuery } from '@tanstack/react-query';
import { fleetQueryOptions } from '../../api/node-queries';
import { STRIP_HEIGHT } from '../../config';
import { UnitToggle } from '../display/UnitToggle';
import { RegistryFacts, StatusFacts } from './StatusFacts';
import { UnresolvedButton } from './UnresolvedButton';
import { useShellNode } from './use-shell-node';

const Strip = styled.div(({ theme }) => ({
  position: 'sticky',
  insetBlockStart: 0,
  zIndex: 1,
  boxSizing: 'border-box',
  minBlockSize: STRIP_HEIGHT,
  display: 'flex',
  alignItems: 'center',
  gap: theme.space[4],
  paddingInline: theme.space[8],
  backgroundColor: theme.color.bg,
  borderBlockEnd: `1px solid ${theme.color.border}`,
}));

const Controls = styled.div(({ theme }) => ({
  marginInlineStart: 'auto',
  display: 'flex',
  alignItems: 'center',
  gap: theme.space[2],
}));

const APPLE_PLATFORM = /mac|iphone|ipad/i;

function isApple(): boolean {
  return APPLE_PLATFORM.test(navigator.platform);
}

/** Desktop status strip: node state, unresolved count, unit and the palette trigger. */
export function StatusStrip({ onOpenPalette }: { onOpenPalette: () => void }) {
  const { node, pathname } = useShellNode();
  const fleet = useQuery(fleetQueryOptions());
  return (
    <Strip>
      {node && <StatusFacts node={node} compact={false} />}
      {!node && pathname === '/fleet' && fleet.data && (
        <RegistryFacts observedAt={fleet.data.observed_at} stale={fleet.data.stale} />
      )}
      <Controls>
        {node && <UnresolvedButton node={node} />}
        <UnitToggle />
        <Button
          size="sm"
          variant="ghost"
          aria-keyshortcuts="Control+K Meta+K"
          onClick={onOpenPalette}
          endIcon={
            <Kbd.Group>
              <Kbd>{isApple() ? '⌘' : 'Ctrl'}</Kbd>
              <Kbd>K</Kbd>
            </Kbd.Group>
          }
        >
          Go to
        </Button>
      </Controls>
    </Strip>
  );
}
