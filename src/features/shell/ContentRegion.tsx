import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { REDUCED_MOTION_QUERY } from '../../config';

const DURATION_PROPERTY = '--ui-motion-duration-base';
const EASING_PROPERTY = '--ui-motion-ease-standard';

const ENTER: Keyframe[] = [
  { opacity: 0, transform: 'translateY(4px)' },
  { opacity: 1, transform: 'none' },
];

/**
 * The only region that moves on a screen change: opacity and a 4px rise, at the theme's base
 * duration, without remounting the screen. Reduced motion skips it.
 */
export function ContentRegion({ screenKey, children }: { screenKey: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || typeof element.animate !== 'function') return;
    if (window.matchMedia(REDUCED_MOTION_QUERY).matches) return;
    const style = getComputedStyle(element);
    const duration = Number.parseFloat(style.getPropertyValue(DURATION_PROPERTY));
    if (!Number.isFinite(duration)) return;
    const easing = style.getPropertyValue(EASING_PROPERTY).trim() || 'ease';
    const animation = element.animate(ENTER, { duration, easing });
    return () => animation.cancel();
  }, [screenKey]);

  return <div ref={ref}>{children}</div>;
}
