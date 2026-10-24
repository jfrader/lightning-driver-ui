import { useContext, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
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

export function OperationSheet({ title, hasReview, busy, onClose, onDiscard, children }: OperationSheetProps) {
  const desktop = useDesktopShell();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const paletteInvoker = useContext(OverlayInvokerContext);
  const [invoker] = useState(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body && !active.closest('dialog')) return active;
    return paletteInvoker?.current ?? null;
  });
  useLayoutEffect(() => () => {
    requestAnimationFrame(() => {
      if (invoker?.isConnected) invoker.focus();
    });
  }, [invoker]);
  useLayoutEffect(() => {
    titleRef.current?.focus();
  }, [hasReview]);
  const canDismiss = !hasReview && !busy;
  const Surface = desktop ? Drawer : BottomSheet;
  return createPortal(
    <Surface open onOpenChange={(open) => { if (!open && canDismiss) onClose(); }} {...(desktop ? { size: 'lg' as const } : { detents: [1] })}>
      <Surface.Content withDescription={false} onCancel={(event) => { if (!canDismiss) event.preventDefault(); }}>
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
