import type { Operation } from '../../../api/types';
import { useDesktopShell } from '../../shell/use-shell-layout';
import { FormLink } from './kind-links';

/**
 * Back to the form without sending anything. Beside the primary action on desktop only: on a phone
 * the review keeps one action above the tab bar and the back link leaves the review. Inert once the
 * confirmation is sent.
 */
export function DiscardLink({ operation, sending }: { operation: Operation; sending: boolean }) {
  if (!useDesktopShell()) return null;
  return <FormLink operation={operation} label="Discard review" variant="ghost" disabled={sending} />;
}
