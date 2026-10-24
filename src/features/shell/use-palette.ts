import { useCallback, useEffect, useRef, useState } from 'react';

function isPaletteShortcut(event: KeyboardEvent): boolean {
  return event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey;
}

/**
 * Open state of the command palette: Ctrl/⌘-K opens it, and closing returns focus to whatever
 * had it before (when that element is still on the page).
 */
export function usePalette() {
  const [open, setOpenState] = useState(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const invoker = useRef<HTMLElement | null>(null);

  const setOpen = useCallback((next: boolean) => {
    if (next) {
      // A repeated shortcut while open must not replace the original opener with the palette input.
      if (returnFocus.current === null && document.activeElement instanceof HTMLElement) {
        returnFocus.current = document.activeElement;
        invoker.current = document.activeElement;
      }
      setOpenState(true);
      return;
    }
    setOpenState(false);
    const target = returnFocus.current;
    returnFocus.current = null;
    if (target?.isConnected) requestAnimationFrame(() => target.focus());
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isPaletteShortcut(event) || event.repeat) return;
      event.preventDefault();
      setOpen(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setOpen]);

  return { open, setOpen, invoker };
}
