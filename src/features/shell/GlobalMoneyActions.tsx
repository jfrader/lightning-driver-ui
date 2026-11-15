import { lazy, Suspense, useContext, useId, useLayoutEffect, useRef, useState } from 'react';
import { styled } from '@jfrader/ui';
import { Morph } from '@jfrader/ui/morph';
import type { NodeSummary } from '../../api/types';
import { MONEY_ACTIONS } from '../../app/search';
import { MoneySurface } from '../../app/lazy-screens';
import { OverlayInvokerContext } from '../../components/overlay-invoker-context';
import { useControlSize, useDesktopShell } from './use-shell-layout';
import { visuallyHidden } from '../../components/visually-hidden';
import { useMoneySheet } from './use-money-sheet';
import { surfacesFor } from './nav-model';

const LiveOperationsButton = lazy(() => import('./LiveOperationsButton').then((module) => ({ default: module.LiveOperationsButton })));

/** The reason a not-yet-known node cannot act; announced, not painted over the strip. */
const Reason = styled.span(visuallyHidden);

export function GlobalMoneyActions({ node, nodeId }: { node: NodeSummary | null; nodeId: string | null }) {
  const sheet = useMoneySheet();
  const desktop = useDesktopShell();
  const size = useControlSize();
  const invoker = useContext(OverlayInvokerContext);
  const open = !!(sheet.search.send || sheet.search.receive);
  const [activated, setActivated] = useState(open);
  const trigger = useRef<HTMLButtonElement>(null);
  const reasonId = useId();
  useLayoutEffect(() => {
    if (open) setActivated(true);
    if (open && trigger.current) {
      if (invoker) invoker.current = trigger.current;
      trigger.current.focus();
    }
  }, [open, invoker]);
  const step = sheet.search.action ? `action:${sheet.search.action}` : 'menu';
  // Chrome, not a page action: the shortcut exists on a node workspace, never off it. A
  // monitor-only Bitcoin node and the screens without a node keep their own explanation instead of
  // a permanently dead accent control. While the summary is unknown the control waits, disabled
  // with an announced reason, so it never opens an empty surface for a former or failed node.
  const money = nodeId !== null && node?.kind !== 'bitcoin';
  const waiting = nodeId !== null && node === null;
  return (
    <>
      {node && surfacesFor(node).includes('operations') && (
        <Suspense fallback={null}>
          <LiveOperationsButton key={node.id} node={node} />
        </Suspense>
      )}
      {money && (
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
          <Morph.Trigger ref={trigger} size={size} tone="accent" aria-label="Send and receive" disabled={waiting} aria-describedby={waiting ? reasonId : undefined}
            onPointerEnter={() => { void MoneySurface.preload?.(); }} onFocus={() => { void MoneySurface.preload?.(); }}>
            {desktop ? 'Send and receive' : <svg aria-hidden="true" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 20V4m-4 4 4-4 4 4M17 4v16m-4-4 4 4 4-4" /></svg>}
          </Morph.Trigger>
          {node && (open || activated) && <Suspense fallback={null}><MoneySurface node={node} /></Suspense>}
        </Morph.Root>
      )}
      {waiting && <Reason id={reasonId}>Node not loaded.</Reason>}
    </>
  );
}
