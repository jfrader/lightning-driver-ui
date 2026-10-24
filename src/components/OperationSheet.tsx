import { useContext, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { BottomSheet, Button, Drawer, theme } from '@jfrader/ui';
import { useDesktopShell } from '../features/shell/use-shell-layout';
import { OverlayInvokerContext } from './overlay-invoker-context';

interface OperationSheetProps {
  title: string;
  hasReview: boolean;
  busy: boolean;
  onClose: () => void;
  onDiscard: () => void;
  children: ReactNode;
}

function containTab(event: KeyboardEvent<HTMLDialogElement>) {
  if (event.key !== 'Tab') return;
  const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]')]
    .filter((element) => element.tabIndex >= 0 && !element.matches(':disabled, [inert], [inert] *') && element.getClientRects().length > 0);
  const first = controls[0];
  const last = controls.at(-1);
  const active = document.activeElement;
  const atBoundary = event.shiftKey ? active === first || !(active instanceof HTMLElement && controls.includes(active)) : active === last;
  if (!first || !last) {
    event.preventDefault();
    return;
  }
  if (atBoundary) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  }
}

export function OperationSheet({ title, hasReview, busy, onClose, onDiscard, children }: OperationSheetProps) {
  // The surface is fixed when the sheet opens: swapping Drawer for BottomSheet mid-edit unmounts the
  // form and loses what was typed. A resize keeps the surface until the sheet closes.
  const isDesktop = useDesktopShell();
  const [desktop] = useState(isDesktop);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const overlayInvoker = useContext(OverlayInvokerContext);
  const [invoker] = useState(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body && !active.closest('dialog')) {
      if (overlayInvoker) overlayInvoker.current = active;
      return active;
    }
    return overlayInvoker?.current ?? null;
  });
  useLayoutEffect(() => () => {
    requestAnimationFrame(() => {
      if (invoker?.isConnected) invoker.focus();
    });
  }, [invoker]);
  useLayoutEffect(() => {
    titleRef.current?.focus();
  }, [hasReview, title]);
  const canDismiss = !hasReview && !busy;
  const Surface = desktop ? Drawer : BottomSheet;
  return createPortal(
    <Surface open onOpenChange={(open) => { if (!open && canDismiss) onClose(); }} {...(desktop ? { size: 'lg' as const } : { detents: [1] })}>
      <Surface.Content withDescription={false} onKeyDown={containTab} onCancel={(event) => { if (!canDismiss) event.preventDefault(); }}>
        <Surface.Panel appearance="default">
          <Surface.Header sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: theme.space[2] }}>
            <Surface.Title ref={titleRef} tabIndex={-1}>{title}</Surface.Title>
            <Button size={desktop ? 'sm' : 'lg'} variant="ghost" disabled={busy} onClick={hasReview ? onDiscard : onClose}>
              {hasReview ? 'Discard review' : 'Close'}
            </Button>
          </Surface.Header>
          <Surface.Body>{children}</Surface.Body>
        </Surface.Panel>
      </Surface.Content>
    </Surface>, document.querySelector('[data-ui~="theme-root"]') ?? document.body
  );
}
