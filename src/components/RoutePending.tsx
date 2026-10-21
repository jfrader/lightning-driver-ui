import { styled } from '@jfrader/ui';
import { visuallyHidden } from '../features/shell/visually-hidden';

const Hidden = styled.span(visuallyHidden);

/**
 * Shown only while a screen's code loads for longer than the router's pending delay. It draws
 * nothing, so the shell around it does not move and the screen appears in place.
 */
export function RoutePending() {
  return (
    <div role="status" aria-busy="true">
      <Hidden>Loading</Hidden>
    </div>
  );
}
