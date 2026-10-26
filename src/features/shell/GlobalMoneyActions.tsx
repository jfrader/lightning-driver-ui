import { lazy, Suspense, useContext, useLayoutEffect, useRef } from 'react';
import { Morph, styled } from '@jfrader/ui';
import type { NodeSummary } from '../../api/types';
import { MONEY_ACTIONS } from '../../app/search';
import { OverlayInvokerContext } from '../../components/overlay-invoker-context';
import { useControlSize, useDesktopShell } from './use-shell-layout';
import { useMoneySheet } from './use-money-sheet';
import { surfacesFor } from './nav-model';

const LiveOperationsButton = lazy(() => import('./LiveOperationsButton').then((module) => ({ default: module.LiveOperationsButton })));
const MoneySurface = lazy(() => import('./MoneySurface').then((module) => ({ default: module.MoneySurface })));

const Reason = styled.span(({ theme }) => ({ position: 'absolute', inlineSize: '1px', blockSize: '1px', overflow: 'hidden', clipPath: 'inset(50%)', color: theme.color.textMuted }));

export function GlobalMoneyActions({ node }: { node: NodeSummary | null }) {
  const sheet = useMoneySheet();
  const desktop = useDesktopShell();
  const size = useControlSize();
  const invoker = useContext(OverlayInvokerContext);
  const open = !!(sheet.search.send || sheet.search.receive);
  const trigger = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    if (open && trigger.current) {
      if (invoker) invoker.current = trigger.current;
      trigger.current.focus();
    }
  }, [open, invoker]);
  const step = sheet.search.action ? `action:${sheet.search.action}` : 'menu';
  return (
    <>
      {node && surfacesFor(node).includes('operations') && (
        <Suspense fallback={null}>
          <LiveOperationsButton key={node.id} node={node} />
        </Suspense>
      )}
      <Morph.Root variant={desktop ? 'popover' : 'sheet'} open={open} step={step}
        onOpenChange={(next) => next ? sheet.update({ send: 1 }, false) : sheet.close()}
        onStepChange={(next) => {
          if (next === 'menu') {
            sheet.update({ send: sheet.search.send, receive: sheet.search.receive });
            return;
          }
          const action = [...MONEY_ACTIONS.send, ...MONEY_ACTIONS.receive].find((id) => next === `action:${id}`);
          const mode = action === 'create_invoice' || action === 'new_address' ? 'receive' : 'send';
          sheet.update({ [mode]: 1, action });
        }}>
        <Morph.Trigger ref={trigger} size={size} tone="accent" disabled={!node} aria-label="Send and receive" aria-describedby={!node ? 'money-node-reason' : undefined}>
          {desktop ? 'Send and receive' : <svg aria-hidden="true" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 20V4m-4 4 4-4 4 4M17 4v16m-4-4 4 4 4-4" /></svg>}
        </Morph.Trigger>
        {node && <Suspense fallback={null}><MoneySurface node={node} /></Suspense>}
      </Morph.Root>
      {!node && <Reason id="money-node-reason">Select a node.</Reason>}
    </>
  );
}
