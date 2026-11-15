import type { ReactNode } from 'react';

/**
 * The region that holds the current screen. Screen changes are cross-faded by the router's view
 * transition, so the previous screen stays painted while the next one takes over; this component
 * only marks the region the shell lays out.
 */
export function ContentRegion({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}
