import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useRouter, useSearch } from '@tanstack/react-router';
import { booleanCodec } from '../../app/search';

declare module '@tanstack/react-router' {
  interface HistoryState { paletteEntry?: boolean }
}

function isPaletteShortcut(event: KeyboardEvent): boolean {
  return event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey;
}

/**
 * Open state of the command palette: Ctrl/⌘-K opens it, and closing returns focus to whatever
 * had it before (when that element is still on the page).
 */
export function usePalette() {
  const search = useSearch({ strict: false });
  const open = booleanCodec.parse(search.palette);
  const location = useLocation();
  const navigate = useNavigate();
  const router = useRouter();
  const returnFocus = useRef<HTMLElement | null>(null);
  const invoker = useRef<HTMLElement | null>(null);

  const setOpen = useCallback((next: boolean) => {
    if (next) {
      if (open) return;
      // A repeated shortcut while open must not replace the original opener with the palette input.
      if (returnFocus.current === null && document.activeElement instanceof HTMLElement) {
        returnFocus.current = document.activeElement;
        invoker.current = document.activeElement;
      }
      void navigate({ to: '.', search: (previous) => ({ ...previous, palette: booleanCodec.serialize(next) }), state: (previous) => ({ ...previous, paletteEntry: true }), hash: location.hash, resetScroll: false });
      return;
    }
    if (!open) return;
    if (location.state.paletteEntry) router.history.back();
    else void navigate({ to: '.', search: (previous) => ({ ...previous, palette: booleanCodec.serialize(next) }), hash: location.hash, replace: true, resetScroll: false });
  }, [open, navigate, location.hash, location.state.paletteEntry, router]);

  useEffect(() => {
    if (open) return;
    const target = returnFocus.current;
    returnFocus.current = null;
    if (target?.isConnected) requestAnimationFrame(() => {
      if (!document.querySelector('dialog[open]')) target.focus();
    });
  }, [open]);

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
