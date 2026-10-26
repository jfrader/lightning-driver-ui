import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from '@tanstack/react-router';

export function useOverlayEntry(marker: 'moneySheet' | 'paletteEntry', open: boolean) {
  const entered = useRef<'none' | 'opened' | 'closing'>('none');
  const normalized = useRef(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const clear = () => { entered.current = 'none'; };
    window.addEventListener('popstate', clear);
    return () => {
      window.removeEventListener('popstate', clear);
      clear();
    };
  }, []);

  useEffect(() => {
    if (normalized.current) return;
    normalized.current = true;
    if (open || !location.state[marker]) return;
    void navigate({
      to: '.', search: true, hash: location.hash, replace: true, resetScroll: false,
      state: (previous) => ({ ...previous, [marker]: undefined }),
    });
  }, [open, location.state, location.hash, marker, navigate]);

  return entered;
}
