import { lazy, Suspense } from 'react';
import { Button, Flex, styled } from '@jfrader/ui';
import type { NodeSummary } from '../../api/types';
import { wrappingControlText } from '../../components/control-styles';
import { useControlSize } from './use-shell-layout';
import { useMoneySheet } from './use-money-sheet';
import { surfacesFor } from './nav-model';

const LiveOperationsButton = lazy(() => import('./LiveOperationsButton').then((module) => ({ default: module.LiveOperationsButton })));

const Reason = styled.p(({ theme }) => ({ margin: 0, color: theme.color.textMuted, fontSize: theme.textSize.sm }));

export function GlobalMoneyActions({ node }: { node: NodeSummary | null }) {
  const sheet = useMoneySheet();
  const size = useControlSize();
  return (
    <>
      {node && surfacesFor(node).includes('operations') && (
        <Suspense fallback={<Button size={size} variant="outline" sx={wrappingControlText(size)} disabled>… in progress</Button>}>
          <LiveOperationsButton key={node.id} node={node} />
        </Suspense>
      )}
      <Flex wrap gap="sm" align="center">
        <Button size={size} sx={wrappingControlText(size)} tone="accent" disabled={!node} aria-haspopup="dialog" aria-describedby={!node ? 'money-node-reason' : undefined} onClick={() => sheet.update({ send: 1 }, false)}>Send</Button>
        <Button size={size} sx={wrappingControlText(size)} variant="outline" disabled={!node} aria-haspopup="dialog" aria-describedby={!node ? 'money-node-reason' : undefined} onClick={() => sheet.update({ receive: 1 }, false)}>Receive</Button>
        {!node && <Reason id="money-node-reason">Select a node.</Reason>}
      </Flex>
    </>
  );
}
