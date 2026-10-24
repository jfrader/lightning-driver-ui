import { useLayoutEffect, useRef, type ReactNode, type MouseEvent } from 'react';
import { WorkLayout } from './WorkLayout';

interface InspectorLayoutProps {
  list: ReactNode;
  /** The selected record's inspector, or `null` when nothing is selected. */
  inspector: ReactNode | null;
  inspectorLabel: string;
}

/** A resource list with its inspector: beside it from 80rem, below it otherwise, and absent when nothing is selected. */
export function InspectorLayout({ list, inspector, inspectorLabel }: InspectorLayoutProps) {
  const aside = useRef<HTMLElement>(null);
  const invoker = useRef<HTMLElement | null>(null);
  const pending = useRef(false);
  const wasOpen = useRef(inspector !== null);
  const scroll = useRef({ x: 0, y: 0 });
  const captureOpen = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-row-primary]') : null;
    if (!(link instanceof HTMLAnchorElement) || link.href === window.location.href) return;
    invoker.current = link;
    scroll.current = { x: window.scrollX, y: window.scrollY };
    pending.current = true;
  };
  useLayoutEffect(() => {
    const open = inspector !== null;
    if (open && pending.current) {
      aside.current?.focus();
      pending.current = false;
    } else if (!open && wasOpen.current) {
      if (invoker.current?.isConnected) {
        invoker.current.focus({ preventScroll: true });
        window.scrollTo(scroll.current.x, scroll.current.y);
      }
      invoker.current = null;
      pending.current = false;
    }
    wasOpen.current = open;
  });
  return <WorkLayout main={<div onClickCapture={captureOpen}>{list}</div>} aside={inspector} asideLabel={inspectorLabel} asideRef={aside} asideTabIndex={-1} />;
}
