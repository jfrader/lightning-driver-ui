import { useCallback, useEffect, useRef, useState } from 'react';

/** Holds an action disabled for a server `Retry-After`; nothing retries when it ends. */
export function useCooldown(): { active: boolean; start: (seconds: number) => void } {
  const [active, setActive] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const start = useCallback((seconds: number) => {
    window.clearTimeout(timer.current);
    setActive(true);
    timer.current = window.setTimeout(() => setActive(false), seconds * 1000);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { active, start };
}
